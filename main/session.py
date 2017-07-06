from core.context import Context
from core.response import Response
from core.response.error import BadRequest, TemporaryRedirect
from core.uri import Uri
from .base import BaseController
from threading import Lock
from random import randint
import time


class SessionController( BaseController ):
	sessions = {}
	sessions_lock = Lock()
	max_session_age = 15*60*1000	# 15 minutes

	CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

	def random_code( self ):
		code = ''

		for i in range( 64 ):
			index = randint( 0, len( SessionController.CHARS )-1 )
			code += SessionController.CHARS[ index ]

		return code

	def new_code( self ):
		while True:
			code = self.random_code()
			if not code in SessionController.sessions:
				break

		return code

	def handle( self, context ):
		session_id = None
		cookie = context.request.cookie()
		if cookie != None:
			print( cookie.jar, SessionController.sessions )
			if 'session' in cookie:
				session_id = cookie['session']

		SessionController.sessions_lock.acquire()

		# If not session id was provided, redirect to the session page
		if session_id == None:
			return self.create_cookie( context )

		# If no session context exists yet, create one
		if not session_id in SessionController.sessions:
			return self.create_cookie( context )
		else:
			if SessionController.sessions[ session_id ][1] + SessionController.max_session_age < time.time():
				return self.create_cookie( context )
			context.session = SessionController.sessions[ session_id ][0]
			SessionController.sessions[ session_id ] = ( context.session, time.time() )

		# Remove all old sessions
		# TODO: Make a seperate thread that does the garbage collection.
		# Right now sessions don't really get deleted when there is just one
		self.garbage_collect()
		SessionController.sessions_lock.release()

		return super( SessionController, self ).handle( context )

	def garbage_collect( self ):
		for session_id, session in SessionController.sessions.items():
			context, last_use = session
			if last_use + SessionController.max_session_age < time.time():
				del SessionController.sessions[ session_id ]

	def create_cookie( self, context ):
		code = self.new_code()
		session = Context()
		SessionController.sessions[ code ] = ( session, time.time() )
		SessionController.sessions_lock.release()

		context.session = session
		resp = CreateSessionResponse( super( SessionController, self ).handle( context ), code )
		return resp
	

class CreateSessionResponse( Response ):
	def __init__( self, response, session_id ):
		self.response = response
		self.session_id = session_id

	def body( self ):
		return self.response.body()

	def headers( self ):
		hs = self.response.headers()
		hs['Set-Cookie'] = 'session=' + self.session_id + '; HttpOnly'
		return hs

	def status_code( self ):
		return self.response.status_code()

	def status_message( self ):
		return self.response.status_message()

class CreateSessionController( BaseController ):

	# TODO: Create a login system where the user logs in by signing a (by the server generated) random nonce
	def handle_get( self, context ):
		SessionController.sessions_lock.acquire()
		code = self.new_code()
		SessionController.sessions[ code ] = ( Context(), time.time() )
		SessionController.sessions_lock.release()
		print( 'adsfdddd', SessionController.sessions )

		return CreateSessionResponse( code, context.request.uri.query['redirect'] if (context.request.uri.query != None and 'redirect' in context.request.uri.query ) else None )
