from django.apps import AppConfig

import sys
import os


class AccountsConfig(AppConfig):
    name = 'accounts'

    def ready(self):
        if 'makemigrations' in sys.argv or 'migrate' in sys.argv:
            return
        
        if os.environ.get('RUN_MAIN') != 'true' or 'runserver' not in sys.argv:
            from .import jobs
            jobs.start()
