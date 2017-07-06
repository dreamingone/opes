var mail = new osms.MAIL()
var dialogues = {}
var folderNames = {
	drafts: 'Drafts',
	sent: 'Sent',
	trash: 'Trash'
}
var lastDownloadDate = new Date(0);
var currentDialogue = null
var settings = {
	debug: true,
	domain: 'dreaming.one',
	username: 'info'
}

window.onload = load()


// A Dialogue is a list of messages that are in reply to eachother.
// It could also be termed a conversation for that matter.
function Dialogue( originalId, messages = [] ) {
	this.originalId = originalId
	this.messages = messages

	this.add = function( message ) {

		// First find the message that this message is a reply to
		for ( var i = 0; i < this.messages.length; i++ ) {
			if ( message.inReplyTo == this.messages[i] ) {

				// Find the first message that is not a reply to that message or that is older than this one
				for ( ; i < this.messages.length; i++ ) {

					if ( message.inReplyTo != this.messages[i].inReplyTo || message.date.getTime() < this.messages[i].getTime() ) {

						this.messages.splice( i, 0, message )
						return 
					}
				}
			}
		}

		// If not already inserted somewhere, insert it at the end
		this.messages.push( message )
	}

	this.last = function() {
		return this.messages[ this.messages.length - 1 ]
	}

	this.meta = function() {
		var lastMsg = this.last()

		return new Meta( this.originalId, lastMsg.realSubject(), lastMsg.from, lastMsg.date )
	}
}

// The Dialogues class is the central store of all dialogues
function Dialogues() {
	this.store = []

	this.at = function( index ) {
		return this.store[ index ]
	}

	this.get = function( id ) {
		return this.store[ this._find(id) ]
	}

	this.create = function( id, firstMessage ) {

		var dialogue = new Dialogue( id, [ firstMessage ] )
		this.store.push( dialogue )
	}

	this.create2 = function( id, firstMessage, secondMessage ) {
		var dialogue = new Dialogue( id, [ firstMessage, secondMessage ] )
		this.store.push( dialogue )
	}

	this.exists = function( id ) {
		return this._find( id ) != -1
	}
	
	this._find = function( id ) {
		for ( var i = 0; i < this.store.length; i++ ) {
			if ( this.store[i].originalId == id )
				return i
		}

		return -1
	}

	this.size = function() {
		return this.store.length
	}
}

function Meta( id, subject, from, date ) {
	this.id = id
	this.subject = subject
	this.from = from
	this.date = date

	this.html = function() {
		var str = '<a class="mail-item"'
		str += ' onclick="javascript:onDialogueItemClick(this)" dialogueid="' + this.id + '">'

		str += '<div class="subject">'
		if ( this.subject != null )
			str += textToHtml( this.subject )
		str += '</div>'

		str += '<span class="from">'
		if ( this.from != null )
			str += textToHtml( this.from )
		str += '</span>'

		str += ' - <span class="date">'
		if ( this.date != null )
			str += textToHtml( dateString( this.date ) )
		str += '</span>'

		str += '</a>'
		return str
	}
}

