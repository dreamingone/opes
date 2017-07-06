var inbox = []
var open_email_id = null
var open_email = null
var openpgp = window.openpgp
var composition_dialog = new CompositionDialog()
var keypair_dialog = new Dialog( 'keypair' )
var keypair_generate_dialog = new Dialog( 'keypair-generate' )
var passphrase_dialog = new PassphraseDialog( 'passphrase' )


document.onload = load()

function Dialog( element_id ) {
	this.elementId = element_id
	this.element = document.getElementById( element_id )

	this.onDone = function() {}

	this.done = function() {
		if ( this.onDone() != false )
			this.hide()
	}
	
	this.hide = function() {
		document.getElementById( this.elementId ).style.display = 'none'
	}

	this.show = function() {
		this.element.style.display = 'block'
	}

	this.use = function( on_done ) {
		this.onDone = on_done
		this.show()
	}
	
	this.hide()
}

function CompositionDialog() {
	this.__proto__ = new Dialog( 'composition' )

	this.compose = function( to, subject, body ) {
		document.getElementById('comp-from').value = 'myusername@dreaming.one'
		document.getElementById('comp-to').value = to
		document.getElementById('comp-subject').value = subject
		document.getElementById('comp-body').value = body
		this.show()
	}
}

function PassphraseDialog() {
	this.__proto__ = new Dialog( 'passphrase-dialog' )

	this.onPassphrase = function(pass) {}

	this.getPassphrase = function( on_pass ) {
		this.onPassphrase = on_pass

		this.onDone = function() {
			var passphrase = document.getElementById('passphrase').value
			this.onPassphrase( passphrase )
		}
		this.show()
	}
}

function InboxItem( id, email, is_encrypted, is_new ) {
	this.id = id
	this.email = email
	this.isEncrypted = is_encrypted
	this.isNew = is_new

	this.html = function() {
		var str = '<a id="item-' + this.id + '" class="item'
		if (!this.isEncrypted)
			str += ' not-encrypted'
		if (this.isNew)
			str += ' new'
		str += '" onclick="javascript:onInboxItemClick(this)" emailid="' + this.id + '">'

		str += '<div class="subject">'
		if ( 'subject' in this.email.headers )
			str += textToHtml(this.email.headers['subject'])
		str += '</div>'

		str += '<span class="from">'
		if ( 'from' in this.email.headers )
			str += textToHtml(this.email.headers['from'])
		str += '</span>'

		str += ' - <span class="date">'
		if ( 'date' in this.email.headers )
			str += this.email.headers['date']
		str += '</span>'

		str += '</div>'
		return str
	}
}


function decryptPgp( msg, passphrase, on_done ) {
	var private_key_armor = localStorage.getItem( 'private-key' )
	var private_key = openpgp.key.readArmored( private_key_armor )

	openpgp.decryptKey({ privateKey: private_key.keys[0], passphrase: passphrase }).then(function(decrypted_key){

		var options = {
			message: openpgp.message.readArmored( msg ),
			privateKey: decrypted_key.key,
			format: 'utf8'
		}
		openpgp.decrypt(options).then(function( result ){
			on_done( result.data )
		}).catch(function( error ){
			alert('Unable to decrypt PGP message!\n' + error)
		})
	}).catch(function( error ){
		alert("Unable to decrypt private key!\n" + error)
		console.log( JSON.stringify(private_key) )

		passphrase_dialog.getPassphrase( function(passphrase) {
			decryptPgp( msg, passphrase, on_done )
		} )
	})
}

function deleteEmail( id ) {
	// Delete from inbox index
	for (var i = 0; i < inbox.length; i++) {
		if ( inbox[i].id == id ) {
			inbox.splice( i, 1 )
			break;
		}
	}

	// Delete from DOM
	var element = document.getElementById( 'item-' + id )
	if ( element != null )
		element.parentNode.removeChild( element )

	document.getElementById( 'message' ).innerHTML = ''
}

function headerToHtml( name, value ) {
	return '<span class="header">' + name + ':</span> <span class="value">' + textToHtml( value ) + '</span><br/>'
}

