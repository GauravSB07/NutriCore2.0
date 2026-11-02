from rest_framework import serializers
from django.utils.timezone import localdate
from django.db.models import Sum

from Nutrition.models import Food, Category, MealLog, WaterIntake


class CategorySerializer(serializers.ModelSerializer):
    foods_count = serializers.IntegerField(source='foods.count', read_only=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'foods_count']


class FoodCategoryBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name']


class FoodSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    categories = FoodCategoryBriefSerializer(many=True, read_only=True)
    carbohydrates_per_100g = serializers.SerializerMethodField()
    fat_per_100g = serializers.SerializerMethodField()
    carbohydrates_per_unit = serializers.SerializerMethodField()
    fat_per_unit = serializers.SerializerMethodField()

    class Meta:
        model = Food
        fields = [
            'id',
            'name',
            'calories_per_100g',
            'protein_per_100g',
            'calories_per_unit',
            'protein_per_unit',
            'carbohydrates_per_100g',
            'fat_per_100g',
            'carbohydrates_per_unit',
            'fat_per_unit',
            'unit_type',
            'serving_name',
            'serving_quantity',
            'image_url',
            'categories',
        ]

    def get_image_url(self, obj):
        if obj.image:
            try:
                return obj.image.url
            except Exception:
                return None
        return None

    def get_carbohydrates_per_100g(self, obj):
        return None

    def get_fat_per_100g(self, obj):
        return None

    def get_carbohydrates_per_unit(self, obj):
        return None

    def get_fat_per_unit(self, obj):
        return None


class MealLogSerializer(serializers.ModelSerializer):
    food = FoodSerializer(read_only=True)
    food_id = serializers.PrimaryKeyRelatedField(
        queryset=Food.objects.all(),
        source='food',
        write_only=True,
    )
    carbohydrates = serializers.SerializerMethodField()
    fat = serializers.SerializerMethodField()

    class Meta:
        model = MealLog
        fields = [
            'id',
            'food',
            'food_id',
            'quantity',
            'unit',
            'date',
            'is_cheat',
            'calories',
            'protein',
            'carbohydrates',
            'fat',
        ]
        read_only_fields = ['id', 'calories', 'protein', 'carbohydrates', 'fat']

    def get_carbohydrates(self, obj):
        return None

    def get_fat(self, obj):
        return None


class MealLogCreateUpdateSerializer(serializers.ModelSerializer):
    food_id = serializers.PrimaryKeyRelatedField(
        queryset=Food.objects.all(),
        source='food',
    )
    quantity = serializers.FloatField(min_value=0.01)
    unit = serializers.ChoiceField(
        choices=['g', 'ml', 'unit', 'serving'],
        required=False,
    )
    date = serializers.DateField(required=False, default=localdate)
    is_cheat = serializers.BooleanField(required=False, default=False)

    class Meta:
        model = MealLog
        fields = [
            'id',
            'food_id',
            'quantity',
            'unit',
            'date',
            'is_cheat',
            'calories',
            'protein',
        ]
        read_only_fields = ['id', 'calories', 'protein']

    def validate(self, attrs):
        food = attrs.get('food') or (self.instance.food if self.instance else None)
        unit = attrs.get('unit') or (self.instance.unit if self.instance else (food.unit_type if food else 'g'))
        quantity = attrs.get('quantity') if attrs.get('quantity') is not None else (self.instance.quantity if self.instance else 0)
        is_cheat = attrs.get('is_cheat') if attrs.get('is_cheat') is not None else (self.instance.is_cheat if self.instance else False)
        log_date = attrs.get('date') or (self.instance.date if self.instance else localdate())

        if quantity <= 0:
            raise serializers.ValidationError({"quantity": "Quantity must be greater than zero."})

        if unit == 'serving' and (not food or not food.serving_quantity):
            raise serializers.ValidationError({
                "unit": f"Selected food '{food.name if food else ''}' does not have a defined serving quantity. Please use '{food.unit_type if food else 'g'}'."
            })

        attrs['unit'] = unit

        # Validate Cheat Meal constraints if is_cheat is True
        request = self.context.get('request')
        user = request.user if request else None

        if is_cheat and user and hasattr(user, 'profile'):
            profile = user.profile
            # Calculate prospective calories
            qty = quantity
            unit_calc = unit
            if unit_calc == 'serving' and food.serving_quantity:
                qty = qty * food.serving_quantity
                unit_calc = food.unit_type

            if unit_calc in ['g', 'ml']:
                calc_cal = ((food.calories_per_100g or 0) / 100) * qty
            else:
                calc_cal = (food.calories_per_unit or 0) * qty

            required_points = int(calc_cal / 4)

            # Check points
            if profile.points < required_points:
                raise serializers.ValidationError({
                    "is_cheat": f"Not enough points for cheat meal. Need {required_points} points, but you have {profile.points} points."
                })

            # Check daily cheat calories limit
            existing_cheat_cals = MealLog.objects.filter(
                user=user,
                date=log_date,
                is_cheat=True,
            )
            if self.instance:
                existing_cheat_cals = existing_cheat_cals.exclude(id=self.instance.id)

            today_cheat_calories = existing_cheat_cals.aggregate(Sum('calories'))['calories__sum'] or 0
            if today_cheat_calories + calc_cal > profile.max_cheat_calories_per_day:
                raise serializers.ValidationError({
                    "is_cheat": f"Daily cheat calorie limit exceeded. Limit is {profile.max_cheat_calories_per_day} kcal, today's cheat total would reach {today_cheat_calories + calc_cal:.1f} kcal."
                })

            # Check max cheat meals count
            existing_cheat_count = existing_cheat_cals.count()
            if existing_cheat_count >= profile.max_cheat_meals_per_day:
                raise serializers.ValidationError({
                    "is_cheat": f"Max cheat meals reached for today ({profile.max_cheat_meals_per_day} meals allowed)."
                })

            # Store required points for point deduction upon creation
            self._required_points = required_points
        else:
            self._required_points = 0

        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        user = request.user
        validated_data['user'] = user

        # Deduct points if cheat meal
        if validated_data.get('is_cheat') and hasattr(self, '_required_points') and self._required_points > 0:
            profile = user.profile
            profile.points -= self._required_points
            profile.save()

        # MealLog.save() automatically computes calories and protein
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # MealLog.save() recalculates calories and protein on update
        return super().update(instance, validated_data)


