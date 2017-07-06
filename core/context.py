class Context:
	_table = {}

	def __contains__( self, name ):
		return name in self._table

	def __getattr__( self, name ):
		return self._table[ name ]

	def __getitem__( self, name ):
		return self._table[ name ]

	def __setattr__( self, name, value ):
		self._table[ name ] = value
