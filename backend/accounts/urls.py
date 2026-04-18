from django.urls import path, include
from django.http import JsonResponse
from .views import RegisterView, LoginView, RecordingListView, RecordingDetailView, FolderListView, FolderDetailView, SharedRecordingListView, UserSearchView, RecordingShareView, LoginLogListView, LoginLogoutView, cleanup_expired_recordings 
from rest_framework_simplejwt.views import TokenRefreshView


urlpatterns = [
    path('register/', RegisterView.as_view()),
    path('login/', LoginView.as_view()),
    path('recordings/', RecordingListView.as_view()),
    path('recordings/<int:pk>/', RecordingDetailView.as_view()),
    path('token/refresh/', TokenRefreshView.as_view()),
    path('folders/', FolderListView.as_view()),
    path('folders/<int:pk>/', FolderDetailView.as_view()),
    path('users/search/', UserSearchView.as_view(), name='user-search'),
    path('recordings/<int:pk>/share/', RecordingShareView.as_view(), name='share-recording'),
    path('recordings/shared/', SharedRecordingListView.as_view(), name='shared-recordings'),
    path('logs/', LoginLogListView.as_view(), name='login-logs'),
    path('logs/logout/', LoginLogoutView.as_view(), name='login-logout'),
    path("cleanup/", cleanup_expired_recordings),
]