from .index import IndexController
from .mail import MailRouter
from .session import CreateSessionController
from .static import StaticRouter
from core.router import Router


class RootRouter( Router ):
	def routes( self ):
		return (
			('', IndexController),
			('mail', MailRouter),
			('session', CreateSessionController),
			('static', StaticRouter)
		)
