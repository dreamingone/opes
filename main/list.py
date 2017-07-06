from email.parser import BytesParser
from mycore.controller import Controller
from mycore.response.content import Json as JsonResponse
import os


class ListController( Controller ):
	def list_mail( self, dir ):
		parser = BytesParser()
		list = []
		
		for root, dirs, filenames in os.walk( dir ):
			for filename in filesnames:
				file = open( dir + '/' + filename, 'r' )
				email = parser.parse( file, True )
				list.append( {'subject': email['Subject'], 'from': email['From'] } )

		return list

	def handle_get( self, request ):
		username = 'danny' #self.environ['SSL_CLIENT_S_DN']
		maildir = '/home/' + username + '/Maildir'
		
		new_list = self.list_mail( maildir + '/new' )
		cur_list = self.list_mail( maildir + '/cur' )

		json = { 'new': new_list, 'cur': cur_list }
		return JsonResponse( json )
