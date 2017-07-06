// This is a reference implementation for the Forward-Secret Messaging Protocol (FS4J)
// This implementation uses the Web Cryptography API.

// Namespaces
var fsmp = {}
fsmp.exc = {}


// Exceptions
fs4j.exc.type = {
	success: 0,
	unknown: 1,
	missingSupport: 2,
	missingAlgorithms: 3,
	algorithmNotSupported: 4
}

// The certificate contains:
// * All signature algorithms supported by the certificate owner and their public keys
// * All short-term key agreement algorithms that are supported by the owner
// * All encryption ciphers supported by the owner
fsmp.Certificate = function( signatureParams, keyAgreeParams, encryptionParams, hash ) {
	this.signatureParams = longTermParams,
	this.keyAgreeParams = keyAgreeParams
	this.encryptionParams = encryptionParams
	this.hash = hash

	// Encrypt a message without a short-term key.
	this.encrypt = function( data, algorithm ) {
		return new Promise( function( success, fail ) {
			var key = this.longTerm

			window.crypto.subtle.encrypt( signature.algorithm, key, data ).then(function( ciphertext ){
				success( ciphertext )
			}).catch(function(reason) {
				fail( reason )
			})
		} )
	}
}

fsmp.SignatureParams = function( algorithm, publicKey ) {
	this.algorithm = algorithm
	this.publicKey = publicKey	// The long-term public key
}

fsmp.KeyAgreeParams = function( algorithm, defaultPublicKey ) {
	this.algorithm = algorithm
	this.defaultPublicKey = defaultPublicKey	// The public key to use when no session has been created (yet)
}

fsmp.EncryptionParams = function( algorithm, keyingAlgorithm ) {
	this.algorithm = algorithm
	this.keyingAlgorithm = keyingAlgorithm
}

fsmp.Message = function( version, nextShortTermPublicKey, signature, data ) {
	this.version = version
	this.nextShortTermPublicKey = nextShortTermPublicKey
	this.signature = signature
	this.ciphertext = data
}

fsmp.encrypt = function( certificate, privateKey, shortTermPublicKey, shortTermPrivateKey, plaintext ) {
	var msg = new Uint8Array( certificate.hash.length + plaintext.length )
	msg.set( certificate.hash )
	msg.set( plaintext, certificate.hash.length )

	return new Promise(function( success, fail ) {
		// Generate a new shared key
		window.crypto.subtle.deriveBits( certificate.signatureParams, shortTermPrivateKey, false, ['encrypt'] )
		.then(function( sharedSecret ) {

			// Hash the shared secret, this will be our key		
			window.crypto.subtle.digest( certificate.encryptionParams.keyingAlgorithm, sharedSecret )
			.then(function( sharedKey ) {
			
				var encryptionKey = fsmp.sizeKey( sharedKey, certificate.encryptionParams.keySize() )

				window.crypto.subtle.encrypt( certificate.encryptionParams.algorithm, msg )
				.then(function( ciphertext ) {
					success( ciphertext )
				})
			})
			.catch(function( error ) {
				fail( error )
			})
		})
		.catch(function( error ) {
			fail( error )
		})
	})
}

fsmp.encryptMessage( certificate, privateKey, shortTermPublicKey, shortTermPrivateKey, plaintext ) {
	// TODO: Sign the next short-term-public-key
	// TODO: Encrypt the plain text
}

fsmp.encryptFirst = function( certificate, privateKey, message ) {
	return fsmp.encrypt( certificate, certificate.keyAgree.defaultPublicKey )
}

fs4j.PrivateKey = function( algorithm, key ) {
	this.algorithm = algorithm
	this.key = key


	this.sign = function( data ) {
		return new Promise( function( success, fail ) {
			window.crypto.subtle.sign( this.algorithm, this.key, data ).then( function( signature ) {
				success( new fs4j.Signature( algorithm, signature ) )
			} ).catch( function( reason ) {
				fail( reason )
			} )
		} );
	}
}

fs4j.Session = function( certificate, lastKeyagreePublic ) {
	this.certificate = certificate
	this.lastKeyagreePublic = lastKeyagreePublic
}

fs4j.Signature = function( algorithm, data ) {
	this.algorithm = algorithm
	this.data = data
}

