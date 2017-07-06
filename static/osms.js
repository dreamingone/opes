// One Secret Messaging Suite (OSMS) client API

var osms = {}

// Sends an HTTP request to the given url, optionally with some data, and returns a Promise
// Sends a GET request with data == null, POST otherwise
osms.request = function( url, data = null ) {
	return new Promise( function( handler, fail ) {
		method = data != null ? 'POST' : 'GET'

		obj = new XMLHttpRequest()
		obj.open( method, url, true );
		obj.onreadystatechange = function() {
			if ( obj.readyState == 4 ) {
				if (obj.status == 200)
					handler( obj.responseText )
				else
					fail( {name: 'HttpError', code: obj.status, message: obj.responseText} )
			}
		}
		if (data == null)
			obj.send()
		else
			obj.send(data)
	} )
}

// See request.
// This returns the response as a json object on success
osms.requestJson = function( url, data = null ) {
		
	return new Promise( function( handler, fail ) {
		osms.request( url, data ).then( function( response ) {
			handler( JSON.parse( response ) )
		}).catch(function( error ){
			fail( error )
		})
	} )
}

osms.MAIL = function( baseUrl = '/' ) {
	this.baseUrl = baseUrl

	this.smtpSettings = function() {
		return osms.request( this.baseUrl + 'mail/smtp', '' )
	}

	this.send = function( from, to, message ) {
		var query = 'from=' + encodeURIComponent( from )
console.log( to )
		for ( var i = 0; i < to.length; i++ ) {
			query += '&to[]=' + encodeURIComponent( to )
		}

		query += '&data=' + encodeURIComponent( message )

		return osms.request( this.baseUrl + 'mail/send', query )
	}


	this.imapSettings = function() {
		return osms.request( this.baseUrl + 'mail/imap', '' )
	}

	this.fetch = function( path, id ) {
		return osms.request( this.baseUrl + 'mail/fetch?folder=' + encodeURIComponent( path ) + '&id=' + encodeURIComponent( id ) )
	}

	this.list = function( date ) {
		return osms.requestJson( this.baseUrl + 'mail/list?date=' + Math.floor( date.getTime() / 1000 ) )
	}

	this.listFolders = function() {
		return osms.requestJson( this.baseUrl + 'mail/folders' )
	}
}
