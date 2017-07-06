from core.controller import Controller
from main.error import InvalidMethodResponse


class BaseController( Controller ):
	def invalid_method_response( self, method ):
		return InvalidMethodResponse( method )
