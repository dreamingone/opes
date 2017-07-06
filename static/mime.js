mime = {}

mime.Message = function( headers, is_multipart, payload ) {
	this.headers = headers
	this.isMultipart = is_multipart
	this.payload = payload

	// TODO: Implement this function so that it decodes the body into text
	this.decode = function() {
		if (this.isMultipart)
			throw 'Can only decode non-multipart messages'
		
		var body = this.payload

		pass_encodings = [ '7bit', '8bit', 'binary' ]
		if ('content-transfer-encoding' in this.headers) {

			encoding = this.headers['content-transfer-encoding'].toLowerCase()
			if ( pass_encodings.indexOf( encoding ) == -1 ) {
	
				if ( encoding == 'quoted-printable' )
					body = mime.decodeQuotedPrintable( this.payload )
				else if ( encoding == 'base64' )
					body = mime.decodeBase64( this.payload )
				else
					throw 'Invalid transfer encoding: ' + this.headers['content-transfer-encoding']
			}
		}

		var p = mime.parseContentType( this.headers['content-type'] )
		if ( 'charset' in p.params )
			var decoded = mime.decodeCharset( body, p.params['charset'] )
		else
			var decoded = body

		return decoded
	}
}

mime.decodeQuotedPrintable = function( coded ) {
	var message = ''
	var i = 0

	for ( var j = coded.indexOf('='); j < coded.length; j = coded.indexOf('=', i) ) {
		if (j == -1) {
			message += coded.substring( i )
			break
		}			
		
		message += coded.substring( i, j )

		// If a soft line break
		if (coded[j+1] == '\n')
			i = j+2
		else if (coded[j+1] == '\r' && coded[j+2] == '\n')
			i = j+3
		else {

			var char_code_str = coded.substr( j+1, 2 )
			var char = String.fromCharCode( parseInt( char_code_str, 16 ) )

			message += char
		
			i = j + 3
		}
	}

	return message
}

mime.decodeBase64 = function( coded ) {
	return window.atob( coded )
}

mime.decodeCharset = function( message, charset ) {
	var cs = charset.toLowerCase()

	// ASCII needs no decoding
	if (cs == 'us-ascii')	return message
	// TODO: ISO-8859-1, create a mapping that maps each code point above 127 to the corrosponding unicode character
	if (cs == 'utf-8')	return mime.decodeUtf8( message )

	// TODO: Error handling
	return message
}

mime.decodeSubject = function( coded ) {
	if ( !coded.startsWith( '=?' ) )
		return coded

	var i = coded.indexOf( '?=' )
	var inner = coded.substring( 2, i )

	var parts = inner.split( '?', 3 )
	var charset = parts[0].toLowerCase()
	var encoding = parts[1].toLowerCase()
	var subject3 = parts[2]

	if ( encoding == 'b' )
		var subject2 = mime.decodeBase64( subject3 )
	else if ( encoding == 'q' )
		var subject2 = mime.decodeQuotedPrintable( subject3 )
	else
		var subject2 = subject3

	var subject = mime.decodeCharset( subject2, charset )
	return subject
}

mime.decodeUtf8 = function( msg ) {
	var decoded = ''
	var asciiStart = 0

	for (var i = 0; i < msg.length; i++) {
		var c1 = msg.charCodeAt(i)

		if (c1 < 0x80)	{}
		//	decoded += msg[i]

		else {
			decoded += msg.substring( asciiStart, i )

			if ( (c1 & 0xE0) == 0xC0 ) {	// If the first two bits are set and the third unset
				var c2 = msg.charCodeAt(++i)

				var u = (c2 & 0x3F) | ((c1 & 0x1F) << 6)

				asciiStart = i + 2
			}
			else if ( (c1 & 0xF0) == 0xE0 ) {	// If the first three bits are set and the third unset
				var c2 = msg.charCodeAt(++i)
				var c3 = msg.charCodeAt(++i)

				var u = (c3 & 0x3F) | ((c2 & 0x3F) << 6) | ((c1 & 0x0F) << 12)

				asciiStart = i + 3
			}
			else if ( (c1 & 0xF8) == 0xF0 ) {	// If the first five bits are set and the fourth unset
				var c2 = msg.charCodeAt(++i)
				var c3 = msg.charCodeAt(++i)
				var c4 = msg.charCodeAt(++i)
	
				var u = (c4 & 0x3F) | ((c3 & 0x3F) << 6) | ((c2 & 0x3F) << 12) | ((c1 & 0x07) << 18)

				asciiStart = i + 4
			}
			else {	// Otherwise we don't know what to do with it
				var u = 0xFFFD

				asciiStart = i + 1
			}

			decoded += String.fromCharCode( u )
		}
	}

	if ( asciiStart < msg.length )
		return decoded + msg.substring( asciiStart )
	return decoded
}

