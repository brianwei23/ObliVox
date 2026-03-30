from django.urls import path
from .views import RegisterView, LoginView, RecordingListView

urlpatterns = [
    path('register/', RegisterView.as_view()),
    path('login/', LoginView.as_view()),
    path('recordings/', RecordingListView.as_view()),
]