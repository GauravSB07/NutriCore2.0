from django.urls import path
from .views import (
    RecipeListCreateView,
    RecipeDetailView,
    RecipeCategoryListCreateView,
    RecipeCategoryDetailView,
)

urlpatterns = [
    # Recipe Catalogue & Admin Management
    path('', RecipeListCreateView.as_view(), name='api_recipes_list'),
    path('<int:id>/', RecipeDetailView.as_view(), name='api_recipes_detail'),

    # Recipe Categories
    path('categories/', RecipeCategoryListCreateView.as_view(), name='api_recipes_categories'),
    path('categories/<int:id>/', RecipeCategoryDetailView.as_view(), name='api_recipes_category_detail'),
]
