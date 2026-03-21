import re
from django.core.exceptions import ValidationError

class StrongPasswordValidator:
    def validate(self, password, user=None):
        if not re.search(r'[A-Z]', password):
            raise ValidationError("Password needs to have at least one capital letter.")
        if not re.search(r'[a-z]', password):
            raise ValidationError("Password needs to have at least one lowercase letter.")
        if not re.search(r'[0-9]', password):
            raise ValidationError("Password needs to have at least one digit.")
        if not re.search(r'[\W_]', password):
            raise ValidationError("Password needs to have at least one symbol.")