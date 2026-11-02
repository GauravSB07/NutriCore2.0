from rest_framework import serializers
from django.db.models import Sum

from Workouts.models import MuscleGroup, SubMuscle, Exercise, WorkoutSession, WorkoutSet


def get_media_url(file_field):
    if file_field:
        try:
            return file_field.url
        except Exception:
            return None
    return None


class MuscleGroupBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = MuscleGroup
        fields = ['id', 'name']


class MuscleGroupSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    sub_muscles_count = serializers.IntegerField(source='sub_muscles.count', read_only=True)

    class Meta:
        model = MuscleGroup
        fields = ['id', 'name', 'image_url', 'sub_muscles_count']

    def get_image_url(self, obj):
        return get_media_url(obj.image)


class SubMuscleBriefSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    exercises_count = serializers.IntegerField(source='exercises.count', read_only=True)

    class Meta:
        model = SubMuscle
        fields = ['id', 'name', 'description', 'image_url', 'exercises_count']

    def get_image_url(self, obj):
        return get_media_url(obj.image)


class MuscleGroupDetailSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    sub_muscles = SubMuscleBriefSerializer(many=True, read_only=True)

    class Meta:
        model = MuscleGroup
        fields = ['id', 'name', 'image_url', 'sub_muscles']

    def get_image_url(self, obj):
        return get_media_url(obj.image)


class SubMuscleSerializer(serializers.ModelSerializer):
    muscle_group = MuscleGroupBriefSerializer(read_only=True)
    image_url = serializers.SerializerMethodField()
    video_url = serializers.SerializerMethodField()
    exercises_count = serializers.IntegerField(source='exercises.count', read_only=True)

    class Meta:
        model = SubMuscle
        fields = [
            'id',
            'name',
            'muscle_group',
            'description',
            'image_url',
            'video_url',
            'exercises_count',
        ]

    def get_image_url(self, obj):
        return get_media_url(obj.image)

    def get_video_url(self, obj):
        return get_media_url(obj.video)


class ExerciseBriefSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Exercise
        fields = ['id', 'name', 'equipment', 'image_url']

    def get_image_url(self, obj):
        return get_media_url(obj.image)


class ExerciseSerializer(serializers.ModelSerializer):
    sub_muscle = SubMuscleBriefSerializer(read_only=True)
    muscle_group_name = serializers.CharField(source='sub_muscle.muscle_group.name', read_only=True)
    image_url = serializers.SerializerMethodField()
    video_url = serializers.SerializerMethodField()

    class Meta:
        model = Exercise
        fields = [
            'id',
            'name',
            'sub_muscle',
            'muscle_group_name',
            'equipment',
            'description',
            'steps',
            'image_url',
            'video_url',
        ]

    def get_image_url(self, obj):
        return get_media_url(obj.image)

    def get_video_url(self, obj):
        return get_media_url(obj.video)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get('steps'):
            data['steps'] = data['steps'].replace('\\n', '\n')
        return data


class WorkoutSetSerializer(serializers.ModelSerializer):
    exercise = ExerciseBriefSerializer(read_only=True)
    sub_muscle_name = serializers.CharField(source='sub_muscle.name', read_only=True)
    volume = serializers.SerializerMethodField()

    class Meta:
        model = WorkoutSet
        fields = [
            'id',
            'session_id',
            'exercise',
            'sub_muscle_name',
            'set_number',
            'reps',
            'weight',
            'volume',
        ]
        read_only_fields = ['id', 'session_id', 'set_number', 'volume']

    def get_volume(self, obj):
        if obj.reps and obj.weight is not None:
            return round(obj.reps * obj.weight, 2)
        return 0.0


class WorkoutSetCreateUpdateSerializer(serializers.ModelSerializer):
    exercise_id = serializers.PrimaryKeyRelatedField(
        queryset=Exercise.objects.all(),
        source='exercise',
    )
    reps = serializers.IntegerField(min_value=1)
    weight = serializers.FloatField(min_value=0.0)
    set_number = serializers.IntegerField(required=False, min_value=1)

    class Meta:
        model = WorkoutSet
        fields = ['id', 'exercise_id', 'set_number', 'reps', 'weight']
        read_only_fields = ['id']

    def create(self, validated_data):
        session = self.context['session']
        exercise = validated_data['exercise']
        sub_muscle = exercise.sub_muscle if exercise.sub_muscle else session.sub_muscle

        # Auto calculate set number if not provided
        if 'set_number' not in validated_data:
            existing_count = session.sets.filter(exercise=exercise).count()
            validated_data['set_number'] = existing_count + 1

        validated_data['session'] = session
        validated_data['sub_muscle'] = sub_muscle

        return super().create(validated_data)


