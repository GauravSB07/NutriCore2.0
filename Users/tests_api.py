from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken
from Users.models import Profile


class AuthAPITests(APITestCase):
    def setUp(self):
        self.register_url = reverse('api_register')
        self.login_url = reverse('api_login')
        self.refresh_url = reverse('api_token_refresh')
        self.me_url = reverse('api_me')
        self.logout_url = reverse('api_logout')

        self.test_username = 'testfituser'
        self.test_email = 'testfit@example.com'
        self.test_password = 'ComplexPassword123!'

        self.user = User.objects.create_user(
            username=self.test_username,
            email=self.test_email,
            password=self.test_password,
        )

    def test_successful_registration(self):
        """Test registration creates user, profile, returns tokens, and does not leak password."""
        payload = {
            'username': 'brandnewuser',
            'email': 'brandnew@example.com',
            'password': 'SecureP@ssw0rd2026',
            'password_confirm': 'SecureP@ssw0rd2026',
            'goal': 'muscle_gain',
            'height': 178.5,
            'weight': 74.0,
            'daily_calorie_target': 2500,
            'daily_protein_target': 150,
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('tokens', response.data)
        self.assertIn('access', response.data['tokens'])
        self.assertIn('refresh', response.data['tokens'])
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['username'], 'brandnewuser')

        # Verify password is never returned
        self.assertNotIn('password', response.data)
        self.assertNotIn('password', response.data['user'])

        # Verify user exists in database with correctly hashed password
        created_user = User.objects.get(username='brandnewuser')
        self.assertTrue(created_user.check_password('SecureP@ssw0rd2026'))

        # Verify profile was created and customized
        self.assertEqual(created_user.profile.goal, 'muscle_gain')
        self.assertEqual(created_user.profile.height, 178.5)
        self.assertEqual(created_user.profile.weight, 74.0)
        self.assertEqual(created_user.profile.daily_calorie_target, 2500)

    def test_duplicate_registration_rejected(self):
        """Test that registering an already existing username returns 400 error."""
        payload = {
            'username': self.test_username,  # already created in setUp
            'email': 'another@example.com',
            'password': 'SecureP@ssw0rd2026',
            'password_confirm': 'SecureP@ssw0rd2026',
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data)

    def test_registration_password_mismatch(self):
        """Test registration fails if passwords do not match."""
        payload = {
            'username': 'mismatchuser',
            'password': 'PasswordOne123!',
            'password_confirm': 'PasswordTwo999!',
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password_confirm', response.data)

    def test_successful_login(self):
        """Test valid credentials return access & refresh tokens plus user data."""
        payload = {
            'username': self.test_username,
            'password': self.test_password,
        }
        response = self.client.post(self.login_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('tokens', response.data)
        self.assertIn('access', response.data['tokens'])
        self.assertIn('refresh', response.data['tokens'])
        self.assertEqual(response.data['user']['username'], self.test_username)
        self.assertNotIn('password', response.data)
        self.assertNotIn('password', response.data['user'])

    def test_login_invalid_credentials_rejected(self):
        """Test wrong password or nonexistent username returns 401 Unauthorized."""
        payload = {
            'username': self.test_username,
            'password': 'WrongPassword123!',
        }
        response = self.client.post(self.login_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        payload_nonexistent = {
            'username': 'nonexistentuser',
            'password': 'SomePassword123!',
        }
        response_nonexistent = self.client.post(self.login_url, payload_nonexistent, format='json')
        self.assertEqual(response_nonexistent.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_refresh(self):
        """Test that a valid refresh token generates a new access token."""
        refresh = RefreshToken.for_user(self.user)
        payload = {'refresh': str(refresh)}

        response = self.client.post(self.refresh_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_token_refresh_invalid_rejected(self):
        """Test invalid refresh token returns 401."""
        response = self.client.post(self.refresh_url, {'refresh': 'invalid.token.here'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_user_profile_retrieval(self):
        """Test GET /api/v1/auth/me/ with valid Bearer token returns profile."""
        refresh = RefreshToken.for_user(self.user)
        access_token = str(refresh.access_token)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], self.test_username)
        self.assertIn('profile', response.data)
        self.assertEqual(response.data['profile']['goal'], 'fat_loss')
        self.assertNotIn('password', response.data)

    def test_unauthenticated_access_rejected(self):
        """Test GET /api/v1/auth/me/ without credentials returns 401 Unauthorized."""
        self.client.credentials()  # clear credentials
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_and_token_blacklist(self):
        """Test logout blacklists refresh token and prevents future refresh."""
        refresh = RefreshToken.for_user(self.user)
        refresh_str = str(refresh)

        # Logout with refresh token
        logout_response = self.client.post(self.logout_url, {'refresh': refresh_str}, format='json')
        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)

        # Attempt to refresh with the blacklisted token
        refresh_response = self.client.post(self.refresh_url, {'refresh': refresh_str}, format='json')
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_update_via_me(self):
        """Test PATCH /api/v1/auth/me/ updates user email and profile fields."""
        refresh = RefreshToken.for_user(self.user)
        access_token = str(refresh.access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')

        payload = {
            'email': 'updated_email@example.com',
            'profile': {
                'weight': 82.5,
                'target_weight': 75.0,
                'goal': 'fat_loss',
            }
        }
        response = self.client.patch(self.me_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'updated_email@example.com')
        self.assertEqual(response.data['profile']['weight'], 82.5)
        self.assertEqual(response.data['profile']['target_weight'], 75.0)

    def test_cors_headers_allowed_origin(self):
        """Test CORS headers are returned for allowed development origin."""
        response = self.client.options(
            self.login_url,
            HTTP_ORIGIN='http://localhost:5173',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
        )
        self.assertIn('Access-Control-Allow-Origin', response.headers)
        self.assertEqual(response.headers['Access-Control-Allow-Origin'], 'http://localhost:5173')
