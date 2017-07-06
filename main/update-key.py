from mycore.controller import Controller
from mycore.response.content import Text as TextResponse
import gnupg
import os


class UpdateKeyController( Controller ):
	def handle_post( self, request ):
		username = 'danny' #self.environ['SSL_CLIENT_S_DN']
		gpg_dir = '/home/' + username + '/.gnupg'
		
		gpg = gnupg.GPG(homedir=gpg_dir)

		result = gpg.import_keys( request.body.read() )
		fingerprint = result.fingerprints[0]

		f = open( '/home/' + username + '/fingerprint', 'r' )
		f.write( fingerprint )
		f.close()

		return UpdateKeyResponse()


class UpdateKeyResponse( TextResponse ):
	def body( self ):
		return 'Succesfully updated the PGP certificate.'
