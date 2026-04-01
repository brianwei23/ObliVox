from django.urls import path
from .views import RegisterView, LoginView, RecordingListView, RecordingDetailView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('register/', RegisterView.as_view()),
    path('login/', LoginView.as_view()),
    path('recordings/', RecordingListView.as_view()),
    path('recordings/<int:pk>/', RecordingDetailView.as_view()),
    path('token/refresh/', TokenRefreshView.as_view()),
]