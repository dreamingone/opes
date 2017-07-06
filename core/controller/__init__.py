class Controller:
	# This allows routers to keep both types and instances of controllers
	# Normally putting () behind the type creates an instance.
	# Now if it already is an instance it doesn't change anything.
	def __call__( self ):
		return self

	def __getattr__( self, name ):
		# Don't find it in the context when it starts with handle_
		if not name.startswith( 'handle_' ):
			return self.context[ name ]
		return super( Controller, self ).__getattr__( name )

	# The context is assigned from within the routing process, outside the controller itself
	# This constructor creates the attribute so that it exists when the context is assigned
	def __init__( self ):
		self.context = None

	# Will be called before handle is called.
	# Use this to prepare the controller with the given request.
	# Useful when the base of a controller needs to process the request as well.
	def process( self, context ):
		pass

	def handle( self, context ):
		method = context.request.method.lower()

		if hasattr( self, 'handle_' + method ):
			attr = getattr( self, 'handle_' + method )
			return attr( context )
		
		return self.invalid_method_response( context.request.method )

	def invalid_method_response( self, method ):
		raise NotImplementedError()


	def release( self ):
		pass
