from django.urls import path
from .views import (
    RegisterView,
    LoginView,
    CookieTokenRefreshView,
    MeView,
    LogoutView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='api_register'),
    path('login/', LoginView.as_view(), name='api_login'),
    path('token/refresh/', CookieTokenRefreshView.as_view(), name='api_token_refresh'),
    path('me/', MeView.as_view(), name='api_me'),
    path('logout/', LogoutView.as_view(), name='api_logout'),
]
