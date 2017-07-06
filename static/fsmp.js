// This is a reference implementation for the Forward-Secret Messaging Protocol (FSMP)
// This implementation uses the Web Cryptography API.

// Namespaces
var fsmp = {}
fsmp.exc = {}


fsmp.exc.IncorrectReceipient = function() {
	Error.call( this, 'The certificate is not the receipient of the message' )
	this.name = 'IncorrectReceipientException'
}

fsmp.exc.UnsupportedType = function( type ) {
	Error.call( this, 'Type "' + type + '" not supported' )
	this.name = 'UnsupportedTypeException'
	this.type = type
}

fsmp.Body = function( cookie, padLength, plaintext ) {
	this.cookie = cookie
	this.padLength = padLength
	this.plaintext = plaintext
}

fsmp.Body.prototype.export = function() {
	var self = this

	return new Promise(function( success, fail ) {
		success( new fsmp.Buffer([ self.cookie, fsmp.encodeUint32( self.padLength ), self.plaintext, fsmp.randomBytes( self.padLength ) ]) )
	})
}

fsmp.Body.prototype.message = function() {
	return this.plaintext.substring( 0, this.plaintext.length - this.padLength )
}

fsmp.Buffer = function( data ) {
	this._add = function( other ) {
		return this._build( [ this.bytes ].concat( other ) )
	}

	this.add = function( other ) {
		return new fsmp.Buffer( this._add( other ) )
	}

	this.append = function( other ) {
		this.bytes = this._add( other )
	}

	this.at = function( index ) {
		return this.bytes[ index ]
	}

	this.length = function() {
		return this.bytes.length
	}

	this._build = function( object ) {
		var len = 0

		for ( var i in object ) {
			var item = object[i]

			if ( item instanceof fsmp.Buffer )
				len += item.length()
			else if ( item instanceof ArrayBuffer || item instanceof Uint8Array )
				len += item.byteLength
			else if ( typeof item == 'string' )
				len += item.length
			else if ( typeof item == 'number' )
				len += 1
			else
				new TypeError( "Unsupported buffer type \"" + typeof data + '"' )
		}

		var buffer = new Uint8Array( len )

		var index = 0
		for ( var i in object ) {
			var item = object[i]

			if ( item instanceof fsmp.Buffer ) {
				buffer.set( item.bytes, index )
				index += item.length()
			}
			else if ( typeof item == 'string' ) {
				buffer.set( fsmp.stringToBytes( item ), index )
				index += item.length
			}
			else if ( item instanceof Uint8Array ) {
				buffer.set( item, index )
				index += item.length
			}
			else if ( item instanceof ArrayBuffer ) {
				buffer.set( new Uint8Array( item ), index )
				index += item.byteLength
			}
			else if ( typeof item == 'number' ) {
				buffer[ index ] = item
				index += 1
			}
			else if ( item == null )
				throw new Error('item at index ' + i + ' is null')
		}

		return buffer
	}


	if ( typeof data == 'Buffer' )
		this.bytes = data.bytes
	else if ( typeof data == 'string' )
		this.bytes = fsmp.stringToBytes( data )
	else if ( typeof data == 'Number' )
		this.bytes = [ data ]
	else if ( typeof data == 'object' )
		this.bytes = this._build( data )
	else
		throw new TypeError( "Unsupported buffer type \"" + typeof data + '"' )
}

// The certificate contains:
// * All signature algorithms supported by the certificate owner and their public keys
// * All short-term key agreement algorithms that are supported by the owner
// * All encryption ciphers supported by the owner
fsmp.Certificate = function( signatureParams, keyExchangeParams, encryptionAlgorithm, hashAlgorithm, fingerprintAlgorithm, signature = null, trustSignatures = [] ) {
	this.signatureParams = signatureParams
	this.keyExchangeParams = keyExchangeParams
	this.encryptionAlgorithm = encryptionAlgorithm
	this.hashAlgorithm = hashAlgorithm
	this.fingerprintAlgorithm = fingerprintAlgorithm
	this.signature = signature
	this.trustSignatures = trustSignatures
console.log('test1')
console.log( encryptionAlgorithm )
console.log( this.encryptionAlgorithm )

	this.exportUnsigned = function() {
		var self = this

		return new Promise(function( success, fail ) {

			self.signatureParams.export().then(function( signatureData ) {
				
				self.keyExchangeParams.export().then(function( keyExchangeData ) {
					var buffer = new fsmp.Buffer([
						signatureData,
						keyExchangeData,
						fsmp.exportAlgorithm( self.encryptionAlgorithm ),
						fsmp.exportAlgorithm( self.hashAlgorithm ),
						fsmp.exportAlgorithm( self.fingerprintAlgorithm )
					])
					success( buffer )
				}).catch(function( error ) { fail( error ) })

			}).catch(function( error ) { fail( error ) })
		})
	}

	this.export = function() {
		var self = this
		
		return new Promise(function( success, fail ) {		

			self.exportUnsigned().then(function( data ) {

				var buffer = new fsmp.Buffer([ data, fsmp.encodeUint16( self.signature.length ), self.signature ])
				success( buffer )			
					
			}).catch(function( error ) { fail( error ) })
		})
	}

	this.sign = function( privateKey ) {
		var self = this
		return new Promise(function( success, fail ) {
			
			self.exportUnsigned().then(function( data ) {

				window.crypto.subtle.sign( self.signatureParams.algorithm, privateKey.longTerm, data.bytes ).then(function( signature_ ) {
					var signature = new Uint8Array( signature_ )
					success( signature )
				
				}).catch(function( error ) {
					fail( error )
				})
			
			}).catch(function( error ) { fail( error ) })
		})
	}

	this.calculateFingerprint = function() {
		var self = this
		return new Promise(function( success, fail ) {
			
			window.crypto.subtle.digest( self.fingerprintAlgorithm, self.signature ).then(function( hash ) {
				success( hash )
			}).catch(function( error ) {
				fail( error )
			})
		})
	}
}

