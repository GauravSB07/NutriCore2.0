from rest_framework import serializers
from Recipes.models import Recipe, RecipeCategory


class RecipeCategorySerializer(serializers.ModelSerializer):
    """
    Serializer for RecipeCategory listing.
    """
    recipes_count = serializers.SerializerMethodField()

    class Meta:
        model = RecipeCategory
        fields = ['id', 'name', 'recipes_count']

    def get_recipes_count(self, obj):
        return getattr(obj, 'recipes_count', None) or obj.recipe_set.count()


class RecipeListSerializer(serializers.ModelSerializer):
    """
    Serializer for Recipe catalogue listing.
    """
    category = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Recipe
        fields = [
            'id',
            'name',
            'category',
            'calories',
            'protein',
            'price',
            'image_url',
        ]

    def get_category(self, obj):
        if obj.category:
            return {
                'id': obj.category.id,
                'name': obj.category.name,
            }
        return None

    def get_image_url(self, obj):
        if obj.image:
            try:
                return obj.image.url
            except Exception:
                return None
        return None


class RecipeDetailSerializer(serializers.ModelSerializer):
    """
    Detailed Recipe serializer exposing ingredients, preparation steps, tips, and media URLs.
    """
    category = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    ingredients_list = serializers.SerializerMethodField()
    steps_list = serializers.SerializerMethodField()
    tips_list = serializers.SerializerMethodField()

    class Meta:
        model = Recipe
        fields = [
            'id',
            'name',
            'category',
            'calories',
            'protein',
            'price',
            'image_url',
            'ingredients',
            'ingredients_list',
            'method',
            'steps_list',
            'tips',
            'tips_list',
        ]

    def get_category(self, obj):
        if obj.category:
            return {
                'id': obj.category.id,
                'name': obj.category.name,
            }
        return None

    def get_image_url(self, obj):
        if obj.image:
            try:
                return obj.image.url
            except Exception:
                return None
        return None

    def get_ingredients_list(self, obj):
        if obj.ingredients:
            return [i.strip() for i in obj.ingredients.split(';') if i.strip()]
        return []

    def get_steps_list(self, obj):
        if obj.method:
            return [s.strip() for s in obj.method.split('.') if s.strip()]
        return []

    def get_tips_list(self, obj):
        if obj.tips:
            return [t.strip() for t in obj.tips.split(';') if t.strip()]
        return []


class RecipeCategoryDetailSerializer(serializers.ModelSerializer):
    """
    Category detail with nested list of recipes.
    """
    recipes = RecipeListSerializer(source='recipe_set', many=True, read_only=True)
    recipes_count = serializers.SerializerMethodField()

    class Meta:
        model = RecipeCategory
        fields = ['id', 'name', 'recipes_count', 'recipes']

    def get_recipes_count(self, obj):
        return obj.recipe_set.count()


class RecipeCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for administrative creation and editing of Recipes.
    """
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=RecipeCategory.objects.all(),
        source='category',
        required=False,
        allow_null=True,
    )
    calories = serializers.FloatField(
        required=False,
        allow_null=True,
        min_value=0.0,
        error_messages={'min_value': 'Calories cannot be negative.'},
    )
    protein = serializers.FloatField(
        required=False,
        allow_null=True,
        min_value=0.0,
        error_messages={'min_value': 'Protein cannot be negative.'},
    )
    price = serializers.FloatField(
        required=False,
        allow_null=True,
        min_value=0.0,
        error_messages={'min_value': 'Price cannot be negative.'},
    )
    image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Recipe
        fields = [
            'id',
            'name',
            'category_id',
            'calories',
            'protein',
            'price',
            'ingredients',
            'method',
            'tips',
            'image',
        ]
        read_only_fields = ['id']


class RecipeCategoryCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating and updating RecipeCategory.
    """
    name = serializers.CharField(max_length=100, min_length=1)

    class Meta:
        model = RecipeCategory
        fields = ['id', 'name']
        read_only_fields = ['id']
