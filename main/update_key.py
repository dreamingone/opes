from mycore.controller import Controller
from mycore.response.content import Text as TextResponse
import gnupg
import os


class UpdateKeyController( Controller ):
	def handle_post( self, request ):
		username = self.environ['SSL_CLIENT_S_DN_CN']
		gpg_dir = '/home/' + username + '/.gnupg'
		
		gpg = gnupg.GPG(homedir=gpg_dir)

		cert = request.body.read()
		print(cert)

		result = gpg.import_keys( cert )
		print(result.fingerprints)
		fingerprint = result.fingerprints[0]

		f = open( '/home/' + username + '/fingerprint', 'w' )
		f.write( fingerprint )
		f.close()

		return UpdateKeyResponse()


class UpdateKeyResponse( TextResponse ):
	def body( self ):
		return 'Succesfully updated the PGP certificate.'