fsmp.CertificateKey = function( longTermKey, defaultEphemeralKey ) {
	this.longTerm = longTermKey
	this.defaultEphemeral = defaultEphemeralKey
}

fsmp.CookieJar = {
	store: new Map(),
	fingerprintIndex: new Map(),

	storeCookie: function( cookie, certificate, ephemeralPublicKey ) {
		var object = { certificate: certificate, ephemeralPublicKey: ephemeralPublicKey }
		this.store.set( btoa( cookie ), object )
	},

	findCookie: function( cookie ) {
		return this.store.get( btoa( cookie ) )
	}
}

fsmp.InitiationBody = function( peerFingerprint, certificateChain = [], fingerprint = null, cookie, padLength, plaintext ) {
	fsmp.Body.call( this, cookie, padLength, plaintext )
	this.peerFingerprint = peerFingerprint	// The fingerprint of the certificate of the peer that is the intended receipient of the intiation packet
	this.certificateChain = certificateChain	// May contains 0 or more certificate, each which is signs the previous certificate
	this.fingerprint = fingerprint	// An optional fingerprint of the certificate that the receiver should know about.
	// If the certificateChain is not empty and the fingerprint is set, then the fingerprint belongs to the signer of the last certificate in the chain
}

fsmp.InitiationBody.prototype.export = function() {
	var self = this
	
	return new Promise(function( success, fail ) {
		var bufferList = []

		// Export the certificate chain and optionally the fingerprint
		if (self.certificateChain.length == 0) {
			bufferList.push( 0 )
			bufferList.push( self.fingerprint )
		}
		else {
			self.exportCertificateChain().then(function( chainBuffer ) {

				bufferList.push( chainBuffer )

			}).catch(function( error ) { fail( error ) })
		}

		// Export the regular body part of the intiation body
		fsmp.Body.prototype.export.call( self ).then(function( bodyBuffer ) {
			bufferList.push( bodyBuffer )

			success( new fsmp.Buffer( bufferList ) )
		}).catch(function( error ) { fail( error ) })
	})
}

fsmp.InitiationBody.prototype.exportCertificateChain = function() {
	var self = this

	return new Promise(function( success, fail ) {

		if (self.certificateChain.length == 0)
			success([ 0 ])

		else {
			self._exportCertificateChain( self.certificateChain ).then(function( bufferList ) {

				success( new fsmp.Buffer( [self.certificateChain.length].concat(bufferList) ) )

			}).catch(function( error ) { fail( error ) })
		}
	})
}

fsmp.InitiationBody.prototype._exportCertificateChain = function( subChain ) {
	var cert = subChain[0]

	return new Promise(function( success, fail ) {
		cert.export().then(function( buffer ) {

			if (subChain.length == 1)
				success([ fsmp.encodeUint32( buffer.length ), buffer ])
			else {

				this._exportCertificateChain( subChain.splice(1) ).then(function( buffers ) { 

					success( [fsmp.encodeUint32( buffer.length ), buffer].concat( buffers ) )
				}).catch(function( error ) { fail( error ) })
			}
		}).catch(function( error ) { fail( error ) })
	})
}

fsmp.InitiationPacket = function( keyExchangeHeader, ciphertext, version = 0 ) {
	fsmp.Packet.call( this, new Uint8Array(0), keyExchangeHeader, ciphertext, version )
}

fsmp.InitiationPacket.prototype.export = function() { console.log('initiation export')
	return fsmp.Packet.prototype.export.call( this )
}

fsmp.KeyExchangeHeader = function( nextShortTermPublicKey, signature ) {
	this.nextEphemeralPublicKey = nextShortTermPublicKey
	this.signature = signature
}

