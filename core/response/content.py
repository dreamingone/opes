from ..response import Response
import json


class Content( Response ):
	def headers( self ):
		hs = super( Content, self ).headers()
		hs['Content-Type'] = self.content_type()
		return hs

	def content_type( self ):
		ct = self.mime_type()

		cs = self.charset()
		if cs != None:
			ct += '; charset="%s"' % cs

		return ct

	def mime_type( self ):
		raise NotImplementedError()

	def charset( self ):
		return None

class Text( Content ):
	def __init__( self, text = '' ):
		self.text = text

	def body( self ):
		return self.text.encode( self.charset() )

	def charset( self ):
		return 'utf-8'

	# By default, use the text/plain mime type
	def mime_subtype( self ):
		return 'plain'

	def mime_type( self ):
		return 'text/%s; charset="%s"' % ( self.mime_subtype(), self.charset() )

class Json( Content ):
	def __init__( self, json = None ):
		self._json = json

	def body( self ):
		return json.dumps( self.json(), ensure_ascii=True )

	# Use the ascii charset for maximum compatibility
	def charset( self ):
		return 'us-ascii'

	def json( self ):
		return self._json

	def mime_type( self ):
		return 'application/json'
