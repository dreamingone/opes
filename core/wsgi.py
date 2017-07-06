from .headers import Headers


class Wsgi:
	def __init__( self, environ ):
		self.environ = environ


	def headers( self ):
		hs = Headers()
		print("huh?", Headers, hs, hs.index )

		# Most headers start with HTTP_
		for name, value in self.environ.items():
			if name.startswith( 'HTTP_' ):
				parts = [ (x[0].upper() + x[1:].lower()) for x in name[ len('HTTP_') : ].split( '_' ) ]

				hs.add( '-'.join( parts ), value )

		# Some don't
		if 'CONTENT_LENGTH' in self.environ:
			hs.add('Content-Length', str(self.environ['CONTENT_LENGTH']) )

		return hs


	def method( self ):
		return self.environ['REQUEST_METHOD']