// The encryption function intended for the first message that is not yet PFS
fs4j.encryptInitial = function( message, certificate, privateKey ) {
	
	return new Promise( function( success, fail ) {
		
		var signAlg = certificate.findBestSignatureAlgorithm()
		var keyagreeAlg = certificate.findBestSignatureAlgorithm()
		var cryptAlg = certificate.findBestCryptAlgorithm()
		var keySize = 16	// TODO: change this depending on the algorithm

		// Generate a new keyagreement keypair
		window.crypto.subtle.generateKey( keyagreeAlg, 

		// Create a random key
		fs4j.randomKey( cryptAlg, keySize ).then(function( key ) {

			// Encrypt message
			var cryptData = fs4j.prepareCryptData( cryptAlg )
			window.crypt.subtle.encrypt( cryptData, key, message ).then(function( ciphertext ){
	
				// Encrypt key
				certificate.encrypt( key, cryptAlg ).then(function( cryptedKey ) {
					
					// Format the whole message
					// The initial message can be characterized by the missing algs.keyagree field
					var cryptedMessage = {
						algs: {
							sign: signAlg,
							crypt: cryptAlg
						},
						agree: ,
						secret: cryptedKey,	// The key encrypted with the signature algorithm
						body: ciphertext	// The message encrypted with the crypt algorithm
					}

					success( cryptedMessage )
				}).catch(function( reason ){
					fail( reason )
				})
			}).catch(function( reason ){
				fail( reason )
			})
		}).catch(function( reason ) {
			fail( reason )
		})		
	} )
}

// The encryption function intended for any message after the first one, that is intended to implement forward-secrecy
fs4j.encryptFollowing = function( message, certificate, privateKey ) {
	
	return new Promise( function(success, fail) {
		
		var signAlg = certificate.findBestSignatureAlgorithm()
		var cryptAlg = certificate.findBestCryptAlgorithm()
		var keySize = 16	// TODO: change this depending on the algorithm

		
	})
}

// TODO: Make this function test the availability of the algorithm!
fs4j.findAvailableEncryptionAlgorithms = function() {
	return [ 'AES-CBC' ]
}
fs4j.findAvailableKeyagreeAlgorithms = function() {
	return [ 'ECDH' ]
}
fs4j.findAvailableSignatureAlgorithms = function() {
	return [ 'RSA-OAEP' ]
}

// Initializes the library and throws errors
fs4j.load = function() {
	if ( !window.crypto or !window.crypto.subtle )
		throw fs4j.exc.missingSupport( 'The Web Cryptography API' )

	fs4j.signatureAlgorithms = fs4j.findAvailableSignatureAlgorithms()
	if ( fs4j.signatureAlgorithms.length == 0 )
		throw fs4j.exc.missingAlgorithms( 'signature' )

	fs4j.keyagreeAlgorithms = fs4j.findAvaialableKeyagreeAlgorithms()
	if ( fs4j.keyagreeAlgorithms.length == 0 )
		throw fs4j.exc.missingAlgorithms( 'key agreement' )

	fs4j.encryptionAlgorithms = fs4j.findAvaialableEncryptionAlgorithms()
	if ( fs4j.keyagreeAlgorithms.length == 0 )
		throw fs4j.exc.missingAlgorithms( 'encryption' )
}

fs4j.prepareCryptData = function( algorithm ) {
	if ( algorithm == 'AES-CBC' ) {
		var iv = UInt8Array( 16 )
		return { name: algorithm, iv: iv }
	}
	else
		throw fs4j.exc.unknown( 'Unknown algorithm given: ' + algorithm )
}

fs4j.randomKey = function( algorithm, length ) {

	var key = Uint8Array( length )
	window.crypto.getRandomValues( key )

	return window.crypto.subtle.importKey( 'raw', key, algorithm, true, ['encrypt', 'decrypt'] )
}

fs4j.exc.algorithmNotSupported = function( algorithm ) {
	return {
		type: fs4j.exc.type.algorithmNotSupported,
		algorithm: algorithm,
		message: function() {
			return 'Algorithm ' + this.algorithm + ' no supported'
		}
	}
}

fs4j.exc.missingAlgorithms = function( algs_type ) {
	return {
		type: fs4j.exc.type.missingAlgorithms,
		algs_type: algs_type,
		message: function() {
			return 'No ' + this.algs_type + ' algorithms found'
		}
	}
}

fs4j.exc.missingSupport = function( func ) {
	return {
		type: fs4j.exc.type.missingSupport,
		func: func,
		message: function() {
			return this.func + ' is required, but not available'
		}
	}
}

fs4j.exc.unknown = function( msg ) {
	return {
		type: fs4j.exc.type.unknown,
		msg: msg,
		message: function() {
			return this.msg
		}
}

