from rest_framework import serializers
from django.contrib.auth.models import User
from Users.models import Profile
from Nutrition.models import MealLog, Food


class AdminDashboardSerializer(serializers.Serializer):
    """
    Serializer for system-wide dashboard statistics.
    """
    users = serializers.IntegerField()
    profiles = serializers.IntegerField()
    foods = serializers.IntegerField()
    food_categories = serializers.IntegerField()
    recipes = serializers.IntegerField()
    recipe_categories = serializers.IntegerField()
    exercises = serializers.IntegerField()
    muscle_groups = serializers.IntegerField()
    submuscles = serializers.IntegerField()
    meals_logged_today = serializers.IntegerField()


class AdminProfileSimpleSerializer(serializers.ModelSerializer):
    profile_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            'id',
            'height',
            'weight',
            'start_weight',
            'target_weight',
            'daily_steps_target',
            'daily_calorie_target',
            'daily_protein_target',
            'max_cheat_calories_per_day',
            'max_cheat_meals_per_day',
            'goal',
            'points',
            'daily_water_goal',
            'is_onboarded',
            'profile_image_url',
        ]

    def get_profile_image_url(self, obj):
        if obj.profile_image:
            try:
                return obj.profile_image.url
            except Exception:
                return None
        return None


class AdminUserSerializer(serializers.ModelSerializer):
    """
    Full administrative user representation. Never exposes password hashes.
    """
    profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'is_staff',
            'is_superuser',
            'is_active',
            'date_joined',
            'last_login',
            'profile',
        ]
        read_only_fields = ['id', 'date_joined', 'last_login', 'profile']

    def get_profile(self, obj):
        if hasattr(obj, 'profile'):
            return AdminProfileSimpleSerializer(obj.profile).data
        return None


class AdminUserCreateSerializer(serializers.ModelSerializer):
    """
    Administrative user creation serializer. Uses create_user for PBKDF2 hashing.
    """
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    is_staff = serializers.BooleanField(default=False)
    is_superuser = serializers.BooleanField(default=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'is_staff', 'is_superuser']
        read_only_fields = ['id']

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=password,
        )
        user.is_staff = validated_data.get('is_staff', False)
        user.is_superuser = validated_data.get('is_superuser', False)
        user.save()

        # Ensure Profile exists
        Profile.objects.get_or_create(user=user)
        return user


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    """
    Administrative user edit serializer.
    """
    class Meta:
        model = User
        fields = ['username', 'email', 'is_staff', 'is_superuser', 'is_active']

    def validate_username(self, value):
        user = self.instance
        if User.objects.exclude(pk=user.pk).filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return value


class AdminProfileSerializer(serializers.ModelSerializer):
    """
    Administrative profile serializer supporting all Profile model fields.
    """
    user = serializers.SerializerMethodField()
    profile_image_url = serializers.SerializerMethodField()
    profile_image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Profile
        fields = [
            'id',
            'user',
            'height',
            'weight',
            'start_weight',
            'target_weight',
            'daily_steps_target',
            'daily_calorie_target',
            'daily_protein_target',
            'max_cheat_calories_per_day',
            'max_cheat_meals_per_day',
            'goal',
            'points',
            'daily_water_goal',
            'is_onboarded',
            'profile_image',
            'profile_image_url',
        ]
        read_only_fields = ['id', 'user', 'profile_image_url']

    def get_user(self, obj):
        return {
            'id': obj.user.id,
            'username': obj.user.username,
            'email': obj.user.email,
        }

    def get_profile_image_url(self, obj):
        if obj.profile_image:
            try:
                return obj.profile_image.url
            except Exception:
                return None
        return None

    def update(self, instance, validated_data):
        new_image = validated_data.get('profile_image')
        if new_image and instance.profile_image and instance.profile_image.name != new_image.name:
            if not Profile.objects.filter(profile_image=instance.profile_image.name).exclude(pk=instance.pk).exists():
                try:
                    instance.profile_image.delete(save=False)
                except Exception:
                    pass
        return super().update(instance, validated_data)



class AdminMealLogSerializer(serializers.ModelSerializer):
    """
    Administrative meal log serializer.
    """
    user = serializers.SerializerMethodField()
    food = serializers.SerializerMethodField()

    class Meta:
        model = MealLog
        fields = [
            'id',
            'user',
            'food',
            'quantity',
            'unit',
            'date',
            'is_cheat',
            'calories',
            'protein',
        ]
        read_only_fields = ['id', 'user', 'food', 'calories', 'protein']

    def get_user(self, obj):
        return {
            'id': obj.user.id,
            'username': obj.user.username,
            'email': obj.user.email,
        }

    def get_food(self, obj):
        return {
            'id': obj.food.id,
            'name': obj.food.name,
        }
