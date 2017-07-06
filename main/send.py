from email.parser import BytesParser
from mycore.controller import Controller
from mycore.response.error import BadRequest as BadRequestResponse, InternalServerError as InternalServerErrorResponse
from mycore.response.content import Text as TextResponse
from mycore.uri import Uri
import config
import smtplib


class SendController( Controller ):
	def parse_address_list( self, addr_list ):
		return [ self.remove_whitespace(x) for x in addr_list.split(',') ]

	def handle_post( self, request ):
		username = self.environ['SSL_CLIENT_S_DN_CN']
		query = Uri.parse_query( request.body.read().decode('ascii') )

		from_addr = None
		if 'from' in query:
			from_addr = self.remove_whitespace( query['from'] )
		else:
			return MissingFieldResponse( 'from' )
			
		to_addr = []
		if 'to' in query:
			to_addr = self.parse_address_list( query['to'] )
		else:
			return MissingFieldResponse( 'to' )
		cc_addr = []
		if 'cc' in query:
			cc_addr = self.parse_address_list( query['cc'] )
		else:
			return MissingFieldResponse( 'cc' )
		bcc_addr = []
		if 'bcc' in query:
			bcc_addr = self.parse_address_list( query['bcc'] )
		else:
			return MissingFieldResponse( 'bcc' )

		if 'body' in query:
			body = query['body']
		else:
			return MissingFieldResponse( 'body' )

		mime = ''
		if from_addr == None or from_addr == '':
			mime += 'From: ' + username + '@' + config.hostname + '\r\n'
		else:
			mime += 'From: ' + from_addr + '\r\n'

		if len( to_addr ) > 0:
			mime += 'To: ' + ', '.join( to_addr ) + '\r\n'
		if len( cc_addr ) > 0:
			mime += 'CC: ' + ', '.join( cc_addr ) + '\r\n'

		mime += 'Content-Type: text/plain\r\n'

		mime += '\r\n' + body

		to_addrs = to_addr + cc_addr + bcc_addr
			
		try:
			smtp = smtplib.SMTP( config.Smtp.host, config.Smtp.port, config.Smtp.local_hostname )
			smtp.sendmail( from_addr, to_addrs, mime )
			smtp.quit()
		except smtplib.SMTPResponseException as e:
			return SmtpErrorResponse( e )

		return smtp

	def remove_whitespace( self, string ):
		print( "aaa", string, string.replace(' ', '') )
		return string.replace(' ', '').replace('\t', '')
		

class SmtpErrorResponse( InternalServerErrorResponse, TextResponse ):
	def __init__( self, exc ):
		self.exc = exc

	def body( self ):
		return 'SMTP Error ' + self.exc.smtp_code + ': ' + self.exc.smtp_error

class NoRecipientsResponse( BadRequestResponse, TextResponse ):
	def body( self ):
		return 'No recipients in either the To, CC or BCC fields.'

class MissingFieldResponse( BadRequestResponse, TextResponse ):
	def __init__( self, field_name ):
		self.field_name = field_name

	def body( self ):
		return 'Missing field "' + self.field_name + '".'
