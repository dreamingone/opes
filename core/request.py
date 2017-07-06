from .body import Body
from .cookie import Cookie
from .headers import Headers

class Request:
	WHITESPACE = ' \t'

	def __init__( self, method, uri, headers: Headers = Headers(), body: Body = None, version = '1.1' ):
		self.method = method
		self.uri = uri
		self.headers = headers
		self.body = body
		self.version = version

	def __str__( self ):
		message = self.method.upper() + ' ' + self.uri + ' HTTP/' + self.version + '\r\n'
		for name, value in headers:
			message += name + ': ' + value + '\r\n'
		message += '\r\n'
		if self.body != None:
			message += self.body.read()

	def cookie( self ):
		if 'Cookie' in self.headers:
			return Cookie.parse( self.headers['Cookie'] )

	@staticmethod
	def parse( f ):
		request_line = f.readline()

	def release( self ):
		self.body.close()
