from .controller import Controller
from .response.content import Text as TextResponse
from .response.error import NotModified as NotModifiedResponse
from .template import Template
from threading import Lock


class ViewController( Controller ):
	def __init__( self, view ):
		self.view = view

	# When context is assigned to this controller, assign it to its view also
	def __setattr__( self, name, value ):
		if name == 'context':
			self.view.context = value
		super( ViewController, self ).__setattr__( name, value )

	def handle_get( self, request ):
		return self.view

class View( TextResponse ):
	"""The View class creates HTML pages.
It has access to the context the calling controller had.
When the html function (that is to be implemented) is called, the context has been assigned."""

	DECIMALS = "0123456789abcdef"

	etag = None
	context = None
	hashcode = None
	lock = Lock()

	def __init__( self, context ):
		self.context = context

	def __getattr__( self, name ):
		if self.context == None:
			raise AttributeError()

		if name in self.context:
			return self.context[ name ]
		
		raise AttributeError()

	def body( self ):
		return self.html().encode('utf-8')
	
	def controller( self ):
		return ViewController( self )

	def format_code( self, code ):
		formatted = ''

		for byte in code:
			formatted += self.DECIMALS[byte % 16] + self.DECIMALS[byte >> 4]

		return formatted

	def hash( self, buf, hash_len ):
		code = [0]*hash_len

		for i in range( len( buf ) ):
			code[i % hash_len] ^= buf[i]

		return code

	def headers( self ):
		h = super( View, self ).headers()
		if self.etag != None:
			h['ETag'] = self.etag
		return h

	def html( self ):
		raise NotImplementedError()

	def mime_subtype( self ):
		return 'html'

	def release( self ):
		pass

	# Returns a response for the HTML page of this view
	def respond( self, request ):
		if self.static():
			# Update cache
			type(self).lock.acquire()
			if type(self).hashcode == None:
				type(self).hashcode = self.format_code( self.hash( self.html( request ).encode('utf-8'), 16 ) )
			own_etag = type(self).hashcode
			type(self).lock.release()

			# If given ETag matches, give a not modified response
			try:
				etag = request.headers['If-None-Match']

				if etag == own_etag:
					return NotModifiedResponse()
			except KeyError:
				pass
			return ViewResponse( self, request, own_etag )
		else:
			return ViewResponse( self, request )

	# Should be implemented to return False if the content of this view differs too often for caching to be efficient
	# If this returns True, then caching will be implemented for this view.
	def static( self ):
		return True

	def template( self, filename ):
		return Template( filename, context )