fsmp.KeyExchangeHeader.prototype.export = function() {
	var self = this

	return new Promise(function( success, fail ) {

		window.crypto.subtle.exportKey( 'raw', self.nextEphemeralPublicKey ).then(function( keyData ) {

			success( new fsmp.Buffer([ keyData, self.signature ]) )

		}).catch(function( error ) { fail( error ) })
	})
}

fsmp.KeyExchangeParams = function( algorithm, defaultPublicKey ) {
	this.algorithm = algorithm
	this.defaultEphemeralPublicKey = defaultPublicKey	// The public key to use when no session has been created (yet), so technically not 'ephemeral'

	this.export = function() {
		var self = this

		return new Promise(function( success, fail ) {

			window.crypto.subtle.exportKey( 'raw', self.defaultEphemeralPublicKey ).then(function( keyData ) {
				
				var buffer = new fsmp.Buffer([ fsmp.exportAlgorithm( self.algorithm ), keyData ])
				success( buffer )
			}).catch(function( error ) {
				fail( error )
			})
		})
	}
}

fsmp.Lock = function( fingerprint, key ) {
	this.fingerprint = fingerprint	// The fingerprint is used to determine if the lock has been succesfully opened or not
	// When the lock is decrypted, and the fingerprint matches, it means the lock had been encrypted with the certificate that had this fingerprint
	this.key = key	// The key that encrypts the body
}

fsmp.Message = function( sessionCookie, keyExchangeHeader, locks, ciphertext, version = 0 ) {
	fsmp.Packet.call( this, keyExchangeHeader, ciphertext, version )
	this.locks = locks

	this.export = function() {
		return new Promise(function( success, fail ) {
		
			this.keyAgreeHeader.export().then(function( keyHeaderData ) {
				success( new fsmp.Buffer([ 
					this.version,
					this.sessionCookie,
					keyHeaderData,
					this.locks.length,
					this.locks,
					this.ciphertext
				]) )
			}).catch(function( error ) { fail( error ) })
		})
	}
}

fsmp.Packet = function( sessionCookie, keyExchangeHeader, ciphertext, version = 0 ) {
	this.version = version
	this.sessionCookie = sessionCookie
	this.keyExchangeHeader = keyExchangeHeader
	this.ciphertext = ciphertext
}

fsmp.Packet.prototype.export = function() {
	var self = this

	return new Promise(function( success, fail ) {
		
		self.keyExchangeHeader.export().then(function( keyExchangeHeaderBuffer ) {

			var sessionCookie = self.sessionCookie.length != 0 ? self.sessionCookie : []

			var buffer = new fsmp.Buffer([
				self.version,
				self.sessionCookie.length,	// Use one byte to specify the session cookie's length
				sessionCookie,
				keyExchangeHeaderBuffer,
				self.ciphertext
			])
			console.log('buffer')
			console.log( buffer )
			success( buffer )

		}).catch(function( error ) { fail( error ) })
	})
}

fsmp.Reader = function( data ) {
	if ( data instanceof Uint8Array )
		this.bytes = data;
	else if ( data instanceof ArrayBuffer )
		this.bytes = new Uint8Array( data )
	else if ( data instanceof fsmp.Buffer )
		this.bytes = data.bytes
	else { console.log( data  ); console.log("data");
		throw new fsmp.exc.UnsupportedType() }
	this.index = 0
}

fsmp.Reader.prototype.read = function( count ) {
	var bytes = this.bytes.slice( this.index, this.index + count )
	this.index += count
	return bytes
}

fsmp.Reader.prototype.readAll = function() {
	return this.read( this.bytes.length - this.index )
}

fsmp.Reader.prototype.readByte = function() {
	var byte = this.bytes[ this.index ]
	this.index++
	return byte
}

