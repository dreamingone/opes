class Body:
	def __init__( self, file_, content_length ):
		self._file = file_
		self.length = content_length
		self.read_len = 0

	def close( self ):
		self._file.close()

	def read( self, size = None ):
		# If size is not specified, read everything
		if size == None:
			content = self._file.read( self.length - self.read_len )
			self.read_len = self.length
			return content

		# If size is not overflowing, read size bytes
		if self.read_len + size <= self.length:
			self.read_len += size
			return self._file.read( size )

		# Otherwise if size is too much, give what is left
		left = self.length - self.read_len
		self.read_len = self.length
		return self._file.read( left )
