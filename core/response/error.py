from ..response import Response
from ..headers import Headers


class BadGateway( Response ):
	def status_code( self ):
		return 502

	def status_message( self ):
		return 'Bad Gateway'

class BadRequest( Response ):
	def status_code( self ):
		return 400

	def status_message( self ):
		return 'Bad Request'

class InternalServerError( Response ):
	def status_code( self ):
		return 500

	def status_message( self ):
		return 'Internal Server Error'

class MethodNotAllowed( Response ):
	def status_code( self ):
		return 405

	def status_message( self ):
		return 'Method Not Allowed'

class NotFound( Response ):
	def status_code( self ):
		return 404

	def status_message( self ):
		return 'Not Found'

class NotModified( Response ):
	def status_code( self ):
		return 304

	def status_message( self ):
		return 'Not Modified'

class PreconditionFailed( Response ):
	def status_code( self ):
		return 412

	def status_message( self ):
		return 'Precondition Failed'


class ServiceUnavailable( Response ):
	def status_code( self ):
		return 503

	def status_message( self ):
		return 'Service Unavailable'

class TemporaryRedirect( Response ):
	def location( self ):
		raise NotImplementedError()

	def headers( self ):
		hs = Headers()
		hs.add( 'location', self.location() )
		return hs

	def status_code( self ):
		return 307

	def status_message( self ):
		return 'Temporary Redirect'
