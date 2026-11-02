from django.urls import path, include

# Top-level versioned API routing for NutriCore (/api/v1/)
urlpatterns = [
    path('auth/', include('Users.api.urls')),
    path('nutrition/', include('Nutrition.api.urls')),
    path('workouts/', include('Workouts.api.urls')),
    path('progress/', include('Progress.api.urls')),
    path('recipes/', include('Recipes.api.urls')),
    path('admin/', include('Control_Panel.api.urls')),
]