fsmp.Session = function( peerCertificate ) {
	this.REMEMBER_KEYS = 2
	this.keyAgreeAlgorithm = peerCertificate.keyAgreeParams.algorithm	// The algorithm of the key agreement that is used

	this.peer = {
		certificate: peerCertificate,
		keyRing: {}	// The list of public keys for a peer
	}

	this.own = {
		keyRing: {}	// The list of key pairs that we've generated ourself
	}

	this.export = function() {
		var self = this

		return new Promise(function( success, fail ) {

			self.exportKeyRing( self.peer.keyRing ).then(function( peerBuffer ) {
			
				this.exportKeyRing( self.own.keyRing ).then(function( ownBuffer ) {

					success( new fsmp.Buffer([ peerBuffer, ownBuffer ]) )

				}).catch(function( error ) { fail( error ) })
			
			}).catch(function( error ) { fail( error ) })
		})
	}

	this.exportKeyRing = function( keyRing ) {
		var self = this
		
		return new Promise(function( success, fail ) {
			
			self._exportKeyRing( keyRing ).then(function( keyDataList ) {
				var bufferList = []
				
				for (var id in keyDataList) {
					bufferList.push( id )
					bufferList.push( keyDataList[ id ] )
				}

				success( new fsmp.Buffer( bufferList ) )

			}).catch(function( error ) { fail( error ) })
		})
	}

	this.getPeerKey = function( id ) {
		return this._getKey( this.peer.certificate, this.peer.keyRing )
	}

	this.getOwnKey = function( id ) {
		return this._getKey( this.own.certificate, this.own.keyRing )
	}

	this._exportKeyRing = function( keyRing ) {
		var id = null
		for (var i in keyRing) {
			id = i
			break
		}
		var key = keyRing[ id ]
		var subKeyRing = keyRing
		delete subKeyRing[ id ]
		
		return new Promise(function( success, fail ) {
			
			// First, export the first key in the given keyring
			window.crypto.subtle.exportKey( 'raw', key ).then(function( data ) {
				var keyData = new Uint8Array( data )

				// If this was the last or only one key, return it
				if ( keyRing.length == 1 )
					success({ id: keyData })

				// If there are other keys as well, export them the same way, and return the keyring with our exported key appended
				else {
					this._exportKeyRing( subKeyRing ).then(function( keyDataList ) {
					
						keyDataList[ id ] = keyData
						success( keyDataList )

					}).catch(function( error ) { fail( error ) })
				}

			}).catch(function( error ) { fail( error ) })
		})
	}

	this._getKey = function( certificate, keyRing, id ) {
		if ( id == 0 )	return certificate.keyAgreeParams.defaultPublicKey

		if ( id in keyRing )
			return keyRing[ id ]

		throw new Error( 'Key with id "' + id + '" not available' )
	}
}

fsmp.Store = function() {
	this.store = []

	this.add = function( key, value ) {
		this.store.push( [key, value] )
	}

	this.get = function( key ) {
		for (var i = 0; i < this.store.length; i++ ) {
			var storeItem = this.store[i]

			if ( storeItem[0].compare( key ) )
				return storeItem[1]
		}
	}
}

fsmp.SignatureParams = function( algorithm, publicKey ) {
	this.algorithm = algorithm
	this.publicKey = publicKey	// The long-term public key

	this.export = function() {
		var self = this

		return new Promise(function( success, fail ) {

			window.crypto.subtle.exportKey( 'raw', self.publicKey ).then(function( keyData ) {

				var buffer = new fsmp.Buffer([ fsmp.exportAlgorithm( self.algorithm ), fsmp.encodeUint32( keyData.byteLength ), keyData ])
				success( buffer )

			}).catch(function( error ) { fail( error ) })
		})
	}
}

fsmp.TrustSignature = function( fingerprint, trustLevel, signature ) {
	this.fingerprint = fingerprint	// The fingerprint of the certificate that created this trust-signature
	this.trustLevel = trustLevel	// A value from 0 to 255, 0 meaning complete distrust, 255 meaning complete trust
	this.signature = signature	// The signature of the certificate + trust level
}


fsmp.algorithmBlockSize = function( algorithm ) {
	if ( algorithm.name == 'AES-CBC' )
		return 16
	return -1
}

fsmp.allZeros = function( data ) {
	for (var i = 0; i < data.length; i++) {
		if (data[i] != 0)
			return false
	}

	return true
}

fsmp.bytesToString = function( data ) {
	var string = ''

	for (var i = 0; i < data.length; i++) {
		string += String.fromCharCode(i)
	}

	return string
}

fsmp.computeSharedSecret = function( algorithm, publicKey, privateKey ) {
	return new Promise(function( success, fail ) {

		var params = algorithm
		params.public = publicKey
		window.crypto.subtle.deriveBits( params, privateKey, fsmp.derivedBitLength( algorithm ) ).then(function( secret ) {

			var preparedSecret = fsmp.xorHash( secret )
		}).catch(function( error ) { fail(error) })
	})
}

