from ..headers import Headers


class Response:
	def body( self ):
		return b''

	def headers( self ):
		return Headers()

	def release( self ):
		pass

	def status_code( self ):
		return 200

	def status_message( self ):
		return 'OK'

	def status( self ):
		return str(self.status_code()) + ' ' + self.status_message()