class WaterIntakeSerializer(serializers.ModelSerializer):
    amount = serializers.FloatField(min_value=1.0)
    date = serializers.DateField(required=False, default=localdate)

    class Meta:
        model = WaterIntake
        fields = ['id', 'amount', 'date']
        read_only_fields = ['id']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class CheatMealLogSerializer(serializers.Serializer):
    food_id = serializers.PrimaryKeyRelatedField(
        queryset=Food.objects.all(),
        source='food',
    )
    quantity = serializers.FloatField(min_value=0.01)
    unit = serializers.ChoiceField(
        choices=['g', 'ml', 'unit', 'serving'],
        required=False,
    )
    date = serializers.DateField(required=False, default=localdate)

    def validate(self, attrs):
        food = attrs.get('food')
        unit = attrs.get('unit') or food.unit_type
        quantity = attrs.get('quantity')
        log_date = attrs.get('date', localdate())

        if quantity <= 0:
            raise serializers.ValidationError({"quantity": "Enter a valid positive quantity."})

        if unit == 'serving' and not food.serving_quantity:
            raise serializers.ValidationError({
                "unit": f"Food '{food.name}' does not have a serving size defined."
            })

        attrs['unit'] = unit

        # Calculate cheat calories & points
        qty = quantity
        unit_calc = unit
        if unit_calc == 'serving' and food.serving_quantity:
            qty = qty * food.serving_quantity
            unit_calc = food.unit_type

        if unit_calc in ['g', 'ml']:
            calories = ((food.calories_per_100g or 0) / 100) * qty
            protein = ((food.protein_per_100g or 0) / 100) * qty
        else:
            calories = (food.calories_per_unit or 0) * qty
            protein = (food.protein_per_unit or 0) * qty

        required_points = int(calories / 4)

        request = self.context.get('request')
        profile = request.user.profile

        if profile.points < required_points:
            raise serializers.ValidationError({
                "detail": f"Not enough points! Need {required_points} points, but you have {profile.points}."
            })

        today_cheat_calories = MealLog.objects.filter(
            user=request.user,
            date=log_date,
            is_cheat=True
        ).aggregate(Sum('calories'))['calories__sum'] or 0

        if today_cheat_calories + calories > profile.max_cheat_calories_per_day:
            raise serializers.ValidationError({
                "detail": f"Cheat calorie limit exceeded! Max allowed is {profile.max_cheat_calories_per_day} kcal."
            })

        today_cheat_count = MealLog.objects.filter(
            user=request.user,
            date=log_date,
            is_cheat=True
        ).count()

        if today_cheat_count >= profile.max_cheat_meals_per_day:
            raise serializers.ValidationError({
                "detail": f"Max cheat meals reached! Allowed {profile.max_cheat_meals_per_day} meals per day."
            })

        attrs['calories'] = calories
        attrs['protein'] = protein
        attrs['required_points'] = required_points
        return attrs

    def save(self):
        user = self.context['request'].user
        food = self.validated_data['food']
        quantity = self.validated_data['quantity']
        unit = self.validated_data['unit']
        log_date = self.validated_data.get('date', localdate())
        calories = self.validated_data['calories']
        protein = self.validated_data['protein']
        required_points = self.validated_data['required_points']

        meal = MealLog.objects.create(
            user=user,
            food=food,
            quantity=quantity,
            unit=unit,
            date=log_date,
            is_cheat=True,
            calories=calories,
            protein=protein,
        )

        # Deduct points
        profile = user.profile
        profile.points -= required_points
        profile.save()

        return meal, required_points


class CategoryCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Administrative serializer for creating and updating food categories.
    """
    class Meta:
        model = Category
        fields = ['id', 'name']
        read_only_fields = ['id']



class FoodCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Administrative serializer for creating and updating foods.
    Supports M2M categories and image uploads.
    """
    categories = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        many=True,
        required=False,
    )
    image = serializers.ImageField(required=False, allow_null=True)
    calories_per_100g = serializers.FloatField(required=False, allow_null=True, min_value=0.0)
    protein_per_100g = serializers.FloatField(required=False, allow_null=True, min_value=0.0)
    calories_per_unit = serializers.FloatField(required=False, allow_null=True, min_value=0.0)
    protein_per_unit = serializers.FloatField(required=False, allow_null=True, min_value=0.0)
    serving_quantity = serializers.FloatField(required=False, allow_null=True, min_value=0.0)

    class Meta:
        model = Food
        fields = [
            'id',
            'name',
            'calories_per_100g',
            'protein_per_100g',
            'calories_per_unit',
            'protein_per_unit',
            'unit_type',
            'serving_name',
            'serving_quantity',
            'image',
            'categories',
        ]
        read_only_fields = ['id']

    def update(self, instance, validated_data):
        new_image = validated_data.get('image')
        if new_image and instance.image and instance.image.name != new_image.name:
            if not Food.objects.filter(image=instance.image.name).exclude(pk=instance.pk).exists():
                try:
                    instance.image.delete(save=False)
                except Exception:
                    pass
        return super().update(instance, validated_data)
