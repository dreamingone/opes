from core.response.content import Content as ContentResponse
from core.response.error import NotModified as NotModifiedResponse
from core.router import Router as BaseRouter


class StaticRouter( BaseRouter ):
	DECIMALS = '0123456789abcdef'

	cache = {}

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

	def update_cache( self, distinct_path, content ):
		StaticRouter.cache[ distinct_path ] = self.format_code( self.hash( content, 16 ) )

	def route( self, context, routes ):
		distinct_path = '/'.join( routes )
		file_path = "static/" + distinct_path
		filename = routes[ len(routes)-1 ]

		# Find a file extension
		dot_pos =  filename.rfind('.')
		if dot_pos != -1:
			extension = filename[ dot_pos+1 : ]
		else:
			extension = None

		# Check cache
		try:
			etag = context.request.headers['If-None-Match']
			if etag != None and etag.lower() == StaticRouter.cache[distinct_path]:
				return NotModifiedResponse()
		except KeyError:
			pass

		# Give the file response
		try:
			file_ = open( file_path, 'rb' )

			# Update cache if necessary
			if not distinct_path in self.cache:
				self.update_cache( distinct_path, file_.read() )
				file_.seek(0)

			return Response( file_, StaticRouter.cache[distinct_path], extension )
		except FileNotFoundError:
			return self.not_found_response( context.request, routes )
		
		

class Response( ContentResponse ):
	mime_dir = {
		'bmp': 'image/bmp',
		'cm': 'text/cache-manifest; charset="UTF-8"',
		'css': 'text/css; charset="UTF-8"',
		'gif': 'image/gif',
		'html': 'text/html; charset="UTF-8"',
		'jpg': 'image/jpeg',
		'js': 'application/javascript',
		'png': 'image/png',
		'txt': 'text/plain; charset="UTF-8"'
	}

	def __init__( self, file_, hashcode, extension = None ):
		self.file = file_
		self.hashcode = hashcode
		self.extension = extension.lower() if extension != None else None

	def body( self ):
		return self.file

	def headers( self ):
		hs = super( Response, self ).headers()
		hs['Cache-Control'] = 'public'
		hs['ETag'] = self.hashcode
		return hs

	def content_type( self ):
		if self.extension != None:
			try:
				return self.mime_dir[ self.extension ]
			except KeyError:
				pass

		return 'application/octet-stream'