function emailMessageHtml( email ) {
	var html = ''

	if ('from' in email.headers)
		html += headerToHtml( 'From', email.headers['from'] )
	if ('reply-to' in email.headers)
		html += headerToHtml( 'Reply-To', email.headers['reply-to'] )
	if ('to' in email.headers)
		html += headerToHtml( 'To', email.headers['to'] )
	if ('cc' in email.headers)
		html += headerToHtml( 'CC', email.headers['cc'] )
	if ('subject' in email.headers)
		html += headerToHtml( 'Subject', email.headers['subject'] )
	if ('bcc' in email.headers)
		html += headerToHtml( 'BCC', email.headers['bcc'] )
	if ('date' in email.headers)
		html += headerToHtml( 'Date', email.headers['date'] )
	
	html += '<div class="all-headers">'
	for ( name in email.headers ) {
		html += headerToHtml( name, email.headers[ name.toLowerCase() ] )
	}
	html += '</div>'

	html += '<div class="body">'
	html += emailToHtml( email )
	html += '</div>'

	return html
}

function emailToHtml( email ) {

	// If no Content-Type header is available, assume text/plain
	if (!('content-type' in email.headers))
		return textToHtml( email.payload )

	var p_content_type = mime.parseContentType( email.headers['content-type'] )
	var content_type = p_content_type.contentType

	if (content_type == 'text/plain')
		return textToHtml( email.payload )
	else if (content_type == 'text/html')
		return filterHtml( email.payload )
	else if (content_type == 'multipart/alternative') {
		var html = 'Unsupported MIME types!'
		var is_html = true

		for (var i = 0; i < email.payload.length; i++) {
			var part = email.payload[i]

			if ( 'content-type' in part.headers ) {
				var p_part_content_type = mime.parseContentType( part.headers['content-type'] )
				var part_content_type = p_part_content_type.contentType

				if ( part_content_type == 'text/html' && is_html ) {
					html = part.decode()
				}
				else if ( part_content_type == 'text/plain' ) {
					html = textToHtml(part.decode())
					is_html = false
				}
			}
		}

		return html
	}
	
	return 'Unsupported MIME type!'		
}

function generateKeyPair() {
	var num_bits = parseInt( document.getElementById( 'key-bits' ).value )
	var passphrase = document.getElementById( 'key-passphrase' ).value

	if ( passphrase.length == 0 && !confirm( 'Are you sure you want to use no password? This makes it easy for attacker to fetch your private key from your browser\'s data storage.' ) )
		return

	var options = {
		userIds: [{ name: 'myusername', email: 'myusername@dreaming.one' }],
		numBits: num_bits,
		passphrase: passphrase
	}
	openpgp.generateKey(options).then( function( key ) {
		var public_key = key.publicKeyArmored
		var private_key = key.privateKeyArmored

		var public_key_element = document.getElementById( 'public-key' )
		public_key_element.value = public_key
		var private_key_element = document.getElementById( 'private-key' )
		private_key_element.value = private_key

		keypair_generate_dialog.hide()
		document.getElementById( 'keypair-generate-loader' ).style.display = 'none'
	} )

	document.getElementById( 'keypair-generate-loader' ).style.display = 'block'
}

function getPassphrase( on_pass ) {
	var passphrase = sessionStorage.getItem( 'passphrase' )
	if ( passphrase != null )
		on_pass( passphrase )

	else {
		if (localStorage.getItem('private-key') != null && localStorage.getItem('private-key') != '') {
			passphrase_dialog.getPassphrase( on_pass )
		}
		else {
			alert( 'In order to start decrypting your mail, you need to setup a PGP key pair.' )
			keypair_dialog.use( function() {
				// If still no key pair has been generated, show dialog again
				if ( localStorage.getItem('public-key') == null || localStorage.getItem('public-key') == '' ||
					localStorage.getItem('private-key') == null || localStorage.getItem('private-key') == '' ) {
					alert( 'The PGP key pair is required!' )
					return false
				}
			
				passphrase_dialog.getPassphrase( on_pass )
			} )
		}
	}
}

function inboxItemById( id ) {
	for ( var i = 0; i < inbox.length; i++ ) {
		if (inbox[i].id == id)
			return inbox[i]
	}

	return null
}

function textToHtml( text ) {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
}

function load() {
	loadInbox()
	loadKeyPair()
}

function loadInbox() {
	getPassphrase( function( passphrase ) {
		request( '/poll', function( status, response ) { processPoll( status, response, passphrase ) } )
	} )
}

function loadKeyPair() {
	var public_key = localStorage.getItem( 'public-key' )
	var private_key = localStorage.getItem( 'private-key' )

	document.getElementById('public-key').value = public_key
	document.getElementById('private-key').value = private_key
}

function loadOpenpgpJs() {
	openpgp.initWorker({ path: '/static/openpgp.worker.js' })
}

function onCompose() {
	composition_dialog.compose( '', '', '' )
}

function onForward() {
	var subject = 'subject' in open_email.headers ? open_email.headers['subject'] : ''
	var body = "Forwarding still under construction. Use copy/pasta techniques for now..."

	composition_dialog.compose( '', 'FW: ' + subject, body )
}

