from .headers import Headers


class Response:
	status_msg = {
		200: 'OK'
	}

	def body( self ):
		return b''

	def headers( self ):
		return Headers()

	def release( self ):
		pass

	def status_code( self ):
		return 200

	def status( self ):
		return str(self.status_code()) + ' ' + self.status_msg[ self.status_code() ]
