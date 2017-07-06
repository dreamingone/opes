import config
from smtplib import SMTP, SMTP_SSL
from gnupg import GPG


gpg = GPG( homedir=config.gnupg_home )

class Email:
	def __init__( self ):
		# Send the message
		if config.Smtp.security == 'tls':
			self.smtp = SMTP_SSL( config.Smtp.host, config.Smtp.port, config.Smtp.local_hostname, config.Smtp.tls_cert_file, config.Smtp.tls_key_file )
		else:
			self.smtp = SMTP( config.Smtp.host, config.Smtp.port, config.Smtp.local_hostname )
			if config.Smtp.security == 'starttls':
				self.smtp.starttls( config.Smtp.tls_cert_file, config.Smtp.tls_key_file )

		if config.Smtp.username != None:
			self.smtp.login( config.Smtp.username, config.Smtp.password )

	def close( self ):
		self.smtp.quit()

	def construct_message( self, from_addr, to_addr, body, headers ):
		if not 'From' in headers:
			headers['From'] = from_addr
		if not 'To' in headers:
			headers['To'] = to_addr

		message = ''
		for name, value in headers.items():
			message += name + ': ' + value + '\r\n'

		message += '\r\n' + body
		
		return message

	def send( self, from_addr, to_addr, body, headers = {} ):
		self.smtp.sendmail( from_addr, to_addr, self.construct_message( from_addr, to_addr, body, headers ) )

	def send_private( self, from_addr, to_addr, body, headers = {} ):
		plaintext = self.construct_message( from_addr, to_addr, body, headers )
		crypted = gpg.encrypt( plaintext, config.gnupg_fingerprint, armor=True )

		mime = 'From: %s\r\nTo: %s\r\nContent-Type: %s\r\n' % ( headers['From'], headers['To'], 'text/plain' )
		if 'Date' in headers:
			mime += 'Date: %s\r\n' % headers['Date']
		mime += '\r\n%s' % crypted

		self.smtp.sendmail( from_addr, to_addr, mime )

def send( from_addr, to_addr, body, headers = {} ):
	email = Email()
	email.send( from_addr, to_addr, body, headers )
	email.close()