// Creates an initiation message and returns it with its session cookie
fsmp.constructInitiationPacket = function( peerCertificate, ownCertificate, certificateKey, certificateChain = [], message = new Uint8Array(), paddingBlockSize = 1 ) {
	var blockSize = fsmp.algorithmBlockSize( peerCertificate.encryptionAlgorithm )
	// Padding to obscure the actual message length
	var msgPadLen = paddingBlockSize - message.length % paddingBlockSize
	// Padding to make the message's length divisable by the block size of the block cipher
	var cipherPadLen = blockSize - ( message.length + msgPadLen + fsmp.digestLength( peerCertificate.hashAlgorithm ) + 4 ) % blockSize
	var paddedMsgLen = message.length + msgPadLen + cipherPadLen

	return new Promise(function( success, fail ) {

		// First, generate a new ephemeral key pair
		window.crypto.subtle.generateKey( peerCertificate.keyExchangeParams.algorithm, true, ['deriveBits'] ).then(function( ephemeralPair ) {

			// Export the ephemeral public key
			window.crypto.subtle.exportKey( 'raw', ephemeralPair.publicKey ).then(function( ephemeralPublicKeyData ) {

				// Sign the ephemeral public key
				window.crypto.subtle.sign( ownCertificate.signatureParams.algorithm, certificateKey.longTerm, ephemeralPublicKeyData ).then(function( signature ) {
					var keyExchangeHeader = new fsmp.KeyExchangeHeader( ephemeralPair.publicKey, signature )
					
					window.crypto.subtle.digest( peerCertificate.hashAlgorithm, signature ).then(function( signatureHash ) {

						// Derive the IV from the signature
						var iv = fsmp.xorHash( signatureHash, blockSize )

						// Derive the key from the ephemeral public keys
						var params = peerCertificate.keyExchangeParams.algorithm
						params.public = peerCertificate.keyExchangeParams.defaultEphemeralPublicKey
						window.crypto.subtle.deriveBits( params, certificateKey.defaultEphemeral, fsmp.deriveBitLength( peerCertificate.keyExchangeParams.algorithm ) ).then(function( sharedSecret ) {
							var key = fsmp.xorHash( sharedSecret, blockSize )

							// Construct the body of the packet
							fsmp.hmac( peerCertificate.hashAlgorithm, key, message ).then(function( sessionCookie ) {
								var ownFingerprint = certificateChain.length == 0 ? ownCertificate.fingerprint : null
								console.log( 'padding' )
								console.log( paddedMsgLen )
								var body = new fsmp.InitiationBody( peerCertificate.fingerprint, certificateChain, ownFingerprint, sessionCookie, paddedMsgLen, message )

								// Encrypt the body
								fsmp.encryptExported( body, peerCertificate.encryptionAlgorithm, key, iv ).then(function( ciphertext ) {

									// Construct our initiation packet
									var packet = new fsmp.InitiationPacket( keyExchangeHeader, ciphertext )
									success({ packet: packet, sessionCookie: sessionCookie })

								}).catch(function( error ) { fail( error ) })
							}).catch(function( error ) { fail( error ) })
						}).catch(function( error ) { fail( error ) })
					}).catch(function( error ) { fail( error ) })
				}).catch(function( error ) { fail( error ) })
			}).catch(function( error ) { fail( error ) })
		}).catch(function( error ) { fail( error ) })
	})
}

fsmp.decodeArmor = function( name, armor ) {
	var header = '-----BEGIN FSMP ' + name.toUpperCase() + '-----'
	var footer = '-----END FSMP ' + name.toUpperCase() + '-----'
	var begin = armor.indexOf( header )
	var end = armor.indexOf( footer )

	if ( begin == -1 )	throw new Error( 'Missing armor header' )
	if ( end == -1 )	throw new Error( 'Missing armor footer' )
	
	var base64 = armor.substring( begin + header.length, end ).replace( /\n/g, '' )
	return fsmp.stringToBytes( atob( base64 ) )
}

fsmp.deriveBitLength = function( algorithm ) {
	if ( algorithm.name == 'ECDH' ) {
		if ( algorithm.namedCurve == 'P-256' )
			return 256
		if ( algorithm.namedCurve == 'P-384' )
			return 384
		if ( algorithm.namedCurve == 'P-521' )
			return 528
	}
	else
		return -1	// TODO: throw error
}

// Derives the session key from the ephemeral public- and private key
fsmp.deriveKey = function( keyExchangeAlgorithm, encryptionAlgorithm, hashAlgorithm, publicKey, privateKey ) {
	return new Promise(function( success, fail ) {

		var params = keyExchangeAlgorithm
		params.public = publicKey
		window.crypto.subtle.deriveBits( params, privateKey, fsmp.deriveBitLength( keyExchangeAlgorithm ) ).then(function( sharedSecret ) {

			window.crypto.subtle.digest( hashAlgorithm, sharedSecret ).then(function( hash ) {

				var key = fsmp.xorHash( hash, fsmp.algorithmBlockSize( encryptionAlgorithm ) )
				success( key )

			}).catch(function( error ) { fail( error ) })
		}).catch(function( error ) { fail( error ) })
	})	
}

// Like fsmp.deriveKey, but returns a promise that gives a CryptoKey
fsmp.deriveCryptoKey = function( keyExchangeAlgorithm, encryptionAlgorithm, hashAlgorithm, publicKey, privateKey ) {
	return new Promise(function( success, fail ) {

		fsmp.deriveKey( keyExchangeAlgorithm, encryptionAlgorithm, hashAlgorithm, publicKey, privateKey ).then(function( sharedKey ) {

			window.crypto.subtle.importKey( 'raw', sharedKey, encryptionAlgorithm, false, [ 'encrypt', 'decrypt' ] ).then(function( sharedCryptoKey ) {

				success( sharedCryptoKey )
			}).catch(function( error ) {fail( error )})
		}).catch(function( error ) {fail( error )})
	})
}

