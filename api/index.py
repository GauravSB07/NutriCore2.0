import os
import sys
from pathlib import Path

# Add project root directory to Python path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'NutriCore.settings')

from django.core.wsgi import get_wsgi_application

django_wsgi_app = get_wsgi_application()

def app(environ, start_response):
    """
    Vercel Serverless WSGI Handler with path normalization.
    Ensures that if Vercel's rewrite engine rewrote PATH_INFO to the function
    file path (e.g. /api/index.py), the original requested URI is restored
    so that Django's URL routing matches accurately.
    """
    path_info = environ.get('PATH_INFO', '')
    if path_info.endswith(('index.py', '/api', '/api/')):
        forwarded_uri = (
            environ.get('HTTP_X_FORWARDED_URI')
            or environ.get('HTTP_X_NOW_ROUTE')
            or environ.get('REQUEST_URI')
        )
        if forwarded_uri:
            clean_path = forwarded_uri.split('?')[0]
            environ['PATH_INFO'] = clean_path

    return django_wsgi_app(environ, start_response)

application = app
