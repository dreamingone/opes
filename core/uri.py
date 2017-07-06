from urllib.parse import quote_plus, unquote

class InvalidUriError: pass



class Uri:
	def __init__( self, host = 'localhost', path = None, scheme = 'http', query = None, fragment = None, port = None, username = None, password = None ):
		self.host = host
		self.path = path
		self.scheme = scheme
		self.query = query
		self.fragment = fragment
		self.port = port
		self.username = username
		self.password = password

	def __str__( self ):
		uri = self.scheme + '://'

		if self.username != None:
			uri += username
			if password != None:
				uri += ':' + password

			uri += '@'

		uri += self.host

		if self.port != None:
			uri += ':' + port

		uri += self.compose_location()

		return uri

	def compose_location( self ):
		location = '/'

		if self.path != None:
			location += '/'.join( self.path )

		if self.query != None:
			location += '?' + '&'.join( ( (name + '=' + quote_plus( value )) for name, value in self.query.items() ) )
				
		if self.fragment != None:
			location += '#' + self.fragment

		return location

	@staticmethod
	def format_query_string( string ):
		return quote_plus( string )

	@staticmethod
	def parse( string ):
		a = string.find( '://' )
		if a == -1:
			raise InvalidUriError()
		scheme = string[:a]

		b = string.find( '@', a + 3 )
		if b != -1:
			c = string.find( ':', a, b )
			if c != -1:
				username = string[a : c]
				password = string[c : b]
			else:
				username = string[a : b]
				password = None
			d = b
		else:
			username = password = None
			d = a+3


		e = string.find( '/', d )
		if e != -1:
			f = string.find( ':', d )
			if f != -1:
				host = string[d : f]
				port = string[f : e]
			else:
				host = string[d : e]
				port = None

		g = string.find( '?', e+1 )
		if g == -1:
			h = string.find( '#', e+1 )
			if h != -1:
				path = string[e+1:h].split('/')
				query = None
				fragment = string[h+1:]
			else:
				path = string[e+1:].split('/')
				query = None
				fragment = None

		else:
			path = string[e+1:g].split('/')
			h = string.find( '#', g+1 )
			if h != -1:
				query = Uri.parse_query( string[g+1:h] )
				fragment = string[h+1:]
			else:
				query = Uri.parse_query( string[g+1:] )
				fragment = None


		return Uri( host, path, scheme, query, fragment, port, username, password )

	@staticmethod
	def parse_query( string ):
		query = {}

		parts = string.split( '&' )
		for part in parts:
			i = part.find( '=' )
			if i == -1:
				#query[part] = None
				pass
			else:
				name, value = ( part[:i], unquote( part[i+1:] ).replace('+', ' ') )
				if name.endswith( '[]' ):	# PHP style arrays!
					if name in query:
						query[ name ].append( value )
					else:
						query[ name ] = [ value ]
				else:
					query[ name ] = value

		return query
