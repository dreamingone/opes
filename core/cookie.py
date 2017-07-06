class MalformedError( Exception ):
	def __init__( self, part ):
		self.part = part


class Cookie:
	def __init__( self, jar = {} ):
		self.jar = jar

	def __contains__( self, name ):
		return name in self.jar

	def __getitem__( self, name ):
		return self.jar[ name ]

	def __setitem__( self, name, value ):
		self.jar[ name ] = value

	@staticmethod
	def parse( field ):
		parts = [ x.strip( ' \t' ) for x in field.split(';') ]
		jar = {}

		for part in parts:
			i = part.find( '=' )
			if i == -1:
				raise MalformedError( part )

			name, value = ( part[:i], part[i+1:] )
			jar[ name ] = value

		print (jar)
		return Cookie( jar )