function Window( element_id ) {
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

// The Store is the place where all messages are stored.
function Store() {
	this.store = []

	this.add = function( message ) {
		//if ( typeof message != 'Message' )
			if ( this.messageById( message.id ) == null )
				this.store.push( message )
		//else
		//	throw 'Argument should be of type Message'
	}

	this.constructDialogues = function() {
		var dialogues = new Dialogues()

		for ( var i = 0; i < this.store.length; i++ ) {
			var message = this.store[i]
			var originalId = message.originalId()

			var dialogue = dialogues.get( originalId )
			if ( dialogue != null )
				dialogue.add( message )
			else {
				if ( !message.fromSent && !message.fromTrash && !message.fromDrafts )	// Only construct dialogues from re
					dialogues.create( originalId, message )
				else if ( message.inReplyTo != null )
					dialogues.create2( originalId, message, message.inReplyTo )
			}
		}

		return dialogues
	}

	this.load = function() {
		var stored = localStorage.getItem( 'store' )
		if ( stored != null ) {
			var msgObjs = JSON.parse( stored )

			for ( var i = 0; i < msgObjs.length; i++ ) {
				var msgObj = msgObjs[i]
				var date = msgObj[4] != null ? new Date( parseInt( msgObj[4] ) ) : null
				var msg = new Message( msgObj[0], msgObj[1], msgObj[2], msgObj[3], date, msgObj[5] )

				this.store.push( msg )
			}
		}

		this.updateDialogues()
	}

	// Finds a message in the store that contains the given id
	this.messageById = function( id ) {
		for ( var i = 0; i < this.store.length; i++ ) {

			if ( this.store[i].id == id )
				return this.store[i]
		}

		return null
	}

	this.save = function() {
		var msgObjs = []

		for (var i = 0; i < this.store.length; i++) {
			var msg = this.store[i]
			var msgObj = [
				msg.imapPath,
				msg.id,
				msg.subject,
				msg.from,
				msg.date != null ? msg.date.getTime() : null,
				msg.inReplyToId
			]

			msgObjs.push( msgObj )
		}

		localStorage.setItem( 'store', JSON.stringify( msgObjs ) )
	}

	this.sort = function() {
		this.store.sort( this.sortFunction )
	}

	this.sortFunction = function( a, b ) {

		if ( a.date == null ) {
			return b.date == null ? 0 : 1
		}

		if ( b.date == null || a.date.getTime() > b.date.getTime() )
			return -1
		else if ( a.date.getTime() < b.date.getTime() )
			return 1
		return 0
	}

	// Update each message so that it references to the message it is a reply for and so that that message references back as well
	this.updateDialogues = function() {
		
		for ( var i = 0; i < this.store.length; i++ ) {
			var message = this.store[i]

			if ( message.inReplyToId != null ) {
				message.inReplyTo = this.messageById( message.inReplyToId )
			
				if ( message.inReplyTo != null )
				message.inReplyTo.isRepliedWith.push( message )
			}
		}
	}
}
var store = new Store()

function Message( imapPath, id, subject, from, date, inReplyTo, mime_ = null ) {
	this.imapPath = imapPath
	this.id = id
	this.subject = subject
	this.from = from
	this.date = date
	this.inReplyToId = inReplyTo
	this.inReplyTo = null
	this.isRepliedWith = []
	this.mime = mime_
	this.dialogue = null

	this.fromDrafts = imapPath == folderNames.drafts
	this.fromSent = imapPath == folderNames.sent
	this.fromTrash = imapPath == folderNames.trash


	this.originalId = function() {
		if ( this.inReplyTo == null )
			return this.id
		return this.inReplyTo.originalId()
	}

	this._realSubject = function( subject )  {
		var lcSubject = subject.toLowerCase()

		if ( lcSubject.startsWith( 'fw:' ) || lcSubject.startsWith( 're:' ) ) {
			var i = mime.findNonWhitespace( lcSubject, 3 )
			return this._realSubject( subject.substring( i ) )
		}

		return subject
	}

	this.realSubject = function() {
		return this._realSubject( this.subject )
	}
}

// A message's header contains:
// * An id to distinguish itself from other messages
// * A subject to give a quick impression about the content of the message (optional)
// * A from address
// * A sent date
// * A link to another message of which this message is a reply (optional)
function MessageHeader( imapPath, imapId, id, subject, from, date, inReplyTo ) {
	// TODO: Maybe change imapPath and imapId into one serverId so that when the backend uses something else than imap, it can be abstract enough
	this.imapPath = imapPath
	this.imapId = imapId
	this.id = id
	this.subject = subject
	this.from = from
	this.date = date
	this.inReplyTo = inReplyTo
}

function MailboxItem( id, subject, from, date ) {
	this.id = id
	this.subject = subject
	this.from = from
	this.date = date

	this.html = function() {
		var str = '<a id="dialogue-item-' + this.id + '" class="mail-item"'
		str += ' onclick="javascript:onDialogueItemClick(this)" mailid="' + this.id + '">'

		str += '<div class="subject">'
		if ( this.subject != null )
			str += textToHtml( this.subject )
		str += '</div>'

		str += '<span class="from">'
		if ( this.from != null )
			str += textToHtml( this.from )
		str += '</span>'

		str += ' - <span class="date">'
		if ( this.date != null )
			str += textToHtml( this.date )
		str += '</span>'

		str += '</a>'
		return str
	}
}


function dateString( date ) {
	return date.getSeconds() + ':' + date.getMinutes() + ':' + date.getHours() + ' ' + date.getDate() + '/' + (date.getMonth() + 1) + '/' + date.getYear()
}

function appendMessage( message ) {
	
	var msgsEl = document.getElementById( 'messages' )

	msgsEl.innerHTML += '<div class="message">' + textToHtml( message ) + '</div>'
}

function appendMail( mail ) {
	if ( 'message-id' in mail.headers )
		store.messageById( mail.headers['message-id'] ).mime = mail
	
	var msgsEl = document.getElementById( 'messages' )
	var html = '<div class="message">'
	html += '<div class="header"><span class="field">From:</span> ' + ( 'from' in mail.headers ? mail.headers['from'] : '???' )
	html += ', <span class="field">Date:</span> ' + mail.headers['date'] + '</span>'
	html += '</div>'

	var msgs = selectMessages( mail )
	for ( var i = 0; i < msgs.length; i++ ) {
		var msg = msgs[i]

		html += '<div class="part">' + constructMailMessage( msg ) + '</div>'
	}
	
	html += '</div>'
	
	msgsEl.innerHTML += html
}

function selectMessages( mail ) {
	var p = mime.parseContentType( mail.headers['content-type'] )
	
	if ( p.contentType == 'text/plain' || p.contentType == 'text/html' )
		return [mail]

	if ( mail.isMultipart )
		return selectMultipartMessages( mail )		
}

function selectMultipartMessages( mail ) {
	var p = mime.parseContentType( mail.headers['content-type'] )

	if ( p.contentType == 'multipart/alternative' ) {
		var bestPart = findBestPart( mail )
		if (bestPart == null)
			throw "Couldn't find a version of the message that the client can use"
		else
			return [bestPart]
	}
	else {	// If multipart/mixed or any other multipart/* not recognized
		return findViewableParts( mail )
	}
}

/*function displayMailMessage( mail ) {
	var p = mime.parseContentType( mail.headers['content-type'] )

	if ( p.contentType == 'text/plain' )
		displayMailAsText( mail )
	else if ( p.contentType == 'text/html' )
		displayMailAsHtml( mail )
	else if ( mail.isMultipart ) {
		displayMultipartMail( mail )
	}
	else
		throw 'Unsupported content type!'
}*/

function findViewableParts( mail ) {
	var parts = []

	for (var i = 0; i < mail.payload.length; i++) {
		var part = mail.payload[i]

		if ( 'content-type' in part.headers ) {

			var p = mime.parseContentType( part.headers['content-type'] )

			if ( p.contentType == 'text/plain' )
				parts.push( part )

			else if ( p.contentType == 'text/html' )
				parts.push( part )

			else if ( part.isMultipart ) {
				var subParts = selectMultipartMessages( part )
				parts = parts.concat( subParts )
			}
		}
	}

	return parts
}

// Returns the first text/plain part, or the first text/html part if it's available.
function findBestPart( message ) {
	var bestSoFar = null	

	for (var i = 0; i < message.payload.length; i++) {
		var part = message.payload[i]

		if ( 'content-type' in part.headers ) {
			var p = mime.parseContentType( part.headers['content-type'] )

			if ( p.contentType == 'text/plain' ) {
				if ( bestSoFar == null )
					bestSoFar = part
			}
			else if ( p.contentType == 'text/html' )
				return part
		}
	}

	return bestSoFar
}

function constructHeader( name, value ) {
	return '<span class="header name">' + name + ':</span> <span class="header value">' + value + '</span><br/>'
}

function constructMailHeader( mail ) {
	var html = ''

	if ('subject' in mail.headers)
		html += constructHeader( 'Subject', mail.headers['subject'] )
	if ('from' in mail.headers)
		html += constructHeader( 'From', mail.headers['from'] )
	if ('to' in mail.headers)
		html += constructHeader( 'To', mail.headers['to'] )
	if ('cc' in mail.headers)
		html += constructHeader( 'CC', mail.headers['cc'] )
	if ('date' in mail.headers)
		html += constructHeader( 'Date', mail.headers['date'] )

	// TODO: Reformat header names with uppercase symbols
	html += '<div class="all-headers">'
	for (var name in mail.headers) {
		html += name + ': ' + textToHtml( mail.headers[ name ] ) + '<br/>'
	}

	if (mail.isMultipart) {
		// TODO: If there are attachments, add them as well
	}

	return html
}

function constructMailMessage( mail ) {
	var p = mime.parseContentType( mail.headers['content-type'] )

	if ( p.contentType == 'text/plain' )
		return constructMailMessageAsText( mail )
	else if ( p.contentType == 'text/html' )
		return constructMailMessageAsHtml( mail )
	else
		throw 'Invalid content type for message: ' + p.contentType
}

function constructMailMessageAsText( mail ) {
	return textToHtml( mail.decode() )
}

function constructMailMessageAsHtml( mail ) {
	return '<iframe onload="onLoadMailHtml(this)">' + mail.decode() + '</iframe>'
}

function onLoadMailHtml( e ) {
	var doc = e.contentWindow.document
	var html = e.innerHTML

	doc.open()
	doc.write( html )
	doc.close()

	//e.innerHTML = ''
	e.style.height = doc.body.scrollHeight + 'px'
}

function mmmmMailMessages( mails ) {
	var el = document.getElementById( 'messages' )
	el.innerHTML = ''
	
	for (var i = 0; i < mails.length; i++) {
		var mail = mails[i];
		var msgEl = constructMailMessage( mail ) 
		el.appendChild( msgEl )
	}
}

function displayMailMessageAsHtml( mail ) {
	var el = document.getElementById( 'messages' )

	el.innerHTML = ''
	el.appendChild( constructMailMessageAsHtml( mail ) )
}

function displayMailMessageAsText( mail ) {
	var el = document.getElementById( 'messages' )

	el.innerHTML = ''
	el.appendChild( constructMailMessageAsText( mail ) )
}

function load() {
	var ts = localStorage.getItem( 'last-download-date' )
	if ( ts != null )
		lastDownloadDate = new Date( parseInt( ts ) )

	var ecdsa = { name: 'ECDSA', namedCurve: 'P-521', hash: { name: 'SHA-256' } }
	var ecdh = { name: 'ECDH', namedCurve: 'P-521' }
	var aes = { name: 'AES-CBC', iv: new Uint8Array( 16 ) }
	window.crypto.getRandomValues( aes.iv )
console.log( aes.iv );
	var sha256 = { name: 'SHA-256' }
	fsmp.generateCertificate( ecdsa, ecdh, aes, sha256, sha256 ).then(function( peer1 ) {

		fsmp.generateCertificate( ecdsa, ecdh, aes, sha256, sha256 ).then(function( peer2 ) {
console.log('peer2')
console.log( peer2.certificate.encryptionAlgorithm )
			fsmp.constructInitiationPacket( peer2.certificate, peer1.certificate, peer1.key, [peer1.certificate], fsmp.stringToBytes('Hallo, wilt u een sessie met mij starten?'), 1024 ).then(function( result ) {
				var packet = result.packet
				var sessionCookie = result.sessionCookie
				console.log(sessionCookie)
				packet.export().then(function( buffer ) {

					console.log( buffer )
					var armor = fsmp.encodeArmor( 'packet', buffer.bytes )
					alert( armor )

					var decoded = fsmp.decodeArmor( 'packet', armor )
					// TODO: import
					fsmp.openPacket( decoded, peer2.certificate, peer2.key ).then(function( packet ) {

						

					}).catch(function( error ) { showError( 'Unable to import initiation packet', error ) })

				}).catch(function( error ) { showError( 'Unable to export initiation packet', error ) })

			}).catch(function( error ) { showError( 'Unable to generate initiation packet', error ) })

		}).catch(function( error ) { showError( 'Unable to generate certificate 2', error ) })
	}).catch(function( error ) {
		showError( 'Unable to generate certificate 1', error )
	})

	//loadImap()
}

function showError( message, error ) {
	alert( message + ': ' + error.name + ': ' + error.message + ( settings.debug ? ( '\n\n' + error.stack ) : '' ) )
}

function loadFolderStructure() {

	document.getElementById('folders').innerHTML = 'Loading...'

	imap.listFolders().then(function( folders ) {
		folderStructure = structureFolders( folders )
		updateFolderStructure()
	}).catch(function( error ){
		if (error.status == 502)
			alert('IMAP error: ' + error.reason )
		else
			alert( 'Unable to list IMAP folder: ' + error.reason )
	})
}

function loadImap() {
	document.getElementById('dialogues').innerHTML = 'Connecting...'

	mail.imapSettings().then(function( response ){
	
		loadInbox()
	}).catch(function( error ){
		alert( 'Unable to setup IMAP: ' + error.reason )
	})
}

function loadInbox() {
	document.getElementById('dialogues').innerHTML = 'Loading...'

	loadMail()/*.catch(function( error ) {
		alert( 'Unable to load mail: ' + error.reason )
	})*/
}

function loadMail() {
	
	return new Promise( function( success, fail ) {
		// Load all message headers that were remembered
		store.load()
		dialogues = store.constructDialogues()
		updateDialogues()

		mail.list( lastDownloadDate ).then(function( response ){

			// Find the lastest date of the new mail
			var latestDateFound = lastDownloadDate

			for (var path in response) {
				var mailList = response[ path ]

				for (var i = 0; i < mailList.length; i++) {
					var headers = mailList[i]

					var parsed = mime.parseMessage( headers )
					var date = 'date' in parsed.headers ? mime.parseDate( parsed.headers['date'] ) : null
					var subject = 'subject' in parsed.headers ? mime.decodeSubject( parsed.headers['subject'] ) : null
					var msg = new Message( path, parsed.headers['message-id'], subject, parsed.headers['from'], date, parsed.headers['in-reply-to'] );
					store.add( msg )

					if ( date != null && date.getTime() > latestDateFound.getTime() )
						latestDateFound = date
				}
			}

			updateLastDownloadDate( latestDateFound )
			this.store.sort()
			this.store.save()

			store.updateDialogues()
			dialogues = store.constructDialogues()
			updateDialogues()

			success()
		}).catch(function(error){
			fail( error )
		})
	})
}

function loadDialogue( dialogue ) {
	var msgsEl = document.getElementById('messages')
	msgsEl.innerHTML = 'Loading...'

	var msg = dialogue.messages[0]

	mail.fetch( msg.imapPath, msg.id ).then(function( response ){

		var decoded = atob( response )
		var parsed = mime.parseMessage( decoded )
		msgsEl.innerHTML = ''
		appendMail( parsed )

		if ( dialogue.messages.length > 1 )
			_loadDialogue( dialogue, 1 )
	}).catch(function(error){
		if ( error.status == 404 )
			appendMessage( 'Message not found' )
		else
			alert( 'Unable to open email id ' + msg.id + ' in "' + msg.imapPath + '": ' + error )
	})
}

function _loadDialogue( dialogue, i ) {
	var msg = dialogue.messages[i]

	mail.fetch( msg.imapPath, msg.id ).then(function( response ){

		var decoded = atob( response )
		var parsed = mime.parseMessage( decoded )
		appendMail( parsed )

		if ( (i+1) < dialogue.messages.length && (i+1) < 10 )
			_loadDialogue( dialogue, i+1 )
	}).catch(function(error){
		if ( error.status == 404 )
			appendMessage( 'Message not found' )
		else
			alert( 'Unable to open email id ' + msg.id + ' in "' + msg.imapPath + '": ' + error )
	})
}

function onDialogueItemClick( el ) {
	var dialogueId = el.getAttribute('dialogueid')
	var dialogue = dialogues.get( dialogueId )
	currentDialogue = dialogue
	
	loadDialogue( dialogue )
}

function onReply() {
	// TODO: Find the last message that isn't from you
	var lastMsg = null
	for ( var i = 0; i < currentDialogue.messages.length; i++ ) {
		var msg = currentDialogue.messages[i]

		if ( !msg.fromSent ) {
			lastMsg = msg
			break
		}
	}

	var from = settings.username + '@' + settings.domain

	var to = null
	if ( 'reply-to' in lastMsg.mime.headers )
		to = lastMsg.mime.headers['reply-to']
	else if ( lastMsg.from != null )
		to = lastMsg.from
	var cc = 'cc' in lastMsg.mime.headers ? lastMsg.mime.headers['cc'] : null

	var data = 'From: ' + from + '\r\n'
	if ( to != null )
		data += 'To: ' + to + '\r\n'
	if ( cc != null )
		data += 'CC: ' + cc + '\r\n'
	if ( lastMsg.id != null )
		data += 'In-Reply-To: ' + lastMsg.id + '\r\n'
	data += 'Message-ID: ' + (new Date()).getTime() + '@' + settings.domain + '\r\n'
	if ( lastMsg.subject != null )
		data += 'Subject: Re: ' + lastMsg.mime.headers['subject'] + '\r\n'

	data += '\r\n' + document.getElementById('reply-message').value

	var recipients = to
	if ( cc != null )
		recipients += ', ' + cc

	alert( data )
	mail.send( from, recipients, data ).then(function( response ) {

		alert( response )
	}).catch(function( error ) {
		alert( 'Unable to send message: ' + error.reason )
	})
}

function structureFolders( folders ) {
	structure = {}

	for (var i = 0; i < folders.length; i++) {
		var folder = folders[i]

		var parts = folder.split('/')
		structure = structureParts( structure, parts )
	}

	return structure
}

function structureParts( structure, parts ) {
	if (parts.length == 1)
		structure[ parts[0] ] = {}
	else if ( parts[0] in structure )
		structure[ parts[0] ] = structureParts( structure[ parts[0] ], parts.slice(1) )
	else
		structure[ parts[0] ] = structureParts( {}, parts.slice(1) )
	return structure
}

function folderStructureHtml( name, path, structure ) {
	html = '<div class="folder"><a onclick="onFolderClick(this)" path="' + path +'">' + name + '</a>'

	for (var subfolder in structure) {
		html += folderStructureHtml( subfolder, path + '/' + subfolder, structure[ subfolder ] )
	}

	html += '</div>'
	return html
}

function textToHtml( text ) {
	if ( typeof text != 'string' )
		alert( text )

	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
}

// Updates the page with the current folderStructure
function updateFolderStructure() {
	var foldersEl = document.getElementById( 'folders' )
	foldersEl.innerHTML = ''

	// INBOX first
	if ('INBOX' in folderStructure)
		foldersEl.innerHTML += folderStructureHtml( 'INBOX', 'INBOX', folderStructure[ 'INBOX' ] )

	for (var folder in folderStructure) {
		if (folder != 'INBOX')
			foldersEl.innerHTML += folderStructureHtml( folder, folder, folderStructure[ folder ] )
	}
}

function updateDialogues() {
	var mailboxEl = document.getElementById( 'dialogues' )
	mailboxEl.innerHTML = ''

	for (var i = 0; i < this.dialogues.size(); i++) {
		var dialogue = this.dialogues.at(i)
		
		mailboxEl.innerHTML += dialogue.meta().html()
	}
}

function updateLastDownloadDate( date ) {
	lastDownloadDate = date
	localStorage.setItem( 'last-download-date', date.getTime() )
}
