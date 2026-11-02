from datetime import datetime
from django.utils.timezone import localdate
from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response

from Users.models import Profile
from Nutrition.models import Category, Food, MealLog
from Workouts.models import MuscleGroup, SubMuscle, Exercise
from Recipes.models import Recipe, RecipeCategory

from .permissions import IsSuperUser
from .pagination import StandardResultsSetPagination
from .serializers import (
    AdminDashboardSerializer,
    AdminUserSerializer,
    AdminUserCreateSerializer,
    AdminUserUpdateSerializer,
    AdminProfileSerializer,
    AdminMealLogSerializer,
)


class AdminDashboardView(APIView):
    """
    GET /api/v1/admin/dashboard/
    Returns real-time database counts across all administrative entities.
    Strictly restricted to superusers.
    """
    permission_classes = [IsSuperUser]

    def get(self, request, *args, **kwargs):
        data = {
            "users": User.objects.count(),
            "profiles": Profile.objects.count(),
            "foods": Food.objects.count(),
            "food_categories": Category.objects.count(),
            "recipes": Recipe.objects.count(),
            "recipe_categories": RecipeCategory.objects.count(),
            "exercises": Exercise.objects.count(),
            "muscle_groups": MuscleGroup.objects.count(),
            "submuscles": SubMuscle.objects.count(),
            "meals_logged_today": MealLog.objects.filter(date=localdate()).count(),
        }
        serializer = AdminDashboardSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminUserListCreateView(generics.ListCreateAPIView):
    """
    GET /api/v1/admin/users/
    Lists all users with search query (?search= or ?q=) and pagination.

    POST /api/v1/admin/users/
    Creates a new user using User.objects.create_user().
    """
    permission_classes = [IsSuperUser]
    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return AdminUserCreateSerializer
        return AdminUserSerializer

    def get_queryset(self):
        queryset = User.objects.select_related('profile').all().order_by('-id')
        search = self.request.query_params.get('search') or self.request.query_params.get('q')
        if search:
            s = search.strip()
            queryset = queryset.filter(Q(username__icontains=s) | Q(email__icontains=s))
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(AdminUserSerializer(user).data, status=status.HTTP_201_CREATED)


class AdminUserDetailView(APIView):
    """
    GET /api/v1/admin/users/{id}/
    PATCH /api/v1/admin/users/{id}/
    DELETE /api/v1/admin/users/{id}/
    Superuser-guarded with self-deletion protection and superuser account protection.
    """
    permission_classes = [IsSuperUser]

    def get_object(self, pk):
        try:
            return User.objects.select_related('profile').get(pk=pk)
        except User.DoesNotExist:
            return None

    def get(self, request, id, *args, **kwargs):
        user = self.get_object(id)
        if not user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(AdminUserSerializer(user).data, status=status.HTTP_200_OK)

    def patch(self, request, id, *args, **kwargs):
        user = self.get_object(id)
        if not user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminUserUpdateSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()
            return Response(AdminUserSerializer(updated).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, id, *args, **kwargs):
        user = self.get_object(id)
        if not user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # 1. Prevent self-deletion
        if user.id == request.user.id:
            return Response(
                {"detail": "You cannot delete your own administrative account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Protect last superuser
        if user.is_superuser:
            superuser_count = User.objects.filter(is_superuser=True).count()
            if superuser_count <= 1:
                return Response(
                    {"detail": "Cannot delete the sole remaining superuser account."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        username = user.username
        user.delete()
        return Response(
            {"message": f"User '{username}' deleted successfully."},
            status=status.HTTP_200_OK,
        )


class AdminProfileListView(generics.ListAPIView):
    """
    GET /api/v1/admin/profiles/
    Lists all profiles with user information and targets.
    """
    permission_classes = [IsSuperUser]
    serializer_class = AdminProfileSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        queryset = Profile.objects.select_related('user').all().order_by('-id')
        search = self.request.query_params.get('search') or self.request.query_params.get('q')
        if search:
            s = search.strip()
            queryset = queryset.filter(Q(user__username__icontains=s) | Q(user__email__icontains=s))
        return queryset


class AdminProfileDetailView(APIView):
    """
    GET /api/v1/admin/profiles/{id}/
    PATCH /api/v1/admin/profiles/{id}/
    Supports full profile editing.
    """
    permission_classes = [IsSuperUser]

    def get_object(self, pk):
        try:
            return Profile.objects.select_related('user').get(pk=pk)
        except Profile.DoesNotExist:
            return None

    def get(self, request, id, *args, **kwargs):
        profile = self.get_object(id)
        if not profile:
            return Response({"detail": "Profile not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(AdminProfileSerializer(profile).data, status=status.HTTP_200_OK)

    def patch(self, request, id, *args, **kwargs):
        profile = self.get_object(id)
        if not profile:
            return Response({"detail": "Profile not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()
            return Response(AdminProfileSerializer(updated).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminMealLogListView(generics.ListAPIView):
    """
    GET /api/v1/admin/meals/
    Administrative inspection of all user meal logs across the system.
    Supports filtering by ?date=YYYY-MM-DD and ?user_id={id}.
    """
    permission_classes = [IsSuperUser]
    serializer_class = AdminMealLogSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        queryset = MealLog.objects.select_related('user', 'food').all().order_by('-date', '-id')

        date_param = self.request.query_params.get('date')
        if date_param:
            try:
                filter_date = datetime.strptime(date_param.strip(), '%Y-%m-%d').date()
                queryset = queryset.filter(date=filter_date)
            except ValueError:
                pass

        user_id = self.request.query_params.get('user_id')
        if user_id and user_id.isdigit():
            queryset = queryset.filter(user_id=int(user_id))

        return queryset


class AdminMealLogDetailView(APIView):
    """
    DELETE /api/v1/admin/meals/{id}/
    Allows superuser to delete any meal log.
    """
    permission_classes = [IsSuperUser]

    def delete(self, request, id, *args, **kwargs):
        try:
            meal = MealLog.objects.get(pk=id)
        except MealLog.DoesNotExist:
            return Response({"detail": "Meal log not found."}, status=status.HTTP_404_NOT_FOUND)

        meal.delete()
        return Response({"message": "Meal log deleted successfully."}, status=status.HTTP_200_OK)
