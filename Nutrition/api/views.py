from datetime import datetime
from django.utils.timezone import localdate
from django.db.models import Sum, Q
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from Nutrition.models import Food, Category, MealLog, WaterIntake
from Control_Panel.api.permissions import IsSuperUserOrReadOnly
from .serializers import (
    CategorySerializer,
    CategoryCreateUpdateSerializer,
    FoodSerializer,
    FoodCreateUpdateSerializer,
    MealLogSerializer,
    MealLogCreateUpdateSerializer,
    WaterIntakeSerializer,
    CheatMealLogSerializer,
)
from .pagination import StandardResultsSetPagination


# ==============================================================================
# Food Catalogue Views (Public Read / Superuser Write)
# ==============================================================================

class CategoryListView(generics.ListCreateAPIView):
    """
    GET /api/v1/nutrition/categories/
    Returns all food categories with food counts (Public).

    POST /api/v1/nutrition/categories/
    Creates a new food category (Superuser only).
    """
    permission_classes = [IsSuperUserOrReadOnly]
    queryset = Category.objects.all().order_by('name')
    pagination_class = None

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CategoryCreateUpdateSerializer
        return CategorySerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = serializer.save()
        return Response(CategorySerializer(category).data, status=status.HTTP_201_CREATED)


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/v1/nutrition/categories/{id}/
    Publicly accessible category details.

    PATCH / PUT / DELETE /api/v1/nutrition/categories/{id}/
    Superuser-guarded modification and deletion.
    """
    permission_classes = [IsSuperUserOrReadOnly]
    queryset = Category.objects.all()
    lookup_field = 'id'

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return CategoryCreateUpdateSerializer
        return CategorySerializer

    def perform_destroy(self, instance):
        instance.delete()



class FoodListView(generics.ListCreateAPIView):
    """
    GET /api/v1/nutrition/foods/
    Returns paginated list of foods in catalogue (Public).
    Supports:
    - ?search=apple or ?q=apple
    - ?category=1 or ?category=1,2 or multiple ?category=1&category=2

    POST /api/v1/nutrition/foods/
    Creates a new food item with image upload and M2M categories (Superuser only).
    """
    permission_classes = [IsSuperUserOrReadOnly]
    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return FoodCreateUpdateSerializer
        return FoodSerializer

    def get_queryset(self):
        queryset = Food.objects.all().prefetch_related('categories').order_by('name')

        # Name search
        search_query = self.request.query_params.get('search') or self.request.query_params.get('q')
        if search_query:
            queryset = queryset.filter(name__icontains=search_query.strip())

        # Category filter (supports ?category=1,2 or ?category=1&category=2)
        categories = self.request.query_params.getlist('category')
        if categories:
            cat_ids = []
            for item in categories:
                for part in str(item).split(','):
                    if part.strip().isdigit():
                        cat_ids.append(int(part.strip()))
            if cat_ids:
                queryset = queryset.filter(categories__id__in=cat_ids).distinct()

        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        food = serializer.instance
        return Response(FoodSerializer(food).data, status=status.HTTP_201_CREATED)


class FoodDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/v1/nutrition/foods/{id}/
    Returns detailed nutritional information and image for a single food item (Public).

    PATCH / PUT / DELETE /api/v1/nutrition/foods/{id}/
    Superuser-guarded modification and deletion.
    """
    permission_classes = [IsSuperUserOrReadOnly]
    queryset = Food.objects.all().prefetch_related('categories')
    lookup_field = 'id'

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return FoodCreateUpdateSerializer
        return FoodSerializer

    def perform_destroy(self, instance):
        if instance.image:
            image_name = instance.image.name
            if not Food.objects.filter(image=image_name).exclude(pk=instance.pk).exists():
                try:
                    instance.image.delete(save=False)
                except Exception:
                    pass
        instance.delete()


# ==============================================================================
# Meal Log Views (Authenticated & User-Scoped)
# ==============================================================================

