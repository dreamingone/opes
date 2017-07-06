from email.parser import BytesParser
from core.response import Response
from core.controller import Controller
from core.router import Router
from core.response.content import Json as JsonResponse, Text as TextResponse
from core.response.error import NotFound
import base64
import config
import os


class MailboxRouter( Router ):
	def dir_path( self, routes ):
		if routes[0] in ['cur', 'new']:
			if len( routes ) == 1:
				return config.maildir_path + '/' + routes[0]
			else:
				return config.maildir_path + '/' + routes[0] + '/' + routes[1]

		if len( routes ) > 1:
			return config.maildir_path + '/.' + '.'.join( routes[:-1] ) + '/' + routes[-1]

	def list_dir( self, path ):
		return [ self.parse_id(x) for x in os.listdir( path ) if os.path.isfile(path + '/' + x) ]

	def list_dirs( self ):
		#print( [ for x in os.listdir( config.maildir_path ) if os.path.isdir(config.maildir_path + '/' + x) ] )
		return [ x[1:].replace( '.', '/' ) for x in os.listdir( config.maildir_path ) if os.path.isdir(config.maildir_path + '/' + x) and x.startswith('.') ]

	def parse_id( self, filename ):
		i = filename.find(':')
		if i == -1:
			return filename
		return filename[:i]

	def route( self, context, routes ):
		if len( routes ) == 0 or (len(routes)==1 and len(routes[0])==0):
			return JsonResponse( self.list_dirs() )
	
		first_dir = routes[0]

		path = self.dir_path( routes )
		if routes[-1] != '':
			if os.path.exists( path ) and os.path.isfile( path ):
				return MailboxController( path ).handle( context )
			else:
				return InvalidFileResponse( routes )
		try:
			return MailboxListResponse( self.list_dir( path ), routes )
		except FileNotFoundError:
			return InvalidDirectoryResponse( routes )

class MailboxController( Controller ):
	def __init__( self, filepath, routes ):
		self.filepath = filepath
		self.routes = routes

	def handle_get( self, context ):
		with open( self.filepath, 'rb' ) as f:
			content = base64.encodebytes( f.read() ).encode('ascii')
		return MailboxResponse( content )

	def handle_post( self, context ):
		# Delete the file after overwriting it (for security measures)
		try:
			file_size = os.stat( self.filepath ).st_size
		except FileNotFoundError:
			return InvalidFileResponse( self.routes )
	
		with open( self.filepath, 'w' ) as f:
			f.write( [0]*file_size )

		os.remove( self.filepath )

		return DeletedResponse()

class MailboxResponse( JsonResponse ):
	def __init__( self, content ):
		self.content = content

	def json( self ):
		return { 'content': self.content }

class MailboxListResponse( JsonResponse ):
	def __init__( self, mails ):
		self.mails = mails

	def json( self ):
		return self.mails


class InvalidDirectoryResponse( NotFound, TextResponse ):
	def __init__( self, dir_ ):
		self.dir = dir_

	def body( self ):
		return 'Folder ' + '/'.join( self.dir ) + ' not found'

class InvalidFileResponse( NotFound, TextResponse ):
	def __init__( self, file_ ):
		self.file = file_

	def body( self ):
		return 'Mail ' + '/'.join( self.file ) + ' not found'
