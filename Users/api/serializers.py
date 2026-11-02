from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from Users.models import Profile


class ProfileSerializer(serializers.ModelSerializer):
    profile_image = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
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
            'profile_image',
            'is_onboarded',
        ]

    def get_profile_image(self, obj):
        if obj.profile_image:
            try:
                return obj.profile_image.url
            except Exception:
                return None
        return None


class ProfileUpdateSerializer(serializers.ModelSerializer):
    profile_image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Profile
        fields = [
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
            'profile_image',
            'is_onboarded',
        ]


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'is_staff',
            'is_superuser',
            'profile',
        ]
        read_only_fields = ['id', 'is_staff', 'is_superuser']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=False,
        style={'input_type': 'password'},
    )
    password2 = serializers.CharField(
        write_only=True,
        required=False,
        style={'input_type': 'password'},
    )
    email = serializers.EmailField(required=False, allow_blank=True)

    # Optional initial profile fields
    goal = serializers.ChoiceField(choices=Profile.GOAL_CHOICES, required=False, default='fat_loss')
    height = serializers.FloatField(required=False, allow_null=True)
    weight = serializers.FloatField(required=False, allow_null=True)
    target_weight = serializers.FloatField(required=False, allow_null=True)
    daily_calorie_target = serializers.FloatField(required=False)
    daily_protein_target = serializers.FloatField(required=False)
    daily_water_goal = serializers.FloatField(required=False)

    class Meta:
        model = User
        fields = [
            'username',
            'email',
            'password',
            'password_confirm',
            'password2',
            'goal',
            'height',
            'weight',
            'target_weight',
            'daily_calorie_target',
            'daily_protein_target',
            'daily_water_goal',
        ]

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return value

    def validate(self, attrs):
        password = attrs.get('password')
        pw_confirm = attrs.get('password_confirm') or attrs.get('password2')

        if not pw_confirm:
            raise serializers.ValidationError({"password_confirm": ["Password confirmation is required."]})

        if password != pw_confirm:
            raise serializers.ValidationError({"password_confirm": ["Password fields didn't match."]})

        # Validate password using Django's configured AUTH_PASSWORD_VALIDATORS
        user_temp = User(username=attrs.get('username', ''), email=attrs.get('email', ''))
        validate_password(password, user=user_temp)

        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm', None)
        validated_data.pop('password2', None)
        goal = validated_data.pop('goal', None)
        height = validated_data.pop('height', None)
        weight = validated_data.pop('weight', None)
        target_weight = validated_data.pop('target_weight', None)
        daily_calorie_target = validated_data.pop('daily_calorie_target', None)
        daily_protein_target = validated_data.pop('daily_protein_target', None)
        daily_water_goal = validated_data.pop('daily_water_goal', None)

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
        )

        # Profile is created via post_save signal in Users.signals
        profile = getattr(user, 'profile', None)
        if profile is not None:
            updated = False
            if goal is not None:
                profile.goal = goal
                updated = True
            if height is not None:
                profile.height = height
                updated = True
            if weight is not None:
                profile.weight = weight
                if profile.start_weight is None:
                    profile.start_weight = weight
                updated = True
            if target_weight is not None:
                profile.target_weight = target_weight
                updated = True
            if daily_calorie_target is not None:
                profile.daily_calorie_target = daily_calorie_target
                updated = True
            if daily_protein_target is not None:
                profile.daily_protein_target = daily_protein_target
                updated = True
            if daily_water_goal is not None:
                profile.daily_water_goal = daily_water_goal
                updated = True
            if updated:
                profile.save()

        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'},
    )

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')

        if not username or not password:
            raise serializers.ValidationError({"detail": "Must include both username and password."})

        request = self.context.get('request')
        user = authenticate(request=request, username=username, password=password)

        if not user:
            raise AuthenticationFailed("Invalid username or password.")

        if not user.is_active:
            raise AuthenticationFailed("User account is disabled.")

        attrs['user'] = user
        return attrs


class UserUpdateSerializer(serializers.ModelSerializer):
    profile = ProfileUpdateSerializer(required=False)
    profile_image = serializers.ImageField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'profile',
            'profile_image',
        ]
        read_only_fields = ['id', 'username']

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', None)
        top_level_image = validated_data.pop('profile_image', None)

        instance.email = validated_data.get('email', instance.email)
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.save()

        if hasattr(instance, 'profile'):
            profile = instance.profile
            if profile_data:
                for key, val in profile_data.items():
                    setattr(profile, key, val)
            if top_level_image is not None:
                profile.profile_image = top_level_image
            profile.save()

        return instance


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=True)

    def validate(self, attrs):
        refresh = attrs.get('refresh')
        try:
            token = RefreshToken(refresh)
            token.blacklist()
        except TokenError:
            raise serializers.ValidationError({"refresh": ["Invalid or expired refresh token."]})
        return attrs
