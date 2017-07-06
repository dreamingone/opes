from email.parser import BytesParser
from mycore.controller import Controller
from mycore.response.content import Json as JsonResponse
import base64
import gnupg
import os


class PollController( Controller ):
	def list_mail( self, dir ):
		parser = BytesParser()
		emails = {}
		
		for root, dirs, filenames in os.walk( dir ):
			for filename in filenames:
				f = open( dir + '/' + filename, 'rb' )
				emails[ filename ] = base64.encodebytes( f.read() ).decode('ascii')
				f.close()

		return emails

	def handle_get( self, request ):
		username = self.environ['SSL_CLIENT_S_DN_CN']
		maildir = '/home/' + username + '/Maildir'
		
		cur_list = self.list_mail( maildir + '/cur' )
		new_list = self.list_mail( maildir + '/new' )

		for name in new_list.keys():
			os.rename( maildir + '/new/' + name, maildir + '/cur/' + name )

		json = { 'new': new_list, 'cur': cur_list }
		return JsonResponse( json )
