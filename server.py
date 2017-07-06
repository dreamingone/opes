from wsgiref.simple_server import make_server
from main.root import RootRouter
from core.server import Application
import ssl
import config


httpd = make_server( config.server_host, config.server_port, Application( RootRouter ) )
#ssl_context = ssl.SSLContext( ssl.OP_NO_TLSv1 )
#ssl_context.load_cert_chain( 'cert.pem' )
#httpd.socket = ssl.wrap_socket (httpd.socket, keyfile='key.pem', certfile='cert.pem', server_side=True)
httpd.serve_forever()