fsmp.digestLength = function( algorithm ) {
	if ( algorithm.name == 'SHA-1' )
		return 20
	if ( algorithm.name == 'SHA-256' )
		return 32
	if ( algorithm.name == 'SHA-384' )
		return 48
	if ( algorithm.name == 'SHA-512' )
		return 64
	return -1
}
fsmp.hashLength = fsmp.digestLength

fsmp.encodeArmor = function( name, data, maxLineLength = 64 ) {
	var buffer = data instanceof fsmp.Buffer ? data.bytes : data
	var base64 = btoa( String.fromCharCode.apply(null, buffer) )
	var body = ''
	for (var i = 0; i < base64.length; i += maxLineLength) {
		body += base64.substr( i, maxLineLength ) + '\n'
	}

	return '-----BEGIN FSMP ' + name.toUpperCase() + '-----\n' + body + '-----END FSMP ' + name.toUpperCase() + '-----'
}

fsmp.encodeUint16 = function( number ) {
	var buffer = new Uint8Array(2)
	buffer[0] = number
	buffer[1] = number << 8
	return buffer
}

fsmp.encodeUint32 = function( number ) {
	var buffer = new Uint8Array(4)
	buffer[0] = number
	buffer[1] = number << 8
	buffer[2] = number << 16
	buffer[3] = number << 24
	return buffer
}

fsmp.encrypt = function( certificate, privateKey, shortTermPublicKey, shortTermPrivateKey, plaintext ) {
	var msg = new Uint8Array( certificate.hash.length + plaintext.length )
	msg.set( certificate.hash )
	msg.set( plaintext, certificate.hash.length )

	return new Promise(function( success, fail ) {
		// Generate a new shared key
		window.crypto.subtle.deriveBits( certificate.signatureParams, shortTermPrivateKey, false, ['encrypt'] ).then(function( sharedSecret ) {

			// Hash the shared secret, this will be our key		
			window.crypto.subtle.digest( certificate.encryptionParams.keyingAlgorithm, sharedSecret ).then(function( sharedKey ) {
			
				var encryptionKey = fsmp.sizeKey( sharedKey, certificate.encryptionParams.keySize() )

				window.crypto.subtle.encrypt( certificate.encryptionParams.algorithm, msg ).then(function( ciphertext ) {
					success( ciphertext )
				})
			}).catch(function( error ) {
				fail( error )
			})
		}).catch(function( error ) {
			fail( error )
		})
	})
}

// Returns a promise that returns the encrypted ciphertext as a Uint8Array
fsmp.encryptExported = function( object, algorithm, key, iv ) {
	return new Promise(function( success, fail ) {

		// Convert key from Uint8Array to CryptoKey object
		window.crypto.subtle.importKey( 'raw', key, algorithm, false, ['encrypt'] ).then(function( keyObject ) {

			// Export the object to an Uint8Array
			object.export().then(function( exported ) {console.log('exported');console.log(exported)

				// Encrypt the thing!
				var params = algorithm
				params.iv = iv
				window.crypto.subtle.encrypt( params, keyObject, exported.bytes ).then(function( ciphertext ) {

					success( new Uint8Array( ciphertext ) )
				}).catch(function( error ) { fail( error ) })

			}).catch(function( error ) { fail( error ) })

		}).catch(function( error ) { fail( error ) })
	})
}

fsmp.encryptFirst = function( certificate, privateKey, plaintext ) {
	return fsmp.encrypt( certificate, certificate.keyAgree.defaultPublicKey )
}

fsmp.exportAlgorithm = function( algorithm ) {
	if ( algorithm.name == 'ECDSA' )
		return new fsmp.Buffer([ algorithm.name, 0, algorithm.namedCurve, 0, algorithm.hash.name, 0 ])
	else if ( algorithm.name == 'ECDH' )
		return new fsmp.Buffer([ algorithm.name, 0, algorithm.namedCurve, 0 ])
	else if ( [ 'AES-CBC', 'SHA-1', 'SHA-256', 'SHA-368', 'SHA-512' ].indexOf( algorithm.name ) != -1 )
		return new fsmp.Buffer( algorithm.name, 0 )
	
	throw new Error( 'Unsupported Algorithm: ' + algorithm.name )
}

