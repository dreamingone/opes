function Template( id ) {
	var el = document.getElementById( id )
	this.string = el.innerHTML
	this.validChars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

	this.build = function( data ) {
		var i = this.string.find( '&' )
		var html = this.string.substring( 0, i )

		while ( i != -1 ) {

			var res = this.readNamespace(i)

			var val = this.evaluate( data, res.names )
			html += val

			i = this.string.find( '&', res.end+1 )

			html += this.string.substring( val.end, i )
		}

		return html
	}

	this.evaluate = function( data, names ) {
		if ( names.length == 1 ) {
			if ( names[0] in data )
				return data[ names[0] ]
			return ''
		}

		if ( names[0] in data )
			return this.evaluate( data[ names[0] ], names.slice(1) )

		return ''
	}

	this.readName = function( start = 0 ) {
		var name = ''
		var i = start
		
		while (true) {
			var char = this.string[i]
			if (this.validChars.indexOf( char ) == -1)
				break
			name += char
			i++
		}

		return { name: name, end: i }
	}

	this.readNamespace = function( start = 0 ) {
		var names = []
		var i = start

		while (true) {
			var result = this.readName( data, i )
			if (result.name == '')
				throw 'Missing parameter name after "."'
			names.push( result.name )
			
			if ( this.string[i] != '.' ) {
				i = result.end
				break
			}

			i = result.end+1
		}

		return { names: names, end: i }
	}
}
