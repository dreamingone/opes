from email.parser import BytesParser
from core.router import Router
from core.response.content import Json as JsonResponse, Text as TextResponse
from core.response.error import BadGateway, TemporaryRedirect
from core.uri import Uri
from .error import BadRequestResponse, SuccessResponse
from .session import SessionController
from imaplib import IMAP4, IMAP4_SSL
import config
import ssl
import base64
from datetime import datetime, timedelta


# TODO: Implement a default controller that allows changing (POST) and viewing (GET) IMAP settings
class ImapRouter( Router ):
	def routes( self ):
		return [
			('connect', ConnectImapController),
			('fetch', FetchImapController),
			('folders', FoldersImapController),
			('list', ListImapController)
		]


class ConnectImapController( SessionController ):
	def handle_post( self, context ):
		query = Uri.parse_query( context.request.body.read().decode('ascii') )

		fields = [ 'host', 'port', '' ]
		host = query['host'] if 'host' in query else config.Imap.host
		port = query['port'] if 'port' in query else None
		username = query['username'] if 'username' in query else config.Imap.username
		password = query['password'] if 'password' in query else config.Imap.password
		security = query['security'] if 'security' in query else config.Imap.security

		if port == None:
			port = config.Imap.port
		else:
			try:
				port = int( port )
			except ValueError:
				return BadRequestResponse( 'Field "port" is not a number' )
		if not security in ['', 'none', 'starttls', 'tls']:
			return BadRequestResponse( 'Invalid "security" value' )

		context.session.imap = ImapSettings( host, port, username, password, security )
		return SuccessResponse( 'Successfully connected to IMAP server for this session' )

class ListImapController( SessionController ):
	def parse_list( self, ls ):
		parsed = []

		for item in ls:
			item_str = item.decode('ascii')
			j = self.rfind_non_whitespace( item_str )
			i = self.rfind_whitespace( item_str, j )
			filename = item_str[i:j+1].strip( ' \t"' )
			parsed.append( self.remove_quotes( filename ) )

		return parsed

	def remove_quotes( self, string ):
		if string[0] == '"' and string[-1] == '"':
			return string[ 1: -1 ]
		return string

	def rfind_whitespace( self, string, start = None ):
		if start == None:
			start = len( string ) - 1

		for i in range( start, -1, -1 ):
			if string[i] in " \t":
				return i

		return -1

	def rfind_non_whitespace( self, string, start = None ):
		if start == None:
			start = len( string ) - 1

		for i in range( start, -1, -1 ):
			if not string[i] in " \t":
				return i

		return -1

	def handle_get( self, context ):
		if context.request.uri.query == None or not 'date' in context.request.uri.query:
			date = datetime.utcfromtimestamp( 0 )
		else:
			date = datetime.utcfromtimestamp( int( context.request.uri.query['date'] ) )
		date -= timedelta(1)	# Because some IMAP servers in a different time zone might complain

		try:
			imap = context.session.imap.connect()

			folders_r = imap.list( '""', '*' )
			folders = self.parse_list( folders_r[1] )
			mail_list = {}

			for folder in folders:
				imap.select( folder.replace('/', '.') )

				date_str = date.strftime( "%d-%b-%Y" )
				_, ids = imap.search( None, '(SINCE "%s")' % ( date_str ) )
			
				# Parse the list of ID's		
				id_list = ids[0].decode('ascii').split(' ')
				folder_list = []
				for id_ in id_list:
					fetched = imap.fetch( id_, '(BODY.PEEK[HEADER.FIELDS (SUBJECT FROM DATE MESSAGE-ID IN-REPLY-TO)])' )
					msg = fetched[1][0][1].decode('ascii')
				
					folder_list.append( msg )

				mail_list[ folder ] = folder_list

			imap.logout()
		except IMAP4.error as e:
			return ImapErrorResponse( e )

		return JsonResponse( mail_list )

class ImapSettings:
	def __init__( self, host, port, username, password, security ):
		self.host = host
		self.port = port
		self.username = username
		self.password = password
		self.security = security

	def connect( self ):
		if self.security == 'none' or self.security == '':
			imap = IMAP4( self.host, self.port )
		else:
			ssl_context = ssl.SSLContext( ssl.PROTOCOL_TLSv1 )
			ssl_context.load_cert_chain( config.Imap.tls_cert_file, config.Imap.tls_key_file )
			if self.security == 'starttls':
				imap = IMAP4( self.host, self.port )
				imap.starttls( ssl_context )
			elif self.security == 'tls':
				imap = IMAP4_SSL( self.host, self.port, ssl_context = ssl_context )

		if self.username != None:
			imap.login( self.username, self.password )

		return imap

class ImapController( SessionController ):
	def handle( self, context ):
		if not 'imap' in context.session:
			return ConnectImapResponse()

		return super( ImapController, self ).handle( context )

class FetchImapController( ImapController ):
	def handle_get( self, context ):
		if context.request.uri.query == None or not 'folder' in context.request.uri.query:
			return BadRequestResponse( 'Missing "folder" field' )
		folder = context.request.uri.query['folder']

		if context.request.uri.query == None or not 'id' in context.request.uri.query:
			return BadRequestResponse( 'Missing "id" field' )
		msg_id = context.request.uri.query['id']

		try:
			imap = context.session.imap.connect()
			selected = imap.select( folder )
			_, imap_id = imap.search( None, 'HEADER Message-ID ' + msg_id )
			fetched = imap.fetch( imap_id[0].decode('ascii'), '(RFC822)' )

			msg = base64.encodebytes( fetched[1][0][1] ).decode('ascii')

			imap.logout()
		except IMAP4.error as e:
			return ImapErrorResponse( e )

		return TextResponse( msg )

class FoldersImapController( ImapController ):
	def handle_get( self, context ):
		folder = '""'
		if context.request.uri.query != None and 'folder' in context.request.uri.query:
			folder = context.request.uri.query['folder']

		try:
			imap = context.session.imap.connect()
			ls = imap.list( folder, '*' )
			print(ls)
			imap.logout()
		except IMAP4.error as e:
			return ImapErrorResponse( e )

		return JsonResponse( self.parse_list(ls[1]) )

	def parse_list( self, ls ):
		parsed = []

		for item in ls:
			item_str = item.decode('ascii')
			j = self.rfind_non_whitespace( item_str )
			i = self.rfind_whitespace( item_str, j )
			filename = item_str[i:j+1].strip( ' \t"' )
			parsed.append( self.remove_quotes( filename ) )

		return parsed

	def remove_quotes( self, string ):
		if string[0] == '"' and string[-1] == '"':
			return string[ 1: -1 ]
		return string

	def rfind_whitespace( self, string, start = None ):
		if start == None:
			start = len( string ) - 1

		for i in range( start, -1, -1 ):
			if string[i] in " \t":
				return i

		return -1

	def rfind_non_whitespace( self, string, start = None ):
		if start == None:
			start = len( string ) - 1

		for i in range( start, -1, -1 ):
			if not string[i] in " \t":
				return i

		return -1		


class ImapErrorResponse( BadGateway, TextResponse ):
	def __init__( self, exc ):
		self.exc = exc

	def body( self ):
		return str( self.exc )

class ConnectImapResponse( TemporaryRedirect, TextResponse ):
	def location( self ):
		return '/imap/connect'

	def body( self ):
		return 'Not connected to the IMAP server'
