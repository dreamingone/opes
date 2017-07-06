from mycore.controller import Controller
from mycore.response.content import Text as TextResponse
import os


class DeleteController( Controller ):
	def handle_post( self, request ):
		username = self.environ['SSL_CLIENT_S_DN_CN']

		if not 'id' in request.uri.query:
			return MissingIdResponse()
		id_ = request.uri.query['id']
		f = '/home/' + username + '/Maildir/cur/' + id_		
		print(f)
		if not os.path.exists( f ):
			return InvalidIdResponse()

		os.remove( f )
		return SuccessResponse()
		
		

class SuccessResponse( TextResponse ):
	def body( self ):
		return 'Mail has been removed.'

class MissingIdResponse( TextResponse ):
	def status_code( self ):
		return 400

	def status_message( self ):
		return 'Bad Request'

	def body( self ):
		return 'Missing id in query.'

class InvalidIdResponse( TextResponse ):
	def status_code( self ):
		return 404

	def status_message( self ):
		return 'Not Found'

	def body( self ):
		return 'Given id doesn\'t exist.'
