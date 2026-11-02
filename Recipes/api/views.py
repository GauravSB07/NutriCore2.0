from django.db.models import Count
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response

from Recipes.models import Recipe, RecipeCategory
from .permissions import IsAdminOrReadOnly
from .pagination import StandardResultsSetPagination
from .serializers import (
    RecipeCategorySerializer,
    RecipeCategoryDetailSerializer,
    RecipeCategoryCreateUpdateSerializer,
    RecipeListSerializer,
    RecipeDetailSerializer,
    RecipeCreateUpdateSerializer,
)


class RecipeListCreateView(generics.ListCreateAPIView):
    """
    GET /api/v1/recipes/
    Publicly accessible paginated recipe catalogue.
    Supported query parameters:
    - ?search=chicken or ?q=chicken (case-insensitive name search)
    - ?category={id} (filter by category ID)
    - ?filter=high_protein (protein >= 25g)
    - ?filter=low_cal (calories <= 300 kcal)
    - ?filter=veg (category name contains 'veg')
    - ?ordering=calories, -calories, protein, -protein, price, -price, name

    POST /api/v1/recipes/
    Administrative recipe creation (requires staff or superuser permissions).
    """
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return RecipeCreateUpdateSerializer
        return RecipeListSerializer

    def get_queryset(self):
        queryset = Recipe.objects.select_related('category').all()

        # Search
        search = self.request.query_params.get('search') or self.request.query_params.get('q')
        if search:
            queryset = queryset.filter(name__icontains=search.strip())

        # Category filter
        category_id = self.request.query_params.get('category')
        if category_id and category_id.isdigit():
            queryset = queryset.filter(category_id=int(category_id))

        # Filter types matching existing Recipes/views.py logic
        filter_type = self.request.query_params.get('filter')
        if filter_type == 'high_protein':
            queryset = queryset.filter(protein__gte=25)
        elif filter_type == 'low_cal':
            queryset = queryset.filter(calories__lte=300)
        elif filter_type == 'veg':
            queryset = queryset.filter(category__name__icontains='veg')

        # Ordering
        ordering = self.request.query_params.get('ordering')
        if ordering in ['calories', '-calories', 'protein', '-protein', 'price', '-price', 'name', '-name', 'id', '-id']:
            queryset = queryset.order_by(ordering)
        else:
            queryset = queryset.order_by('-id')

        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        recipe = serializer.save()
        return Response(RecipeDetailSerializer(recipe).data, status=status.HTTP_201_CREATED)


class RecipeDetailView(APIView):
    """
    GET /api/v1/recipes/{id}/
    Publicly accessible complete recipe details with parsed ingredients, steps, and tips.

    PATCH /api/v1/recipes/{id}/
    PUT /api/v1/recipes/{id}/
    Administrative update (requires staff/superuser).

    DELETE /api/v1/recipes/{id}/
    Administrative deletion (requires staff/superuser).
    """
    permission_classes = [IsAdminOrReadOnly]

    def get_object(self, pk):
        try:
            return Recipe.objects.select_related('category').get(pk=pk)
        except Recipe.DoesNotExist:
            return None

    def get(self, request, id, *args, **kwargs):
        recipe = self.get_object(id)
        if not recipe:
            return Response({"detail": "Recipe not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(RecipeDetailSerializer(recipe).data, status=status.HTTP_200_OK)

    def patch(self, request, id, *args, **kwargs):
        recipe = self.get_object(id)
        if not recipe:
            return Response({"detail": "Recipe not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = RecipeCreateUpdateSerializer(recipe, data=request.data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()
            return Response(RecipeDetailSerializer(updated).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request, id, *args, **kwargs):
        return self.patch(request, id, *args, **kwargs)

    def delete(self, request, id, *args, **kwargs):
        recipe = self.get_object(id)
        if not recipe:
            return Response({"detail": "Recipe not found."}, status=status.HTTP_404_NOT_FOUND)

        recipe.delete()
        return Response({"message": "Recipe deleted successfully."}, status=status.HTTP_200_OK)


class RecipeCategoryListCreateView(generics.ListCreateAPIView):
    """
    GET /api/v1/recipes/categories/
    Public list of all recipe categories with recipe counts.

    POST /api/v1/recipes/categories/
    Administrative category creation (requires staff/superuser).
    """
    permission_classes = [IsAdminOrReadOnly]
    queryset = RecipeCategory.objects.annotate(recipes_count=Count('recipe')).order_by('name')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return RecipeCategoryCreateUpdateSerializer
        return RecipeCategorySerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = serializer.save()
        return Response(RecipeCategorySerializer(category).data, status=status.HTTP_201_CREATED)


class RecipeCategoryDetailView(APIView):
    """
    GET /api/v1/recipes/categories/{id}/
    Public category detail with nested recipes.

    PATCH /api/v1/recipes/categories/{id}/
    Administrative update (requires staff/superuser).

    DELETE /api/v1/recipes/categories/{id}/
    Administrative deletion (requires staff/superuser).
    """
    permission_classes = [IsAdminOrReadOnly]

    def get_object(self, pk):
        try:
            return RecipeCategory.objects.prefetch_related('recipe_set').get(pk=pk)
        except RecipeCategory.DoesNotExist:
            return None

    def get(self, request, id, *args, **kwargs):
        category = self.get_object(id)
        if not category:
            return Response({"detail": "Recipe category not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(RecipeCategoryDetailSerializer(category).data, status=status.HTTP_200_OK)

    def patch(self, request, id, *args, **kwargs):
        category = self.get_object(id)
        if not category:
            return Response({"detail": "Recipe category not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = RecipeCategoryCreateUpdateSerializer(category, data=request.data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()
            return Response(RecipeCategorySerializer(updated).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request, id, *args, **kwargs):
        return self.patch(request, id, *args, **kwargs)

    def delete(self, request, id, *args, **kwargs):
        category = self.get_object(id)
        if not category:
            return Response({"detail": "Recipe category not found."}, status=status.HTTP_404_NOT_FOUND)

        category.delete()
        return Response({"message": "Recipe category deleted successfully."}, status=status.HTTP_200_OK)