fsmp.generateCertificate = function( signatureAlgorithm, keyAgreeAlgorithm, encryptionAlgorithm, hashAlgorithm, fingerprintAlgorithm ) {
	
	return new Promise( function( success, fail ) {

		// Generate a new long term key pair
		window.crypto.subtle.generateKey( signatureAlgorithm, true, ['sign', 'verify'] ).then(function( longTermKeyPair ) {
			
			var signatureParams = new fsmp.SignatureParams( signatureAlgorithm, longTermKeyPair.publicKey )

			// Generate a new short term key pair
			window.crypto.subtle.generateKey( keyAgreeAlgorithm, true, ['deriveBits'] ).then(function( shortTermKeyPair ) {

				var keyAgreeParams = new fsmp.KeyExchangeParams( keyAgreeAlgorithm, shortTermKeyPair.publicKey )
				var certificate = new fsmp.Certificate( signatureParams, keyAgreeParams, encryptionAlgorithm, hashAlgorithm, fingerprintAlgorithm )
				console.log('gerwitittere')
				console.log( encryptionAlgorithm )
				console.log( certificate )
				console.log( certificate.encryptionAlgorithm )
				var privateKey = new fsmp.CertificateKey( longTermKeyPair.privateKey, shortTermKeyPair.privateKey )

				certificate.sign( privateKey ).then(function( signature ) {
					certificate.signature = signature

					certificate.calculateFingerprint().then(function( fingerprint ) {
						certificate.fingerprint = fingerprint

						success({ certificate: certificate, key: privateKey })

					}).catch(function( error ) {
						fail( error )
					})
				}).catch(function( error ) {
					fail( error )
				})
			}).catch(function( error ) {
				fail( error )
			})
		}).catch(function( error ) {
			fail( error )
		})
	})
}

fsmp.hmac = function( hashAlgorithm, key, message ) {
	var length = fsmp.digestLength( hashAlgorithm )
	var hmacAlgorithm = {
		name: 'HMAC',
		hash: hashAlgorithm
	}
	console.log( hmacAlgorithm )

	return new Promise(function( success, fail ) {

		window.crypto.subtle.importKey( 'raw', key, hmacAlgorithm, false, ['sign'] ).then(function( keyObject ) {
			
			window.crypto.subtle.sign( hmacAlgorithm, keyObject, message ).then(function( signature ) {

				success( new Uint8Array(signature) )

			}).catch(function( error ) { fail( error ) })
		}).catch(function( error ) { fail( error ) })
	})
}

fsmp.importInitiationBody = function( data, certificate ) { console.log('log'); console.log( data ); alert('hoi')
	var reader = new fsmp.Reader( data )

	var hashLen = fsmp.hashLength( certificate.hashAlgorithm )

	var receipientFingerprint = reader.read( hashLen )
	if ( receipientFingerprint != certificate.fingerprint )
		throw new fsmp.exc.IncorrectReceipient()

	var certificateListSize = reader.readByte()
	var certificateList = []
	for (var i = 0; i < certificateListSize; i++) {
		// TODO: Convert to promise!
		var certificate = fsmp.readCertificate( reader )
		certificateList.push( certificate )
	}

	var fingerprint = null
	if ( certificateListSize == 0 )
		fingerprint = reader.read( hashLen )

	var regularBody = fsmp.readBody( reader )
	
	return new fsmp.InitiationBody( receipientFingerprint, certificateList, fingerprint, regularBody.cookie, regularBody.padLength, regularBody.message )
}

// Decrypts the message that is contained within it, a high-level function
// All the session handling is dealt with
// Returns a body, be it a regular or initiation body
fsmp.openPacket = function( data, certificate, certificateKey ) {
	var reader = new fsmp.Reader( data )

	var sniffed = fsmp.sniffPacket( reader )
	var cookie = sniffed.cookie
	if ( cookie.length != 0 )	// TODO: Find the session of this cookie and use it to open the packet
		throw new Error( 'Regular messages are not implemented yet' )

	if ( cookie.length == 0 ) {
		var signatureAlgorithm = certificate.signatureParams.algorithm
		var keyExchangeAlgorithm = certificate.keyExchangeParams.algorithm
		var hashAlgorithm = certificate.hashAlgorithm
		var encryptionAlgorithm = certificate.encryptionAlgorithm
		var ephemeralPrivateKey = certificateKey.defaultEphemeral
	}
	// TODO: Else, take the ephemeral public key from the session
console.log('certificate')
console.log( encryptionAlgorithm )

	var keyExchangeHeader = fsmp.readKeyExchangeHeader( reader, keyExchangeAlgorithm, signatureAlgorithm )
	var ciphertext = reader.readAll()

	return new Promise(function( success, fail ) {
		console.log( window.crypto.subtle.importKey )
		window.crypto.subtle.importKey( 'raw', keyExchangeHeader.ephemeralPublicKey, certificate.keyExchangeParams.algorithm, false, ['deriveKey'] ).then(function( ephemeralPublicKey ) {

			fsmp.deriveCryptoKey( keyExchangeAlgorithm, encryptionAlgorithm, hashAlgorithm, ephemeralPublicKey, ephemeralPrivateKey ).then(function( sharedKey ) {
				console.log(sharedKey)
				console.log( encryptionAlgorithm )
				console.log( ciphertext )
				window.crypto.subtle.decrypt( encryptionAlgorithm, sharedKey, ciphertext ).then(function( bodyData ) {
				console.log(bodyData)
					if ( cookie.length != 0 ) {
						var body = fsmp.importBody( bodyData )
						success( body )
					}
					else {
						var body = fsmp.importInitiationBody( bodyData )
						success( body )
					}

				}).catch(function( error ) { fail( error ) })
			}).catch(function( error ) { fail( error ) })
		}).catch(function( error ) { fail( error ) })
	})
}

