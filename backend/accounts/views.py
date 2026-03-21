from rest_framework import generics
from django.contrib.auth.models import User
from .serializers import RegisterSerializer
from django.contrib.auth import authenticate
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.models import User
from .models import LoginAttempt

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer

class LoginView(APIView):
    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        # Check if user exists first
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response(
                {"detail": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Get or create login attempt record
        attempt, _ = LoginAttempt.objects.get_or_create(user=user)
        print(f"attempts={attempt.failed_attempts}, locked_until={attempt.lockout_until}, is_locked={attempt.is_locked()}")

        # Check if the user is locked
        if attempt.is_locked():
            remaining = int((attempt.lockout_until - timezone.now()).total_seconds())

            return Response(
                {"detail": "Account is locked. Try again later.", "remaining_seconds": remaining},
                status=status.HTTP_403_FORBIDDEN
            )
        
        user = authenticate(username=username, password=password)

        if user is None:
            attempt.failed_attempts += 1

            if attempt.failed_attempts >= 5:
                attempt.lockout_until = timezone.now() + timedelta(minutes=2)
                attempt.failed_attempts = 0 # reset the counter after the lock

                attempt.save()

                return Response(
                    {"detail": "Account is locked. Try again later.", "remaining_seconds": 120},
                    status=status.HTTP_403_FORBIDDEN
                )
        
            attempt.save()

            return Response(
                {"detail": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        attempt.failed_attempts = 0
        attempt.lockout_until = None
        attempt.save()

        refresh = RefreshToken.for_user(user)

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh)
        })