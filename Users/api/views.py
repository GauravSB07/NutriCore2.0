from django.conf import settings
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    UserSerializer,
    UserUpdateSerializer,
    LogoutSerializer,
)

REFRESH_COOKIE_NAME = 'refresh_token'
REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60  # 7 days


def get_refresh_cookie_samesite():
    return getattr(settings, 'REFRESH_COOKIE_SAMESITE', 'Lax')


def get_refresh_cookie_secure():
    return getattr(settings, 'REFRESH_COOKIE_SECURE', not settings.DEBUG)


def set_refresh_cookie(response, token_str):
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token_str,
        max_age=REFRESH_COOKIE_MAX_AGE,
        httponly=True,
        secure=get_refresh_cookie_secure(),
        samesite=get_refresh_cookie_samesite(),
        path='/',
    )


def clear_refresh_cookie(response):
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path='/',
        samesite=get_refresh_cookie_samesite(),
    )


class RegisterView(APIView):
    """
    POST /api/v1/auth/register/
    Registers a new user, auto-creates their profile, and returns JWT tokens + user profile.
    Sets HttpOnly refresh token cookie for session persistence.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = RegisterSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            resp = Response(
                {
                    'message': 'User registered successfully.',
                    'tokens': {
                        'refresh': str(refresh),
                        'access': str(refresh.access_token),
                    },
                    'user': UserSerializer(user, context={'request': request}).data,
                },
                status=status.HTTP_201_CREATED,
            )
            set_refresh_cookie(resp, str(refresh))
            return resp
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """
    POST /api/v1/auth/login/
    Authenticates existing user with username/password and returns JWT tokens + user profile.
    Sets HttpOnly refresh token cookie for session persistence.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)
        resp = Response(
            {
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                },
                'user': UserSerializer(user, context={'request': request}).data,
            },
            status=status.HTTP_200_OK,
        )
        set_refresh_cookie(resp, str(refresh))
        return resp


class CookieTokenRefreshView(TokenRefreshView):
    """
    POST /api/v1/auth/token/refresh/
    Supports reading refresh token from request body or from HttpOnly cookie.
    If a new rotated refresh token is produced, the HttpOnly cookie is updated.
    """
    def post(self, request, *args, **kwargs):
        data = request.data
        if not data.get('refresh') and REFRESH_COOKIE_NAME in request.COOKIES:
            data = data.copy() if hasattr(data, 'copy') else dict(data)
            data['refresh'] = request.COOKIES.get(REFRESH_COOKIE_NAME)

        serializer = self.get_serializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            return Response(
                {'detail': 'Token is invalid or expired'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        resp = Response(serializer.validated_data, status=status.HTTP_200_OK)
        new_refresh = serializer.validated_data.get('refresh')
        if new_refresh:
            set_refresh_cookie(resp, str(new_refresh))
        elif REFRESH_COOKIE_NAME in request.COOKIES:
            set_refresh_cookie(resp, request.COOKIES.get(REFRESH_COOKIE_NAME))
        return resp


class MeView(generics.RetrieveUpdateAPIView):
    """
    GET /api/v1/auth/me/
    Retrieves the currently authenticated user's profile.

    PATCH / PUT /api/v1/auth/me/
    Updates user account or profile fields.
    """
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return UserUpdateSerializer
        return UserSerializer

    def get_object(self):
        return self.request.user


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/
    Blacklists the provided refresh token (from body or HttpOnly cookie) so it cannot be reused.
    Clears the HttpOnly refresh token cookie upon logout.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        data = request.data
        token = data.get('refresh') or request.COOKIES.get(REFRESH_COOKIE_NAME)
        if not token:
            resp = Response(
                {'detail': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
            clear_refresh_cookie(resp)
            return resp

        serializer = LogoutSerializer(data={'refresh': token})
        if serializer.is_valid():
            resp = Response(
                {'message': 'Successfully logged out.'},
                status=status.HTTP_200_OK,
            )
            clear_refresh_cookie(resp)
            return resp

        resp = Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        clear_refresh_cookie(resp)
        return resp