function onReply() {
	var from = 'from' in open_email.headers ? open_email.headers['from'] : ''
	if ('reply-to' in open_email.headers)
		from += ', ' + open_email.headers['reply-to']
	var subject = 'subject' in open_email.headers ? open_email.headers['subject'] : ''
	var body = "Reply mechanism still under construction. Use copy/pasta techniques for now..."

	composition_dialog.compose( from, 'RE: ' + subject, body )
}

function onInboxItemClick( e ) {
	var id = e.getAttribute('emailid')

	var item = inboxItemById( id )

	open_email_id = id
	open_email = item.email
	updateMessageElement( item.email )
}

function onDelete() {
	if (open_email_id == null)
		alert( 'Open email first!' )

	else {
		request( '/delete?id=' + open_email_id, function (status, response) {
			if ( status == 200 ) {
				deleteEmail( open_email_id )
				open_email_id = null
				open_email = null
			}
			else
				alert( 'Unable to delete email: ' + response )
		}, '' )
	}
}

function onPassphraseUse() {
	var passphraseElement = document.getElementById('passphrase')
	var passphrase = passphraseElement.value
	passphraseElement.value = ''

	var rememberElement = document.getElementById('remember-passphrase')
	if ( rememberElement.checked )
		sessionStorage.setItem( 'passphrase', passphrase )

	passphrase_dialog.onPassphrase( passphrase )
	passphrase_dialog.hide()
}

function onSaveKeyPair() {
	saveKeyPair().then(function(){	
		keypair_dialog.done()
	}).catch(function(status){
		alert('Unable to save key pair, status code: ' + status)
	})
}

function onSend() {
	var from = document.getElementById('comp-from').value
	var to = document.getElementById('comp-to').value
	var cc = document.getElementById('comp-cc').value
	var bcc = document.getElementById('comp-bcc').value
	var body = document.getElementById('comp-body').value

	data = 'from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to) + '&cc=' + encodeURIComponent(cc) + '&bcc=' + encodeURIComponent(bcc) + '&body=' + encodeURIComponent(body)

	request( '/send', function( status, response ) {
		if ( status == 200 )
			composition_dialog.done()
		else {
			alert( 'Unable to send mail: ' + response )
		}
	}, data );
}

function processEmails( emails, is_new ) {

	for ( var id in emails ) {
		var email = atob( emails[id] )	// Decode Base64

		var msg = mime.parseMessage( email )
		alert( JSON.stringify(msg) )
		if ( 'from' in msg.headers &&  msg.headers['from'] == 'pgp' )
			decryptPgp( msg.payload, passphrase, function( decrypted ) {
				alert( decrypted )
				var mimed = mime.parseMessage( decrypted )
				inbox.push( new InboxItem( id, mimed, true, is_new ) )
				refreshInboxElement()
			} )
		else
			inbox.push( new InboxItem( id, msg, false, is_new ) )
	}

	refreshInboxElement()
}

function processPoll( status, response, passphrase ) {
	if ( status != 200 )
		alert( "Unable to load inbox.\nError: " + status )

	r = JSON.parse( response )

	inbox = []
	processEmails( r['new'], true )
	processEmails( r['cur'], false )
}

function refreshInboxElement() {
	var inboxElement = document.getElementById('inbox')
	inboxElement.innerHTML = ''

	for ( var i = 0; i < inbox.length; i++ ) {
		var item = inbox[i]

		inboxElement.innerHTML += item.html()
	}
}

function request( url, response_handler = null,  data = null ) {
	method = data != null ? 'POST' : 'GET'

	obj = new XMLHttpRequest()
	obj.open( method, url, response_handler != null );
	if ( response_handler != null )
		obj.onreadystatechange = function() {
			if ( obj.readyState == 4 )
				response_handler( obj.status, obj.responseText )
		}
	if (data == null)
		obj.send()
	else
		obj.send(data)
}

function saveKeyPair() {
	var public_key = document.getElementById('public-key').value
	var private_key = document.getElementById('private-key').value

	return new Promise( function(resolve, reject) {
		request( '/update-key', function(status, response) {
			if ( status != 200 )
				reject( status )

			else {	
				localStorage.setItem( 'public-key', public_key )
				localStorage.setItem( 'private-key', private_key )
				resolve()
			}
		}, public_key )
	} )
}

function updateMessageElement( email ) {
	var el = document.getElementById( 'message' )
	
	el.innerHTML = emailMessageHtml( email )
}
