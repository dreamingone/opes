from mycore.controller import Controller
from mycore.view import View
from mycore.response.error import BadRequest as BadRequestResponse, NotFound as NotFoundResponse
import config


class RegisterController( Controller ):
	def code_exists( self, code ):
		f = open( config.codes_file, 'r' )
		for line in f:
			if code == line[:-1]:
				return True
		f.close()
		return False

	def handle_all( self, context ):
		if not context.request.uri.query or not 'code' in context.request.uri.query:
			return (MissingCodeView( context ), None)

		code = context.request.uri.query['code']
		if not self.code_exists( code ):
			return (InvalidCodeView( context, code ), code)

		return (None, code)

	def handle_get( self, context ):
		resp, code = self.handle_all( context )
		if resp != None:
			return resp

		return self.template( 'register.html' )( code=code )


class MissingCodeView( View, BadRequestResponse ):
	def html( self ):
		return self.template( 'error/missing_code.html' )()

class InvalidCodeView( View, NotFoundResponse ):
	def __init__( self, code ):
		self.code = code

	def html( self ):
		return self.template( 'error/invalid_code.html' )( code=code )
