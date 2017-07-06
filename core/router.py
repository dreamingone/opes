from .controller import Controller
from .qualifier import Qualifier


class InvalidRouteError: pass

class Router( Controller ):
	# The controller to use when no subpath is specified
	# By default it uses the controller with route '', otherwise it uses itself (a router is a controller also)
	def default( self ):
		routes = self.routes()
		for qualifier, controller in routes:
			if qualifier == '':
				return controller
		raise NotImplementedError()

	def route( self, context, routes ):
		if len( routes ) == 0:
			try:
				controller_type = self.default()
			except NotImplementedError:
				return self.not_found_response( context, routes )

		else:
			route_index = self.routes()
	
			# First find the required controller (or router)
			controller_type = None
			for route_entry in route_index:
				qualifier = route_entry[0]

				if isinstance( qualifier, Qualifier ):
					if qualifier.qualifies( routes[0] ):
						controller_type = route_entry[1]
						break
				else:	# Otherwise we just compare it as a string
					if str(routes[0]) == qualifier:
						controller_type = route_entry[1]
						break
			if controller_type == None:
				return self.not_found_response( context, routes )

		controller = controller_type()
		
		controller.process( context )
		if isinstance( controller, Router ) and len( routes ) > 0:
			resp = controller.route( context, routes[1:] )
		elif isinstance( controller, Controller ):
			resp = controller.handle( context )
		else:
			raise InvalidRouteError()

		controller.release()
		return resp

	def not_found_response( self, context, routes ):
		raise NotImplementedError()

	def handle( self, context ):
		routes = context.request.uri.path
		
		return self.route( context, routes )

	def routes( self ):
		return []