fsmp.publicKeyLength = function( algorithm ) {

	if ( algorithm.name == "ECDSA" || algorithm.name == "ECDH" ) {
		if ( algorithm.namedCurve == 'P-521' )
			return 133;
		else if ( algorithm.namedCurve == 'P384' )
			return 97;
		else if ( algorithm.namedCurve == 'P256' )
			return 65;
	}
	// TODO: Correct these lengths...
}

fsmp.readInitiationPacket = function( reader, sessionCookie, certificate ) {

	
	return new Promise(function( success, fail ) {

		// Import the ephemeral key
		window.crypto.subtle.importKey( 'raw', certificate.keyExchangeParams.algorithm, ephemeralPublicKeyData, false, ['deriveBits'] ).then(function( ephemeralPublicKey ) {
		
			var packet = new Packet( sessionCookie, new fsmp.KeyExchangeHeader( ephemeralPublicKey, signatureData ), version )
			success( packet )

		}).catch(function( error ) { fail( error ) })
	}) 
}

fsmp.openInitiationPacket = function( packet, certificate, certificateKey ) {

	// Generate shared secret
	fsmp.deriveKey( certificate.keyExchangeParams.algorithm, certificate.encryptionAlgorithm, certificate.hashAlgorithm, packet.keyExchangeHeader.ephemeralPublicKey, certificateKey.defaultEphemeral ).then(function( key ) {
		window.crypto.subtle.decrypt( certificate.encryptionAlgorithm, key, packet.ciphertext ).then(function( bodyData ) {

			var body = fsmp.importInitiationBody( bodyData )
			// TODO: Verify the signature of the packet's ephemeral public key
		})//.catch(
	})
}

fsmp.randomBytes = function( length ) {
	var bytes = new Uint8Array( length )
	window.crypto.getRandomValues( bytes )
	return bytes
}

fsmp.randomKey = function( algorithm ) {
	
	var key = Uint8Array( 256 )	// TODO: Fetch key length from algorithm
	window.crypto.getRandomValues( key )

	// If the key turns out to be only zeros (small chance, but possible), generate another one.
/*	while ( fsmp.allZeros( key ) ) {
		window.crypto.getRandomValues( key )
	}*/

	return window.crypto.subtle.importKey( 'raw', key, algorithm, true, ['encrypt', 'decrypt'] )
}

fsmp.readBody = function( reader, hashLength ) {
	var cookie = reader.read( hashLength )
	var padLength = reader.read( 4 )
	var message = reader.readAll()
	
	return new fsmp.Body( cookie, padLength, message )
}

fsmp.readKeyExchangeHeader = function( reader, keyExchangeAlgorithm, signatureAlgorithm ) {
	var ephemeralPublicKeyLen = fsmp.publicKeyLength( keyExchangeAlgorithm )
	var signatureLen = fsmp.hashLength( signatureAlgorithm.hash )

	var ephemeralPublicKey = reader.read( ephemeralPublicKeyLen )
	var signature = reader.read( signatureLen )

	return { ephemeralPublicKey: ephemeralPublicKey, signature: signature }
}

fsmp.sniffPacket = function( reader ) {

	var version = reader.readByte()
	var cookieLen = reader.readByte()
	var cookie = reader.read( cookieLen )

	return { version: version, cookie: cookie }
}

fsmp.stringToBytes = function( string ) {
	var buffer = new Uint8Array( string.length )

	for (var i = 0; i < string.length; i++) {
		buffer[i] = string.charCodeAt(i)
	}

	return buffer
}

fsmp.trustStore = {
	store: [],

	
}

// Creates a new buffer of specified length that is created by xoring the given data over and over or repeating the given data over and over
fsmp.xorHash = function( data, length ) {
	var hash = new Uint8Array( length )

	if ( data.length >= length ) {
		for (var i = 0; i < data.length; i++) {
			hash[ i % length ] ^= data[i]
		}
	}
	else {
		for (var i = 0; i < length; i++) {
			hash[ i ] = data[ i % data.length ]
		}
	}

	return hash
}
