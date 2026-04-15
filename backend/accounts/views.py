from rest_framework import generics
from django.contrib.auth.models import User
from .serializers import RegisterSerializer, RecordingSerializer, FolderSerializer, UserSearchSerializer, LoginLogSerializer
from django.contrib.auth import authenticate
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.models import User
from .models import LoginAttempt, Recording, UserProfile, Folder, LoginLog
import base64
import secrets

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        # Create random salt for encryption key
        salt = secrets.token_hex(16)
        UserProfile.objects.create(user=user, encryption_salt=salt)

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

        # Fetch user's salt
        profile, created = UserProfile.objects.get_or_create(
            user=user,
            defaults={"encryption_salt": secrets.token_hex(16)}
        )

        log = LoginLog.objects.create(user=user)

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "salt": profile.encryption_salt,
            "log_id": log.id,
        })
    
class RecordingListView(APIView):
    # Only logged in users can access
    permission_classes = [IsAuthenticated]

    def get(self, request):
        folder_id = request.query_params.get("folder_id")
        is_decoy = request.query_params.get("is_decoy", "false") == "true"

        if folder_id:
            recordings = Recording.objects.filter(
                user=request.user,
                folder_id=folder_id,
                is_decoy=is_decoy,
            ).order_by('-created_at')
        else:
            recordings = Recording.objects.filter(
                user=request.user,
                folder__isnull=True,
                shared_by__isnull=True,
            ).order_by('-created_at')
        serializer = RecordingSerializer(recordings, many=True)
        return Response(serializer.data)
    
    def post(self, request):
        name = request.data.get("name")
        name_iv = request.data.get("name_iv")
        duration = request.data.get("duration")
        audio_b64 = request.data.get("audio_data")
        iv = request.data.get("iv")
        expires_at = request.data.get("expires_at")
        folder_id = request.data.get("folder_id")

        if not all([name, name_iv, duration, audio_b64, iv]):
            return Response({"detail": "Missing fields."}, status=status.HTTP_400_BAD_REQUEST)
        
        audio_bytes = base64.b64decode(audio_b64)

        is_decoy = request.data.get("is_decoy", False)

        file_hash = request.data.get("file_hash")

        recording = Recording.objects.create(
            user=request.user,
            name=name,
            name_iv=name_iv,
            duration=int(duration),
            audio_data=audio_bytes,
            iv=iv,
            expires_at=expires_at if expires_at else None,
            folder_id=folder_id if folder_id else None,
            is_decoy=is_decoy,
            file_hash=file_hash,
        )

        return Response(RecordingSerializer(recording).data, status=status.HTTP_201_CREATED)

class RecordingDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            recording = Recording.objects.get(pk=pk, user=request.user)
            recording.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Recording.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, pk):
        try:
            recording = Recording.objects.get(pk=pk, user=request.user)
            name = request.data.get("name", "").strip()
            name_iv = request.data.get("name_iv", "").strip()
            if not name or not name_iv:
                return Response({"detail": "Name cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)
            recording.name = name
            recording.name_iv = name_iv
            recording.save()
            return Response(RecordingSerializer(recording).data)
        except Recording.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        
class FolderListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        folders = Folder.objects.filter(user=request.user).order_by('-created_at')
        serializer = FolderSerializer(folders, many=True)
        return Response(serializer.data)
    
    def post(self, request):
        name = request.data.get("name")
        name_iv = request.data.get("name_iv")
        has_password = request.data.get("has_password", False)
        folder_salt = request.data.get("folder_salt", None)

        if not all([name, name_iv]):
            return Response({"detail": "Fields are missing."}, status=status.HTTP_400_BAD_REQUEST)
        
        password_check = request.data.get("password_check", None)
        password_check_iv = request.data.get("password_check_iv", None)

        decoy_salt = request.data.get("decoy_salt", None)
        decoy_check = request.data.get("decoy_check", None)
        decoy_check_iv = request.data.get("decoy_check_iv", None)
        
        folder = Folder.objects.create(
            user=request.user,
            name=name,
            name_iv=name_iv,
            has_password=has_password,
            folder_salt=folder_salt,
            password_check=password_check,
            password_check_iv=password_check_iv,
            decoy_salt=decoy_salt,
            decoy_check=decoy_check,
            decoy_check_iv=decoy_check_iv,
        )
        return Response(FolderSerializer(folder).data, status=status.HTTP_201_CREATED)

class FolderDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            folder = Folder.objects.get(pk=pk, user=request.user)
            return Response(FolderSerializer(folder).data)
        except Folder.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk):
        try:
            folder = Folder.objects.get(pk=pk, user=request.user)
            folder.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Folder.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        
    def patch(self, request, pk):
        try:
            folder = Folder.objects.get(pk=pk, user=request.user)
            name = request.data.get("name", "").strip()
            name_iv = request.data.get("name_iv", "").strip()
            if not name or not name_iv:
                return Response({"detail": "Name cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)
            folder.name = name
            folder.name_iv = name_iv
            folder.save()
            return Response(FolderSerializer(folder).data)
        except Folder.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        
class UserSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()

        if not query:
            return Response([])
        
        users = User.objects.filter(
            username__icontains=query
        ).exclude(id=request.user.id)[:10]

        serializer = UserSearchSerializer(users, many=True)
        return Response(serializer.data)
    
class SharedRecordingListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = RecordingSerializer

    def get_queryset(self):
        return Recording.objects.filter(user=self.request.user).exclude(shared_by=None).order_by('-created_at')

class RecordingShareView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            original_recording = Recording.objects.get(pk=pk, user=request.user)
        except Recording.DoesNotExist:
            return Response({"detail": "Recording not found."}, status=status.HTTP_404_NOT_FOUND)
        
        recipient_id = request.data.get("recipient_id")
        audio_data = request.data.get("audio_data")

        try:
            recipient = User.objects.get(pk=recipient_id)
        except User.DoesNotExist:
            return Response({"detail": "Recipient not found."}, status=status.HTTP_404_NOT_FOUND)
        
        name = request.data.get("name")
        name_iv = request.data.get("name_iv")

        Recording.objects.create(
            user=recipient,
            shared_by=request.user,
            name=name,
            name_iv=name_iv,
            audio_data=base64.b64decode(audio_data),
            iv=request.data.get("iv"),
            duration=original_recording.duration,
            salt=request.data.get("salt"),
            file_hash=original_recording.file_hash,
        )

        return Response({"detail": "Shared successfully."}, status=status.HTTP_201_CREATED)
    
class LoginLogListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        logs = LoginLog.objects.filter(user=request.user).order_by('-logged_in_at')
        serializer = LoginLogSerializer(logs, many=True)
        return Response(serializer.data)
    
class LoginLogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        log_id = request.data.get("log_id")
        try:
            log = LoginLog.objects.get(id=log_id, user=request.user)
            log.logged_out_at = timezone.now()
            log.save()
            return Response({"detail": "Log out recorded."})
        except LoginLog.DoesNotExist:
            return Response({"detail": "Log not found."}, status=status.HTTP_404_NOT_FOUND)