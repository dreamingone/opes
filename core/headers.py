# The Headers class is like a dictionary but is able to store multiple name-value pairs with the same name
class Headers:
	def __init__( self ): # For some reason, when an argument index = [] is provided, it seems to be loaded with a previous headers contents... strange...
		#print("init", index)
		#if ( len( index ) > 20 ):
		#	raise Exception()

		#for name, value in index:
		#	pass
		self.index = []

	def __contains__( self, name ):
		for own_name, value in self.index:
			if name.lower() == own_name.lower():
				return True
		return False

	def __getitem__( self, name ):
		for i in range( len( self.index ) ):
			if name.lower() == self.index[i][0].lower():
				return self.index[i][1]

	def __iter__( self ):
		return HeadersIterator( self )

	def __setitem__( self, name, value ):
		updated = False
		for i in range( len( self.index ) ):
			if name.lower() == self.index[i][0].lower():
				self.index[i][1] = value
				updated = True

		if not updated:
			self.index.append( ( name, value ) )

		return self

	def add( self, name, value ):
		#print('before', self.index)
		self.index.append( (name, value) )
		#print('after', self.index)

class HeadersIterator:
	def __init__( self, headers, index = 0 ):
		self.headers = headers
		self.index = index

	def __next__( self ):
		if self.index >= len( self.headers.index ):
			raise StopIteration()

		result = self.headers.index[ self.index ]
		self.index += 1

		return result
