from core.view import View
from main.session import SessionController


class IndexController( SessionController ):
	def handle_get( self, context ):
		return IndexView( context )

class IndexView( View ):
	def html( self ):
		f = open( 'template/index.html', 'r' )
		html = f.read()
		f.close()
		return html
