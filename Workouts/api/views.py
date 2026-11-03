from datetime import datetime
from django.utils.timezone import localdate
from django.db.models import Sum, Count, F, Q
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from Workouts.models import MuscleGroup, SubMuscle, Exercise, WorkoutSession, WorkoutSet
from Control_Panel.api.permissions import IsSuperUserOrReadOnly
from .serializers import (
    MuscleGroupSerializer,
    MuscleGroupDetailSerializer,
    MuscleGroupCreateUpdateSerializer,
    SubMuscleSerializer,
    SubMuscleCreateUpdateSerializer,
    ExerciseSerializer,
    ExerciseCreateUpdateSerializer,
    WorkoutSessionSerializer,
    WorkoutSessionCreateUpdateSerializer,
    WorkoutSetSerializer,
    WorkoutSetCreateUpdateSerializer,
)
from .pagination import StandardResultsSetPagination


# ==============================================================================
# Workout Catalogue Views (Public Read / Superuser Write)
# ==============================================================================

class MuscleGroupListView(generics.ListCreateAPIView):
    """
    GET /api/v1/workouts/muscles/
    Returns list of all main muscle groups (Public).

    POST /api/v1/workouts/muscles/
    Creates a new muscle group (Superuser only).
    """
    permission_classes = [IsSuperUserOrReadOnly]
    queryset = MuscleGroup.objects.annotate(sub_muscles_count=Count('sub_muscles')).order_by('name')
    pagination_class = None

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return MuscleGroupCreateUpdateSerializer
        return MuscleGroupSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(MuscleGroupSerializer(instance).data, status=status.HTTP_201_CREATED)


class MuscleGroupDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/v1/workouts/muscles/{id}/
    Returns details of a muscle group along with its submuscles (Public).

    PATCH / PUT / DELETE /api/v1/workouts/muscles/{id}/
    Superuser-guarded modification and deletion.
    """
    permission_classes = [IsSuperUserOrReadOnly]
    queryset = MuscleGroup.objects.all().prefetch_related('sub_muscles')
    lookup_field = 'id'

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return MuscleGroupCreateUpdateSerializer
        return MuscleGroupDetailSerializer

    def perform_destroy(self, instance):
        if instance.image:
            image_name = instance.image.name
            if not MuscleGroup.objects.filter(image=image_name).exclude(pk=instance.pk).exists():
                try:
                    instance.image.delete(save=False)
                except Exception:
                    pass
        instance.delete()


class SubMuscleListView(generics.ListCreateAPIView):
    """
    GET /api/v1/workouts/submuscles/
    Returns list of all submuscles (Public).
    Supports filtering by ?muscle={id} or ?muscle_group={id}.

    POST /api/v1/workouts/submuscles/
    Creates a new submuscle (Superuser only).
    """
    permission_classes = [IsSuperUserOrReadOnly]
    pagination_class = None

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return SubMuscleCreateUpdateSerializer
        return SubMuscleSerializer

    def get_queryset(self):
        queryset = (
            SubMuscle.objects.all()
            .select_related('muscle_group')
            .annotate(exercises_count=Count('exercises'))
            .order_by('name')
        )
        muscle_param = self.request.query_params.get('muscle') or self.request.query_params.get('muscle_group')
        if muscle_param and muscle_param.isdigit():
            queryset = queryset.filter(muscle_group_id=int(muscle_param))
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(SubMuscleSerializer(instance).data, status=status.HTTP_201_CREATED)


class SubMuscleDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/v1/workouts/submuscles/{id}/
    Returns details of a submuscle (Public).

    PATCH / PUT / DELETE /api/v1/workouts/submuscles/{id}/
    Superuser-guarded modification and deletion.
    """
    permission_classes = [IsSuperUserOrReadOnly]
    queryset = SubMuscle.objects.all().select_related('muscle_group').annotate(exercises_count=Count('exercises'))
    lookup_field = 'id'

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return SubMuscleCreateUpdateSerializer
        return SubMuscleSerializer

    def perform_destroy(self, instance):
        if instance.image:
            image_name = instance.image.name
            if not SubMuscle.objects.filter(image=image_name).exclude(pk=instance.pk).exists():
                try:
                    instance.image.delete(save=False)
                except Exception:
                    pass
        if instance.video:
            video_name = instance.video.name
            if not SubMuscle.objects.filter(video=video_name).exclude(pk=instance.pk).exists():
                try:
                    instance.video.delete(save=False)
                except Exception:
                    pass
        instance.delete()


