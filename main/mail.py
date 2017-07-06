from email.parser import BytesParser
from core.router import Router
from core.response.content import Json as JsonResponse, Text as TextResponse
from core.response.error import BadGateway, NotFound, TemporaryRedirect
from core.uri import Uri
from .error import BadRequestResponse, SuccessResponse
from .session import SessionController
from imaplib import IMAP4, IMAP4_SSL
from smtplib import SMTP, SMTP_SSL, SMTPException
import config
import ssl
import base64
from datetime import datetime, timedelta


# TODO: Implement a default controller that allows changing (POST) and viewing (GET) IMAP settings
class MailRouter( Router ):
	def routes( self ):
		return [
			('fetch', FetchMailController),	# Download a whole message
			('folders', FoldersMailController),	# List all folders
			('imap', ImapMailController),	# Change IMAP settings
			('list', ListMailController),	# Download message headers
			('send', SendMailController)	# Send a message
		]

class ImapController( SessionController ):
	def handle( self, context ):
		if not 'imap' in context.session:
			context.session.imap = ImapSettings( config.Imap.host, config.Imap.port, config.Imap.username, config.Imap.password, config.Imap.security )

		return super( ImapController, self ).handle( context )

class SmtpController( SessionController ):
	def handle( self, context ):
		if not 'smtp' in context.session:
			context.session.smtp = SmtpSettings( config.Smtp.host, config.Smtp.port, config.Smtp.username, config.Smtp.password, config.Smtp.security )

		return super( SmtpController, self ).handle( context )

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

class SmtpSettings:
	def __init__( self, host, port, username, password, security ):
		self.host = host
		self.port = port
		self.username = username
		self.password = password
		self.security = security

	def connect( self ):
		if self.security == 'none' or self.security == '':
			smtp = SMTP( self.host, self.port )
		else:
			ssl_context = ssl.SSLContext( ssl.PROTOCOL_TLSv1 )
			ssl_context.load_cert_chain( config.Smtp.tls_cert_file, config.Smtp.tls_key_file )
			if self.security == 'starttls':
				smtp = SMTP( self.host, self.port )
				smtp.starttls( ssl_context )
			elif self.security == 'tls':
				smtp = SMTP_SSL( self.host, self.port, ssl_context = ssl_context )

		if self.username != None:
			smtp.login( self.username, self.password )

		return smtp

class ImapMailController( SessionController ):
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

class ListMailController( ImapController ):
	def parse_list( self, ls ):
		parsed = []

		for item in ls:
			item_str = item.decode('ascii')
			i = item_str.find( ')' )
			i  = item_str.find( '"', i+1 )
			i  = item_str.find( '"', i+1 )
			i = self.find_non_whitespace( item_str, i+1 )
			j = self.rfind_non_whitespace( item_str )
			filename = item_str[i:j+1].strip( '"' )
			parsed.append( self.remove_quotes( filename ) )

		return parsed

	def remove_quotes( self, string ):
		if string[0] == '"' and string[-1] == '"':
			return string[ 1: -1 ]
		return string

	def find_non_whitespace( self, string, start = 0 ):
		for i in range( start, len( string ) ):
			if not string[i] in " \t":
				return i

		return -1

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
			print( folders )
			mail_list = {}

			for folder in folders:
				selected = imap.select( '"' + folder + '"' )
				print(selected)

				date_str = date.strftime( "%d-%b-%Y" )
				_, ids = imap.search( None, '(SINCE "%s")' % ( date_str ) )
				print(_, ids)
			
				# Parse the list of ID's		
				id_list = ids[0].decode('ascii').split(' ')
				folder_list = []
				if not ( len( id_list ) == 1 and id_list[0] == '' ):
					for id_ in id_list:
						fetched = imap.fetch( id_, '(BODY.PEEK[HEADER.FIELDS (SUBJECT FROM DATE MESSAGE-ID IN-REPLY-TO)])' )
						msg = fetched[1][0][1].decode('ascii')
				
						folder_list.append( msg )

				mail_list[ folder ] = folder_list

			imap.logout()
		except IMAP4.error as e:
			return ImapErrorResponse( e )

		return JsonResponse( mail_list )

class FetchMailController( ImapController ):
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
			print( selected )
			_, imap_id_ = imap.search( None, 'HEADER Message-ID ' + msg_id )
			imap_id = imap_id_[0].decode('ascii')
			if len( imap_id ) == 0:
				return MailNotFoundResponse( msg_id )			

			print( 'fetch', len( imap_id ), '"' + imap_id + '"' )
			fetched = imap.fetch( imap_id, '(RFC822)' )

			msg = base64.encodebytes( fetched[1][0][1] ).decode('ascii')

			imap.logout()
		except IMAP4.error as e:
			return ImapErrorResponse( e )

		return TextResponse( msg )

class FoldersMailController( ImapController ):
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

class SendMailController( SmtpController ):
	def handle_post( self, context ):
		query = Uri.parse_query( context.request.body.read().decode('ascii') )

		if not 'from' in query:
			return BadRequestResponse( 'Field "from" not available' )
		from_ = query['from']
		if not 'to[]' in query:
			return BadRequestResponse( 'No "to" field available' )
		tos = query['to[]']
		if not 'data' in query:
			return BadRequestResponse( 'Field "data" not available' )
		data = query['data']

		try:
			smtp = context.smtp.connect()

			smtp.sendmail( from_, tos, data )

			smtp.quit()
		except SMTPException as e:
			return SmtpErrorResponse( e )

		return SuccessResponse( 'Mail sent' )


class MailNotFoundResponse( NotFound, TextResponse ):
	def __init__( self, msg_id ):
		self.msg_id = msg_id

	def body( self ):
		return 'Message ID "%s" not found' % self.msg_id

class ImapErrorResponse( BadGateway, TextResponse ):
	def __init__( self, exc ):
		self.exc = exc

	def body( self ):
		return str( self.exc )

class SmtpErrorResponse( BadGateway, TextResponse ):
	def __init__( self, exc ):
		self.exc = exc

	def body( self ):
		return str( self.exc )