class WorkoutSessionSerializer(serializers.ModelSerializer):
    sub_muscle = SubMuscleBriefSerializer(read_only=True)
    muscle_group_name = serializers.CharField(source='sub_muscle.muscle_group.name', read_only=True)
    total_sets = serializers.SerializerMethodField()
    total_reps = serializers.SerializerMethodField()
    total_weight_volume = serializers.SerializerMethodField()
    exercises_count = serializers.SerializerMethodField()
    sets = WorkoutSetSerializer(many=True, read_only=True)

    class Meta:
        model = WorkoutSession
        fields = [
            'id',
            'sub_muscle',
            'muscle_group_name',
            'date',
            'total_sets',
            'total_reps',
            'total_weight_volume',
            'exercises_count',
            'sets',
        ]
        read_only_fields = ['id', 'date', 'total_sets', 'total_reps', 'total_weight_volume', 'exercises_count']

    def get_total_sets(self, obj):
        return obj.sets.count()

    def get_total_reps(self, obj):
        return obj.sets.aggregate(Sum('reps'))['reps__sum'] or 0

    def get_total_weight_volume(self, obj):
        sets = obj.sets.all()
        return round(sum((s.reps * s.weight) for s in sets), 2)

    def get_exercises_count(self, obj):
        return obj.sets.values('exercise_id').distinct().count()


class WorkoutSessionCreateUpdateSerializer(serializers.ModelSerializer):
    sub_muscle_id = serializers.PrimaryKeyRelatedField(
        queryset=SubMuscle.objects.all(),
        source='sub_muscle',
    )
    date = serializers.DateField(required=False)

    class Meta:
        model = WorkoutSession
        fields = ['id', 'sub_muscle_id', 'date']
        read_only_fields = ['id']

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['user'] = user
        session_date = validated_data.pop('date', None)

        instance = super().create(validated_data)
        if session_date:
            instance.date = session_date
            instance.save()
        return instance

    def update(self, instance, validated_data):
        session_date = validated_data.pop('date', None)
        instance = super().update(instance, validated_data)
        if session_date:
            instance.date = session_date
            instance.save()
        return instance


# ==============================================================================
# Administrative Catalogue Serializers (Superuser Write)
# ==============================================================================

class MuscleGroupCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Administrative serializer for creating and updating muscle groups.
    """
    image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = MuscleGroup
        fields = ['id', 'name', 'image']
        read_only_fields = ['id']

    def update(self, instance, validated_data):
        new_image = validated_data.get('image')
        if new_image and instance.image and instance.image.name != new_image.name:
            if not MuscleGroup.objects.filter(image=instance.image.name).exclude(pk=instance.pk).exists():
                try:
                    instance.image.delete(save=False)
                except Exception:
                    pass
        return super().update(instance, validated_data)


class SubMuscleCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Administrative serializer for creating and updating submuscles.
    """
    muscle_group = serializers.PrimaryKeyRelatedField(
        queryset=MuscleGroup.objects.all(),
        required=False,
    )
    muscle_group_id = serializers.PrimaryKeyRelatedField(
        queryset=MuscleGroup.objects.all(),
        source='muscle_group',
        required=False,
    )
    image = serializers.ImageField(required=False, allow_null=True)
    video = serializers.FileField(required=False, allow_null=True)

    class Meta:
        model = SubMuscle
        fields = [
            'id',
            'name',
            'muscle_group',
            'muscle_group_id',
            'description',
            'image',
            'video',
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'muscle_group_id': {'write_only': True},
        }

    def validate(self, attrs):
        if not self.instance and 'muscle_group' not in attrs:
            raise serializers.ValidationError({'muscle_group': 'This field is required.'})
        return attrs

    def update(self, instance, validated_data):
        new_image = validated_data.get('image')
        if new_image and instance.image and instance.image.name != new_image.name:
            if not SubMuscle.objects.filter(image=instance.image.name).exclude(pk=instance.pk).exists():
                try:
                    instance.image.delete(save=False)
                except Exception:
                    pass
        new_video = validated_data.get('video')
        if new_video and instance.video and instance.video.name != new_video.name:
            if not SubMuscle.objects.filter(video=instance.video.name).exclude(pk=instance.pk).exists():
                try:
                    instance.video.delete(save=False)
                except Exception:
                    pass
        return super().update(instance, validated_data)


class ExerciseCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Administrative serializer for creating and updating exercises.
    Supports media uploads, steps, equipment, and submuscle relationship.
    """
    sub_muscle = serializers.PrimaryKeyRelatedField(
        queryset=SubMuscle.objects.all(),
        required=False,
    )
    sub_muscle_id = serializers.PrimaryKeyRelatedField(
        queryset=SubMuscle.objects.all(),
        source='sub_muscle',
        required=False,
    )
    image = serializers.ImageField(required=False, allow_null=True)
    video = serializers.FileField(required=False, allow_null=True)

    class Meta:
        model = Exercise
        fields = [
            'id',
            'name',
            'sub_muscle',
            'sub_muscle_id',
            'equipment',
            'description',
            'steps',
            'image',
            'video',
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'sub_muscle_id': {'write_only': True},
        }

    def validate(self, attrs):
        if not self.instance and 'sub_muscle' not in attrs:
            raise serializers.ValidationError({'sub_muscle': 'This field is required.'})
        return attrs

    def update(self, instance, validated_data):
        new_image = validated_data.get('image')
        if new_image and instance.image and instance.image.name != new_image.name:
            if not Exercise.objects.filter(image=instance.image.name).exclude(pk=instance.pk).exists():
                try:
                    instance.image.delete(save=False)
                except Exception:
                    pass
        new_video = validated_data.get('video')
        if new_video and instance.video and instance.video.name != new_video.name:
            if not Exercise.objects.filter(video=instance.video.name).exclude(pk=instance.pk).exists():
                try:
                    instance.video.delete(save=False)
                except Exception:
                    pass
        return super().update(instance, validated_data)

