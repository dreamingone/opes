from .context import Context
import jinja2
import gettext


class Template:
	def __init__( self, filename: str, context: Context ):		
		jinja_env = jinja2.Environment( loader=jinja2.FileSystemLoader('template/') )
		if translation != None:
			jinja_env.install_gettext_translations( translation )
		self.template = jinja_env.get_template( filename )

		self.context = context
		

	def __call__( self, **kwargs ):
		return self.template.render( **kwargs )
