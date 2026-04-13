from django.apps import AppConfig

import sys
import os
import threading


class AccountsConfig(AppConfig):
    name = 'accounts'

    def ready(self):
        # Skip if performing maintenance commands
        ignored_cmds = ['makemigrations', 'migrate', 'collectstatic', 'shell']
        if any(cmd in sys.argv for cmd in ignored_cmds):
            return
        
        if os.environ.get('RUN_MAIN') == 'true':
            from .import jobs
            threading.Thread(target=jobs.start, daemon=True).start()