class ExerciseListView(generics.ListCreateAPIView):
    """
    GET /api/v1/workouts/exercises/
    Returns paginated list of exercises in catalogue (Public).
    Supports:
    - ?search=bench or ?q=bench
    - ?muscle={id}
    - ?sub_muscle={id} or ?submuscle={id}

    POST /api/v1/workouts/exercises/
    Creates a new exercise (Superuser only).
    """
    permission_classes = [IsSuperUserOrReadOnly]
    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ExerciseCreateUpdateSerializer
        return ExerciseSerializer

    def get_queryset(self):
        queryset = Exercise.objects.all().select_related('sub_muscle__muscle_group').order_by('name')

        # Name search
        query = self.request.query_params.get('search') or self.request.query_params.get('q')
        if query:
            queryset = queryset.filter(name__icontains=query.strip())

        # SubMuscle filter
        sub_param = self.request.query_params.get('sub_muscle') or self.request.query_params.get('submuscle')
        if sub_param and sub_param.isdigit():
            queryset = queryset.filter(sub_muscle_id=int(sub_param))

        # Muscle Group filter
        muscle_param = self.request.query_params.get('muscle') or self.request.query_params.get('muscle_group')
        if muscle_param and muscle_param.isdigit():
            queryset = queryset.filter(sub_muscle__muscle_group_id=int(muscle_param))

        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(ExerciseSerializer(instance).data, status=status.HTTP_201_CREATED)


class ExerciseDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/v1/workouts/exercises/{id}/
    Returns detailed exercise information, steps, equipment, and media (Public).

    PATCH / PUT / DELETE /api/v1/workouts/exercises/{id}/
    Superuser-guarded modification and deletion.
    """
    permission_classes = [IsSuperUserOrReadOnly]
    queryset = Exercise.objects.all().select_related('sub_muscle__muscle_group')
    lookup_field = 'id'

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return ExerciseCreateUpdateSerializer
        return ExerciseSerializer

    def perform_destroy(self, instance):
        if instance.image:
            image_name = instance.image.name
            if not Exercise.objects.filter(image=image_name).exclude(pk=instance.pk).exists():
                try:
                    instance.image.delete(save=False)
                except Exception:
                    pass
        if instance.video:
            video_name = instance.video.name
            if not Exercise.objects.filter(video=video_name).exclude(pk=instance.pk).exists():
                try:
                    instance.video.delete(save=False)
                except Exception:
                    pass
        instance.delete()


# ==============================================================================
# Workout Session Views (Authenticated & User-Scoped)
# ==============================================================================

class WorkoutSessionListCreateView(APIView):
    """
    GET /api/v1/workouts/sessions/
    Returns authenticated user's workout sessions.
    Supports ?date=YYYY-MM-DD and ?sub_muscle={id}.

    POST /api/v1/workouts/sessions/
    Starts a new workout session for the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        queryset = WorkoutSession.objects.filter(
            user=request.user
        ).select_related('sub_muscle__muscle_group').prefetch_related('sets__exercise').order_by('-date', '-id')

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

        sub_muscle = request.query_params.get('sub_muscle')
        if sub_muscle and sub_muscle.isdigit():
            queryset = queryset.filter(sub_muscle_id=int(sub_muscle))

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request)
        if page is not None:
            serializer = WorkoutSessionSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = WorkoutSessionSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        serializer = WorkoutSessionCreateUpdateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            session = serializer.save()
            return Response(
                WorkoutSessionSerializer(session).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WorkoutSessionDetailView(APIView):
    """
    GET /api/v1/workouts/sessions/{id}/
    Returns workout session details with all logged sets.

    PATCH /api/v1/workouts/sessions/{id}/
    Updates workout session info.

    DELETE /api/v1/workouts/sessions/{id}/
    Deletes workout session and all associated sets.
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return WorkoutSession.objects.select_related(
                'sub_muscle__muscle_group'
            ).prefetch_related('sets__exercise').get(pk=pk, user=self.request.user)
        except WorkoutSession.DoesNotExist:
            return None

    def get(self, request, id, *args, **kwargs):
        session = self.get_object(id)
        if not session:
            return Response({"detail": "Workout session not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = WorkoutSessionSerializer(session)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, id, *args, **kwargs):
        session = self.get_object(id)
        if not session:
            return Response({"detail": "Workout session not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = WorkoutSessionCreateUpdateSerializer(session, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            updated_session = serializer.save()
            return Response(WorkoutSessionSerializer(updated_session).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, id, *args, **kwargs):
        session = self.get_object(id)
        if not session:
            return Response({"detail": "Workout session not found."}, status=status.HTTP_404_NOT_FOUND)

        session.delete()
        return Response(
            {"message": "Workout session deleted successfully."},
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# Workout Set Views (Authenticated & User-Scoped)
# ==============================================================================

class WorkoutSessionSetsView(APIView):
    """
    GET /api/v1/workouts/sessions/{id}/sets/
    Returns all sets logged in the specified workout session.

    POST /api/v1/workouts/sessions/{id}/sets/
    Logs a new set for the specified workout session.
    """
    permission_classes = [IsAuthenticated]

    def get_session(self, session_id):
        try:
            return WorkoutSession.objects.get(pk=session_id, user=self.request.user)
        except WorkoutSession.DoesNotExist:
            return None

    def get(self, request, id, *args, **kwargs):
        session = self.get_session(id)
        if not session:
            return Response({"detail": "Workout session not found."}, status=status.HTTP_404_NOT_FOUND)

        sets = session.sets.select_related('exercise', 'sub_muscle').order_by('set_number', 'id')
        serializer = WorkoutSetSerializer(sets, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, id, *args, **kwargs):
        session = self.get_session(id)
        if not session:
            return Response({"detail": "Workout session not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = WorkoutSetCreateUpdateSerializer(
            data=request.data,
            context={'request': request, 'session': session},
        )
        if serializer.is_valid():
            workout_set = serializer.save()
            return Response(
                WorkoutSetSerializer(workout_set).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WorkoutSetDetailView(APIView):
    """
    PATCH /api/v1/workouts/sets/{id}/
    Updates reps, weight, or exercise of a workout set.

    DELETE /api/v1/workouts/sets/{id}/
    Deletes a workout set.
    """
    permission_classes = [IsAuthenticated]

    def get_set(self, set_id):
        try:
            return WorkoutSet.objects.select_related('session').get(
                pk=set_id,
                session__user=self.request.user,
            )
        except WorkoutSet.DoesNotExist:
            return None

    def patch(self, request, id, *args, **kwargs):
        workout_set = self.get_set(id)
        if not workout_set:
            return Response({"detail": "Workout set not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = WorkoutSetCreateUpdateSerializer(
            workout_set,
            data=request.data,
            partial=True,
            context={'request': request, 'session': workout_set.session},
        )
        if serializer.is_valid():
            updated_set = serializer.save()
            return Response(WorkoutSetSerializer(updated_set).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, id, *args, **kwargs):
        workout_set = self.get_set(id)
        if not workout_set:
            return Response({"detail": "Workout set not found."}, status=status.HTTP_404_NOT_FOUND)

        workout_set.delete()
        return Response(
            {"message": "Workout set deleted successfully."},
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# Workout History and Summary Views
# ==============================================================================

class WorkoutHistoryView(APIView):
    """
    GET /api/v1/workouts/history/
    Returns chronological workout log history for authenticated user.
    Supports filters:
    - ?exercise={id}
    - ?muscle={id}
    - ?sub_muscle={id}
    - ?date=YYYY-MM-DD
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        sets = WorkoutSet.objects.filter(
            session__user=user
        ).select_related('exercise', 'session__sub_muscle__muscle_group').order_by('-session__date', '-session__id', 'set_number')

        # Filters
        exercise_id = request.query_params.get('exercise')
        if exercise_id and exercise_id.isdigit():
            sets = sets.filter(exercise_id=int(exercise_id))

        sub_muscle_id = request.query_params.get('sub_muscle') or request.query_params.get('submuscle')
        if sub_muscle_id and sub_muscle_id.isdigit():
            sets = sets.filter(session__sub_muscle_id=int(sub_muscle_id))

        muscle_id = request.query_params.get('muscle')
        if muscle_id and muscle_id.isdigit():
            sets = sets.filter(session__sub_muscle__muscle_group_id=int(muscle_id))

        date_param = request.query_params.get('date')
        if date_param:
            try:
                filter_date = datetime.strptime(date_param.strip(), '%Y-%m-%d').date()
                sets = sets.filter(session__date=filter_date)
            except ValueError:
                return Response(
                    {"date": "Invalid date format. Expected YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(sets, request)
        if page is not None:
            history_data = [
                {
                    "set_id": s.id,
                    "session_id": s.session_id,
                    "date": str(s.session.date),
                    "muscle_group": s.session.sub_muscle.muscle_group.name,
                    "sub_muscle": s.session.sub_muscle.name,
                    "exercise_id": s.exercise_id,
                    "exercise_name": s.exercise.name,
                    "set_number": s.set_number,
                    "reps": s.reps,
                    "weight": s.weight,
                    "volume": round(s.reps * s.weight, 2),
                }
                for s in page
            ]
            return paginator.get_paginated_response(history_data)

        history_data = [
            {
                "set_id": s.id,
                "session_id": s.session_id,
                "date": str(s.session.date),
                "muscle_group": s.session.sub_muscle.muscle_group.name,
                "sub_muscle": s.session.sub_muscle.name,
                "exercise_id": s.exercise_id,
                "exercise_name": s.exercise.name,
                "set_number": s.set_number,
                "reps": s.reps,
                "weight": s.weight,
                "volume": round(s.reps * s.weight, 2),
            }
            for s in sets
        ]
        return Response(history_data, status=status.HTTP_200_OK)


class WorkoutSummaryView(APIView):
    """
    GET /api/v1/workouts/summary/
    Returns high-level workout metrics for authenticated user:
    - total_sessions
    - total_sets
    - total_reps
    - total_weight_volume (kg/lbs lifted)
    - distinct_exercises_count
    - muscle_groups_breakdown
    - recent_sessions
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        sessions = WorkoutSession.objects.filter(user=user)
        sets = WorkoutSet.objects.filter(session__user=user)

        # Period filter
        date_param = request.query_params.get('date')
        if date_param:
            try:
                target_date = datetime.strptime(date_param.strip(), '%Y-%m-%d').date()
                sessions = sessions.filter(date=target_date)
                sets = sets.filter(session__date=target_date)
            except ValueError:
                return Response(
                    {"date": "Invalid date format. Expected YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        total_sessions = sessions.count()
        total_sets = sets.count()
        total_reps = sets.aggregate(Sum('reps'))['reps__sum'] or 0

        # Calculate volume
        all_sets = sets.values('reps', 'weight')
        total_volume = round(sum((s['reps'] * s['weight']) for s in all_sets), 2)

        distinct_exercises = sets.values('exercise_id').distinct().count()

        # Muscle groups breakdown
        muscle_breakdown = (
            sets.values(
                muscle_id=F('session__sub_muscle__muscle_group_id'),
                muscle_name=F('session__sub_muscle__muscle_group__name'),
            )
            .annotate(sets_count=Count('id'), reps_count=Sum('reps'))
            .order_by('-sets_count')
        )

        # Recent 5 sessions
        recent_sessions = sessions.select_related(
            'sub_muscle__muscle_group'
        ).prefetch_related('sets').order_by('-date', '-id')[:5]

        return Response(
            {
                "total_sessions": total_sessions,
                "total_sets": total_sets,
                "total_reps": total_reps,
                "total_weight_volume": total_volume,
                "distinct_exercises_count": distinct_exercises,
                "muscle_groups_breakdown": list(muscle_breakdown),
                "recent_sessions": WorkoutSessionSerializer(recent_sessions, many=True).data,
            },
            status=status.HTTP_200_OK,
        )
