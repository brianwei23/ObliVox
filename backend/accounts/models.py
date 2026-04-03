from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class LoginAttempt(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    failed_attempts = models.IntegerField(default=0)
    lockout_until = models.DateTimeField(null=True, blank=True)

    def is_locked(self):
        return self.lockout_until and self.lockout_until > timezone.now()

class Recording(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="recordings")
    name = models.TextField()
    name_iv = models.CharField(max_length=64)
    audio_data = models.BinaryField() 
    iv = models.CharField(max_length=64)
    duration = models.IntegerField() # in seconds
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.name}"
    
class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    encryption_salt = models.CharField(max_length=64)