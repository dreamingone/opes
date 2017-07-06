from core.response.content import Text
from core.response.error import *


class BadRequestResponse( BadRequest, Text ):
	pass

class InvalidMethodResponse( MethodNotAllowed, Text ):
	def __init__( self, method ):
		self.method = method

	def body( self ):
		return 'Method "' + self.method + '" not supported'

class MissingFieldResponse( BadRequestResponse ):
	def __init__( self, fieldname ):
		self.fieldname = fieldname

	def body( self ):
		return 'Missing field "%s"' % self.fieldname

class SuccessResponse( Text ):
	pass