mime.parseContentType = function( field ) {
	var parts = field.split( ';' )
	var content_type = mime.cutWhitespace( parts[0] )
	var parameters = {}

	for ( var i = 1; i < parts.length; i++ ) {
		part = mime.cutWhitespace( parts[i] )
		
		var j = part.indexOf( '=' )
		if ( j == -1 )	// When no = sign is found after ;, then no parameters are assumed after that last delimiter
			break
		var name = part.substring( 0, j )

		// The RFC specification says that, unless the parameter value is a token, it should be a quoted string.
		// Nevertheless, some email clients (such as Google's web mail client) sends MIME messages with unquoted strings. (Boo!)
		// This handle this, we check if the string is quoted by checking the first quote and use a different end-of-string finder in both cases.
		if (part[j+1] != '"') {
			var k = mime.findEnd( part, j+1 )
			var value = part.substring( j+1, k )		
		}
		else {
			var k = part.indexOf('"', j+2)
			if (k == -1)
				throw 'Content-Type attribute not properly escaped'		
			var value = part.substring( j+2, k )
		}

		parameters[ name ] = value
	}

	return { contentType: content_type, params: parameters }
}

mime.parseDate = function( string ) {
	// If day of week is in string, remove it, it is simply extra information
	var i = string.indexOf(',') + 1	// If no comma is found, i starts with 0

	i = mime.findNonWhitespace( string, i )
	var day = parseInt( string.substr( i, 2 ) )

	i = mime.findNonWhitespace( string, i+2 )
	var months = [
		'jan', 'feb', 'mar', 'apr', 'may', 'jun',
		'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
	]
	var month = months.indexOf( string.substr( i, 3 ).toLowerCase() )
	if ( month == -1 )
		throw 'Invalid month'	

	i = mime.findNonWhitespace( string, i+3 )
	var j = mime.findWhitespace( string, i )
	var yearString = string.substring( i, j )
	var year = parseInt( yearString )
	if ( yearString.length == 2 ) {
		if ( year < 50 )
			year += 2000
		else
			year += 1950
	}
	else if ( yearString.length != 4 )
		throw 'Invalid year format'

	i = mime.findNonWhitespace( string, j )
	var hour = parseInt( string.substr( i, 2 ) )

	i += 3
	var minute = parseInt( string.substr( i, 2 ) )

	i += 2
	if ( string[i] == ':' ) {
		var second = parseInt( string.substr( i+1, 2 ) )
		i += 3
	}
	else
		var second = 0

	i = mime.findNonWhitespace( string, i )

	var zones = {
		'ut': 0, 'gmt': 0,
		'est': -5, 'edt': -4,
		'cst': -6, 'cdt': -5,
		'mst': -7, 'mdt': -6,
		'pst': -8, 'pdt': -7,
		'z': 0, 'a': -1, 'm': -12, 'n': 1, 'y': 12 
	}
	// TODO: Correctly handle the last two digits of the offset:
	if ( string[i] == '+' )
		var offset = parseInt( string.substr( i+1, 2 ) )
	else if ( string[i] == '-' )
		var offset = -1 * parseInt( string.substr( i+1, 2 ) )
	else {
		j = mime.findWhitespace( string, i )
		if ( j != -1 )
			var zone = string.substring( i, j )
		else
			var zone = string.substring( i )
		
		if ( !( zone in zones ) )
			throw 'Invalid zone: ' + zone

		var offset = zones[ zone ]
	}

	var date = new Date()
	date.setUTCFullYear( year )
	date.setUTCMonth( month )
	date.setUTCDate( day )
	date.setUTCHours( hour + offset )
	date.setUTCMinutes( minute )
	date.setUTCSeconds( second )
	return date
}

mime.parseHeaders = function( string, start = 0 ) {
	var headers = {}
	var boundary = null

	var i = start
	var last_name = null
	while ( true ) {
		parsed = mime.parseLine( string, i )
		if ( parsed == null )
			throw 'Header not terminated correctly'

		i = parsed.next
		if ( parsed.line.length == 0 )
			break

		header = mime.parseHeader( parsed.line )

		if ( header !== false )
			if ( header.name != null ) {
				headers[ header.name ] = header.value
				last_name = header.name
			}
			else {
				headers[ last_name ] += '\n' + header.value }
	}
	
	return { headers: headers, next: i }
}

mime.skipUntilBoundary = function( string, boundary, start = 0 ) {
	var i = start

	do {
		var pLine = mime.parseLine( string, i )
		i = pLine.next
	}
	while ( !pLine.line.startsWith( '--' + boundary ) )

	return { last: pLine.line == ('--'+boundary+'--'), next: i }
}

mime.parseMessage = function( string, start = 0 ) {
	var p = mime.parseHeaders( string, start )
	var i = p.next

	// Check if multipart
	if ('content-type' in p.headers) {
		var p_content_type = mime.parseContentType( p.headers['content-type'] )
		var content_type = p_content_type.contentType
		if ( content_type.startsWith( 'multipart/' ) ) {
			if (!('boundary' in p_content_type.params))
				throw 'Missing boundary argument for multipart Content-Type header'

			var boundary = p_content_type.params['boundary']
			skipped =  mime.skipUntilBoundary( string, boundary, i )
			i = skipped.next
			if ( skipped.last )
				return new mime.Message( p.headers, true, [] )

			var p_parts = mime.parseParts( string, boundary, i )

			return new mime.Message( p.headers, true, p_parts.parts )
		}
	}

	// Otherwise, just take the body
	return new mime.Message( p.headers, false, string.substring( i ) )
}

