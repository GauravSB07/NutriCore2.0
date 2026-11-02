from rest_framework import serializers
from django.utils.timezone import localdate
from Progress.models import StepsLog
from Users.models import Profile


class StepsLogSerializer(serializers.ModelSerializer):
    """
    Serializer for StepsLog records.
    """
    user = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = StepsLog
        fields = ['id', 'user', 'steps', 'date']
        read_only_fields = ['id', 'user']


class StepsLogCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating and updating StepsLog records.
    """
    steps = serializers.IntegerField(min_value=1, error_messages={
        'min_value': 'Steps count must be at least 1.',
        'invalid': 'A valid integer is required for steps.'
    })
    date = serializers.DateField(required=False, default=localdate)

    class Meta:
        model = StepsLog
        fields = ['id', 'steps', 'date']
        read_only_fields = ['id']

    def create(self, validated_data):
        user = self.context['request'].user
        date = validated_data.get('date', localdate())
        steps = validated_data['steps']
        return StepsLog.objects.create(user=user, date=date, steps=steps)

    def update(self, instance, validated_data):
        instance.steps = validated_data.get('steps', instance.steps)
        instance.date = validated_data.get('date', instance.date)
        instance.save()
        return instance


class WeightUpdateSerializer(serializers.Serializer):
    """
    Serializer for recording/updating weight and body measurements on the user profile.
    """
    weight = serializers.FloatField(required=False, min_value=1.0, error_messages={
        'min_value': 'Weight must be greater than 0 kg.'
    })
    start_weight = serializers.FloatField(required=False, min_value=1.0, error_messages={
        'min_value': 'Start weight must be greater than 0 kg.'
    })
    target_weight = serializers.FloatField(required=False, min_value=1.0, error_messages={
        'min_value': 'Target weight must be greater than 0 kg.'
    })
    height = serializers.FloatField(required=False, min_value=1.0, error_messages={
        'min_value': 'Height must be greater than 0 cm.'
    })

    def validate(self, attrs):
        if not any(k in attrs for k in ['weight', 'start_weight', 'target_weight', 'height']):
            raise serializers.ValidationError("At least one measurement field (weight, start_weight, target_weight, height) must be provided.")
        return attrs


class WeightProgressSerializer(serializers.Serializer):
    """
    Serializer for weight and body progress stats based on Profile.
    """
    current_weight = serializers.FloatField(allow_null=True)
    start_weight = serializers.FloatField(allow_null=True)
    target_weight = serializers.FloatField(allow_null=True)
    height = serializers.FloatField(allow_null=True)
    weight_progress_percent = serializers.FloatField()
    weight_remaining = serializers.FloatField(allow_null=True)
    goal = serializers.CharField()