class MealLogListCreateView(APIView):
    """
    GET /api/v1/nutrition/meals/
    Returns user's logged meals.
    Supports ?date=YYYY-MM-DD and ?is_cheat=true/false.

    POST /api/v1/nutrition/meals/
    Logs a new meal for the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        queryset = MealLog.objects.filter(user=request.user).select_related('food').order_by('-date', '-id')

        # Date filter
        date_param = request.query_params.get('date')
        if date_param:
            try:
                filter_date = datetime.strptime(date_param.strip(), '%Y-%m-%d').date()
                queryset = queryset.filter(date=filter_date)
            except ValueError:
                return Response(
                    {"date": "Invalid date format. Expected YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Cheat meal filter
        is_cheat = request.query_params.get('is_cheat')
        if is_cheat is not None:
            if is_cheat.lower() in ('true', '1'):
                queryset = queryset.filter(is_cheat=True)
            elif is_cheat.lower() in ('false', '0'):
                queryset = queryset.filter(is_cheat=False)

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request)
        if page is not None:
            serializer = MealLogSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = MealLogSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        serializer = MealLogCreateUpdateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            meal = serializer.save()
            return Response(
                MealLogSerializer(meal).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MealLogDetailView(APIView):
    """
    GET /api/v1/nutrition/meals/{id}/
    Retrieves a single meal log entry for authenticated user.

    PATCH /api/v1/nutrition/meals/{id}/
    Updates an existing meal log entry.

    DELETE /api/v1/nutrition/meals/{id}/
    Deletes an existing meal log entry.
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return MealLog.objects.select_related('food').get(pk=pk, user=self.request.user)
        except MealLog.DoesNotExist:
            return None

    def get(self, request, id, *args, **kwargs):
        meal = self.get_object(id)
        if not meal:
            return Response({"detail": "Meal log not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = MealLogSerializer(meal)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, id, *args, **kwargs):
        meal = self.get_object(id)
        if not meal:
            return Response({"detail": "Meal log not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = MealLogCreateUpdateSerializer(
            meal,
            data=request.data,
            partial=True,
            context={'request': request},
        )
        if serializer.is_valid():
            updated_meal = serializer.save()
            return Response(
                MealLogSerializer(updated_meal).data,
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, id, *args, **kwargs):
        meal = self.get_object(id)
        if not meal:
            return Response({"detail": "Meal log not found."}, status=status.HTTP_404_NOT_FOUND)

        meal.delete()
        return Response(
            {"message": "Meal log deleted successfully."},
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# Daily Nutrition Summary View
# ==============================================================================

class DailyNutritionSummaryView(APIView):
    """
    GET /api/v1/nutrition/summary/
    Returns complete daily nutritional breakdown and progress against targets.
    Query parameter: ?date=YYYY-MM-DD (defaults to today).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        profile = getattr(user, 'profile', None)

        date_str = request.query_params.get('date')
        if date_str:
            try:
                target_date = datetime.strptime(date_str.strip(), '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {"date": "Invalid date format. Expected YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            target_date = localdate()

        meals = MealLog.objects.filter(user=user, date=target_date).select_related('food').order_by('id')

        # Aggregations
        totals = meals.aggregate(
            total_calories=Sum('calories'),
            total_protein=Sum('protein'),
        )
        total_calories = round(totals['total_calories'] or 0.0, 1)
        total_protein = round(totals['total_protein'] or 0.0, 1)

        # Cheat meals
        cheat_meals = meals.filter(is_cheat=True)
        cheat_totals = cheat_meals.aggregate(
            cheat_cals=Sum('calories'),
        )
        cheat_calories = round(cheat_totals['cheat_cals'] or 0.0, 1)
        cheat_meals_count = cheat_meals.count()

        # Regular meals
        regular_meals = meals.filter(is_cheat=False)
        regular_calories = round(regular_meals.aggregate(Sum('calories'))['calories__sum'] or 0.0, 1)

        # User profile targets
        calorie_target = float(profile.daily_calorie_target if profile else 2000.0)
        protein_target = float(profile.daily_protein_target if profile else 80.0)
        max_cheat_cals = float(profile.max_cheat_calories_per_day if profile else 300.0)
        max_cheat_meals = int(profile.max_cheat_meals_per_day if profile else 2)
        user_points = int(profile.points if profile else 0)

        # Water intake for the day
        water_today = WaterIntake.objects.filter(user=user, date=target_date)
        total_water_ml = float(water_today.aggregate(Sum('amount'))['amount__sum'] or 0.0)
        water_goal_ml = float(profile.daily_water_goal if profile else 3000.0)

        # Calculations
        remaining_calories = max(0.0, round(calorie_target - total_calories, 1))
        remaining_protein = max(0.0, round(protein_target - total_protein, 1))
        remaining_water_ml = max(0.0, round(water_goal_ml - total_water_ml, 1))

        calorie_percent = round((total_calories / calorie_target) * 100, 1) if calorie_target > 0 else 0.0
        protein_percent = round((total_protein / protein_target) * 100, 1) if protein_target > 0 else 0.0
        water_percent = round((total_water_ml / water_goal_ml) * 100, 1) if water_goal_ml > 0 else 0.0

        return Response(
            {
                "date": str(target_date),
                "calories": {
                    "consumed": total_calories,
                    "target": calorie_target,
                    "remaining": remaining_calories,
                    "percentage": calorie_percent,
                    "regular_calories": regular_calories,
                    "cheat_calories": cheat_calories,
                },
                "macronutrients": {
                    "protein": {
                        "consumed": total_protein,
                        "target": protein_target,
                        "remaining": remaining_protein,
                        "percentage": protein_percent,
                        "unit": "g",
                    },
                    "carbohydrates": {
                        "consumed": None,
                        "target": None,
                        "unit": "g",
                        "note": "Carbohydrate tracking not configured in database schema.",
                    },
                    "fat": {
                        "consumed": None,
                        "target": None,
                        "unit": "g",
                        "note": "Fat tracking not configured in database schema.",
                    },
                },
                "cheat_summary": {
                    "cheat_calories": cheat_calories,
                    "max_cheat_calories": max_cheat_cals,
                    "remaining_cheat_calories": max(0.0, round(max_cheat_cals - cheat_calories, 1)),
                    "cheat_meals_count": cheat_meals_count,
                    "max_cheat_meals": max_cheat_meals,
                    "remaining_cheat_meals": max(0, max_cheat_meals - cheat_meals_count),
                    "user_points": user_points,
                },
                "water_summary": {
                    "total_consumed_ml": total_water_ml,
                    "goal_ml": water_goal_ml,
                    "remaining_ml": remaining_water_ml,
                    "percentage": water_percent,
                },
                "meal_count": meals.count(),
                "meals": MealLogSerializer(meals, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# Water Intake Views (Authenticated & User-Scoped)
# ==============================================================================

class WaterIntakeListCreateView(APIView):
    """
    GET /api/v1/nutrition/water/
    Returns user's water intake logs with summary for requested date (default: today).
    Supports ?date=YYYY-MM-DD.

    POST /api/v1/nutrition/water/
    Logs water intake amount in ml.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        date_str = request.query_params.get('date')

        if date_str:
            try:
                target_date = datetime.strptime(date_str.strip(), '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {"date": "Invalid date format. Expected YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            target_date = localdate()

        records = WaterIntake.objects.filter(user=user, date=target_date).order_by('id')
        total_ml = records.aggregate(Sum('amount'))['amount__sum'] or 0.0

        profile = getattr(user, 'profile', None)
        goal_ml = float(profile.daily_water_goal if profile else 3000.0)
        percentage = round((total_ml / goal_ml) * 100, 1) if goal_ml > 0 else 0.0

        return Response(
            {
                "date": str(target_date),
                "total_consumed_ml": float(total_ml),
                "daily_goal_ml": goal_ml,
                "remaining_ml": max(0.0, round(goal_ml - total_ml, 1)),
                "percentage": percentage,
                "records": WaterIntakeSerializer(records, many=True).data,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request, *args, **kwargs):
        serializer = WaterIntakeSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            record = serializer.save()
            # Calculate updated total for that date
            total_ml = WaterIntake.objects.filter(
                user=request.user,
                date=record.date,
            ).aggregate(Sum('amount'))['amount__sum'] or 0.0

            return Response(
                {
                    "message": f"+{record.amount:.0f} ml logged successfully.",
                    "record": WaterIntakeSerializer(record).data,
                    "date": str(record.date),
                    "daily_total_ml": float(total_ml),
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WaterIntakeDetailView(APIView):
    """
    PATCH /api/v1/nutrition/water/{id}/
    Updates a water intake entry.

    DELETE /api/v1/nutrition/water/{id}/
    Deletes a water intake entry.
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return WaterIntake.objects.get(pk=pk, user=self.request.user)
        except WaterIntake.DoesNotExist:
            return None

    def patch(self, request, id, *args, **kwargs):
        entry = self.get_object(id)
        if not entry:
            return Response({"detail": "Water intake record not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = WaterIntakeSerializer(entry, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            updated_entry = serializer.save()
            return Response(WaterIntakeSerializer(updated_entry).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, id, *args, **kwargs):
        entry = self.get_object(id)
        if not entry:
            return Response({"detail": "Water intake record not found."}, status=status.HTTP_404_NOT_FOUND)

        entry.delete()
        return Response(
            {"message": "Water intake record deleted successfully."},
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# Cheat Meal Specific Views
# ==============================================================================

class CheatMealCreateView(APIView):
    """
    POST /api/v1/nutrition/cheat/
    Logs a cheat meal using the existing gamification points system.
    Validates points balance and daily limits, deducts points, and logs meal.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = CheatMealLogSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            meal, required_points = serializer.save()
            profile = request.user.profile
            return Response(
                {
                    "message": f"Cheat meal logged successfully (-{required_points} points).",
                    "points_deducted": required_points,
                    "remaining_points": profile.points,
                    "meal": MealLogSerializer(meal).data,
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CheatMealStatusView(APIView):
    """
    GET /api/v1/nutrition/cheat/status/
    Returns current points balance and daily cheat allowances.
    Supports ?date=YYYY-MM-DD (defaults to today).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        profile = user.profile

        date_str = request.query_params.get('date')
        if date_str:
            try:
                target_date = datetime.strptime(date_str.strip(), '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {"date": "Invalid date format. Expected YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            target_date = localdate()

        today_cheat_meals = MealLog.objects.filter(user=user, date=target_date, is_cheat=True)
        today_cheat_calories = round(today_cheat_meals.aggregate(Sum('calories'))['calories__sum'] or 0.0, 1)
        today_cheat_count = today_cheat_meals.count()

        max_cheat_cals = profile.max_cheat_calories_per_day
        max_cheat_meals = profile.max_cheat_meals_per_day

        remaining_cheat_cals = max(0.0, round(max_cheat_cals - today_cheat_calories, 1))
        remaining_cheat_meals = max(0, max_cheat_meals - today_cheat_count)

        can_cheat = (profile.points >= 25) and (remaining_cheat_cals > 0) and (remaining_cheat_meals > 0)

        return Response(
            {
                "date": str(target_date),
                "points": profile.points,
                "today_cheat_calories": today_cheat_calories,
                "max_cheat_calories": max_cheat_cals,
                "remaining_cheat_calories": remaining_cheat_cals,
                "today_cheat_meals": today_cheat_count,
                "max_cheat_meals": max_cheat_meals,
                "remaining_cheat_meals": remaining_cheat_meals,
                "can_log_cheat": can_cheat,
            },
            status=status.HTTP_200_OK,
        )
