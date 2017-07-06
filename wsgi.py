import os
import sys
# Because for some reason the working dir isn't changed:
os.chdir( '/var/www/mail.dreaming.one' )
sys.path.append( '/var/www/mail.dreaming.one' )

from mycore.server import Application
from myapp.root import RootRouter

def application( environ, start_response ):
        return Application( RootRouter )( environ, start_response )