mime.parseParts = function( string, boundary, start = 0 ) {
	var i = start
	
	// Fetch all parts
	var parts = []
	while (true) {		

		var p = mime.parsePart( string, boundary, i )
		parts.push( p.mime )
		i = p.next

		if (p.isLast)
			break
	}

	// Return message
	return { parts: parts, next: i }
}

mime.parsePart = function( string, boundary, start = 0 ) {
	var p = mime.parseHeaders( string, start )
	var i = p.next

	// Check if multipart
	if ('content-type' in p.headers) {
		var p_content_type = mime.parseContentType( p.headers['content-type'] )
		var content_type = p_content_type.contentType
		if ( content_type.startsWith( 'multipart/' ) ) {
			if (!('boundary' in p_content_type.params))
				throw 'Missing boundary argument for multipart Content-Type header'

			var boundary2 = p_content_type.params['boundary']
			skipped = mime.skipUntilBoundary( string, boundary2, i )
			i = skipped.next
			if ( skipped.last )
				return { mime: new mime.Message( p.headers, true, [] ), isLast: false, next: i }

			var p_parts = mime.parseParts( string, boundary2, i )
			i = p_parts.next

			// The multipart message inside a part is also terminated with a boundary of the 'parent' multipart
			skipped = mime.skipUntilBoundary( string, boundary, i )
			i = skipped.next
			return { mime: new mime.Message( p.headers, true, p_parts.parts ), isLast: skipped.last, next: i }
		}
	}

	// Otherwise just return the body
	var body = ''
	while (true) {
		var p_line = mime.parseLine( string, i )
		var line = p_line.line

		i = p_line.next

		if ( line == ('--' + boundary + '--') )
			return { mime: new mime.Message( p.headers, false, body ), isLast: true, next: i }
		if ( line.startsWith( '--' + boundary ) )
			return { mime: new mime.Message( p.headers, false, body ), isLast: false, next: i }
		if ( i >= string.length )
			throw "Couldn't find boundary: " + boundary

		body += line + '\n'
	}
}

mime.findBoundary = function( string, boundary, start = 0 ) {
	return string.indexOf( '--' + boundary, start )
}

mime.findBoundaryEnd = function( string, boundary, start = 0 ) {
	i = mime.findBoundary( string, boundary, start ) + 2 + boundary.length
	return string.indexOf( '\n', i ) + 1
}

// Finds the first whitespace or newline character
mime.findEnd = function( string, start = 0 ) {
	var toBeFound = ' \t\r\n'

	for (var i = start; i < string.length; i++) {
		if ( toBeFound.indexOf( string[i] ) != -1 )
			return i
	}

	return string.length
}

mime.findNonWhitespace = function( string, start = 0 ) {
	for ( var i = start; i < string.length; i++ ) {
		if ( mime.whitespace.indexOf( string[i] ) == -1 )
			return i
	}

	return -1
}

mime.findWhitespace = function( string, start = 0 ) {
	for ( var i = start; i < string.length; i++ ) {
		if ( mime.whitespace.indexOf( string[i] ) != -1 )
			return i
	}

	return -1
}

mime.parseBoundary = function( contentType ) {
	i = contentType.indexOf( 'boundary="' )
	j = contentType.indexOf( '"', i + 'boundary="'.length )

	return contentType.substring( i + 'boundary="'.length, j )
}

mime.parseHeader = function( string ) {
	if ( string.length == 0 )
		return null

	// If whitespace has been found at the beginning of the line, it is part of the last header		
	if ( mime.whitespace.indexOf( string[0] ) != -1 )
		return { name: null, value: mime.cutWhitespace( string, 0 ) }

	i = string.indexOf( ':' )
	if ( i == -1 )
		// Otherwise, we don't know what to do with it (TODO: Implement multipart support)
		throw 'Invalid header found: ' + string

	name = string.substring( 0, i ).toLowerCase()
	value = mime.cutWhitespace( string, i+1 )

	return {name: name, value: value}
}

mime.cutWhitespace = function( string, start = 0 ) {
	var begin = start

	// First find where the beginning whitespace ends
	for ( ; begin < string.length; begin++ ) {
		if ( mime.whitespace.indexOf( string[begin] ) == -1 )
			break
	}
	if ( begin == string.length )
		return ''

	// Then find where the trailing whitespace ends
	var end = string.length - 1
	for ( ; end >= 0; end-- ) {
		if ( mime.whitespace.indexOf( string[i] ) == -1 )
			break
	}

	// Return a substring with the beginning and trailing whitespace removed
	return string.substring( begin, end + 1 )
}

mime.parseLine = function( string, start ) {
	var i = string.indexOf( '\n', start )
	if (i == -1)
		return { line: string.substring( start ), next: string.length }

	var next = i+1
	if ( i > 0 && string[i-1] == '\r' )
		i--
	
	return { line: string.substring( start, i ), next: next }
}

mime.whitespace = ' \t\r\n'

