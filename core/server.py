from .body import Body
from .context import Context
from .response import Response
from .request import Request
from .uri import Uri
from .wsgi import Wsgi
from wsgiref.simple_server import make_server
from wsgiref.util import request_uri
from cgi import escape, parse_qs
from io import BytesIO
import time


class Application:
	def __init__( self, root_controller ):
		self.root_controller = root_controller

	def __call__( self, environ, start_response ):
		wsgi = Wsgi( environ )

		method = wsgi.method()
		uri = Uri.parse( request_uri( environ, True ) )
		headers = wsgi.headers()
		if 'Content-Length' in headers and headers['Content-Length'] != '':
			body = Body( environ['wsgi.input'], int( headers['Content-Length'] ) )
		else:
			body = Body( environ['wsgi.input'], 0 )
		request = Request( method, uri, headers, body )
		context = Context()
		context.env = environ
		context.request = request

		# Prepare our root controller
		controller = self.root_controller()

		# Fetch the response given our request
		response = controller.handle( context )
		controller.release()
		if not isinstance( response, Response ):
			raise AttributeError( 'Value returned from root controller not a response: ' + str(response) )

		# Convert the headers
		headers2 = []
		has_length = False
		content_length = 0
		for name, value in response.headers():
			if name == 'Content-Length':
				content_length = int(value)
				has_length = True
			headers2 += [( name, value )]

		# Obtain the body
		body = response.body()
		if hasattr( body, 'read' ):
			content = body.read()
		elif isinstance( body, str ):
			content = body.encode('ascii')
		else:
			content = body

		request.release()

		# If Content-Length is not set, set it
		if not has_length:
			headers2 += [('Content-Length', str(len( content )))]

		# Return
		print("HEADER", headers2)
		start_response( response.status(), headers2 )
		response.release()

		return [content]



def serve( host, port, root_controller ):
	httpd = make_server( host, port, Application( root_controller ) )
	httpd.serve_forever()
