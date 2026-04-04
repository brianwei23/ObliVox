from django.contrib.auth.models import User
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import Recording, Folder
import base64

class RegisterSerializer(serializers.ModelSerializer):

    class Meta:
        model = User
        fields = ['username', 'password']

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists.")
        return value
    
    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)
    
class RecordingSerializer(serializers.ModelSerializer):
    # Convert binary audio data to base64 string for sending to frontend
    audio_data = serializers.SerializerMethodField()

    class Meta:
        model = Recording
        fields = ['id', 'name', 'name_iv', 'audio_data', 'iv', 'duration', 'expires_at', 'created_at']

    def get_audio_data(self, obj):
        return base64.b64encode(bytes(obj.audio_data)).decode('utf-8')
    
class FolderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Folder
        fields = ['id', 'name', 'name_iv', 'created_at']