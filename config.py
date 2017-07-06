class Tls:
	protocol = ''

class Smtp:
	host = 'smtp.ziggo.nl'
	port = 25
	username = None
	password = None
	security = 'none'
	tls_cert_file = '/etc/ssl/public/dreamer.pem'
	tls_key_file = '/etc/ssl/private/dreamer.pem'
	local_hostname = 'test.mail.dreaming.one'

class Imap:
	host = '192.168.1.131'
	port = 993
	username = 'dreamer'
	password = ' '
	security = 'tls'
	tls_cert_file = '/etc/ssl/public/dreamer.pem'
	tls_key_file = '/etc/ssl/private/dreamer.pem'

admin_email = 'info@dreaming.one'
hostname = 'dreaming.one'

server_host = '0.0.0.0'
server_port = 8080

codes_file = 'codes'
maildir_path = '/home/danny/mail'
gnupg_path = '/home/%s/pubring.gpg'
adduser_cmd = 'addmailuser %s'
