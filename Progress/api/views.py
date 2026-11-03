from datetime import datetime, timedelta
import math
from collections import defaultdict
from django.utils.timezone import localdate, now
from django.db.models import Sum, Count, F, Q
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from Progress.models import StepsLog
from Nutrition.models import MealLog, WaterIntake
from Workouts.models import WorkoutSession, WorkoutSet, SubMuscle
from .serializers import (
    StepsLogSerializer,
    StepsLogCreateUpdateSerializer,
    WeightUpdateSerializer,
    WeightProgressSerializer,
)
from .pagination import StandardResultsSetPagination


# ==============================================================================
# Helper Calculations (Reusing existing Progress logic)
# ==============================================================================

def get_daily_metrics(user, target_date):
    """
    Computes daily nutrition, steps, water, and workout metrics for a given user and date.
    Exactly matches Progress/views.py daily_report logic.
    """
    profile = user.profile

    # Meals
    meals = MealLog.objects.filter(user=user, date=target_date)
    total_calories = meals.aggregate(Sum('calories'))['calories__sum'] or 0
    total_protein = meals.aggregate(Sum('protein'))['protein__sum'] or 0

    calorie_target = profile.daily_calorie_target or 2000
    protein_target = profile.daily_protein_target or 80

    calories_left = calorie_target - total_calories
    protein_left = protein_target - total_protein

    if profile.goal in ['cut', 'fat_loss']:
        if total_calories <= calorie_target:
            day_type = "Good (Fat Loss)"
            good_day = True
        else:
            day_type = "Overeaten"
            good_day = False
    else:
        if total_calories >= calorie_target:
            day_type = "Good (Bulk)"
            good_day = True
        else:
            day_type = "Undereaten"
            good_day = False

    # Steps
    step_logs = StepsLog.objects.filter(user=user, date=target_date).order_by('id')
    total_steps = step_logs.aggregate(Sum('steps'))['steps__sum'] or 0
    steps_goal = profile.daily_steps_target or 8000
    steps_left = max(steps_goal - total_steps, 0)
    steps_percent = round((total_steps / steps_goal) * 100, 1) if steps_goal else 0.0

    # Water
    water_logs = WaterIntake.objects.filter(user=user, date=target_date)
    total_water = water_logs.aggregate(Sum('amount'))['amount__sum'] or 0
    water_goal = profile.daily_water_goal or 3000
    water_left = max(water_goal - total_water, 0)
    water_percent = round((total_water / water_goal) * 100, 1) if water_goal else 0.0

    # Workouts
    sessions = WorkoutSession.objects.filter(user=user, date=target_date)
    workouts_count = sessions.count()
    workout_sets = WorkoutSet.objects.filter(session__in=sessions)
    total_sets = workout_sets.count()
    total_volume = round(sum(s.reps * s.weight for s in workout_sets), 2)

    return {
        "date": str(target_date),
        "nutrition": {
            "total_calories": round(total_calories, 1),
            "total_protein": round(total_protein, 1),
            "calorie_target": calorie_target,
            "protein_target": protein_target,
            "calories_left": round(calories_left, 1),
            "protein_left": round(protein_left, 1),
            "day_type": day_type,
            "good_day": good_day,
        },
        "steps": {
            "total_steps": total_steps,
            "daily_steps_target": steps_goal,
            "steps_left": steps_left,
            "steps_percent": min(steps_percent, 100.0),
            "logs_count": step_logs.count(),
        },
        "water": {
            "total_water_ml": total_water,
            "water_goal_ml": water_goal,
            "water_left_ml": water_left,
            "water_percent": min(water_percent, 100.0),
        },
        "workouts": {
            "sessions_count": workouts_count,
            "total_sets": total_sets,
            "total_weight_volume": total_volume,
        },
        "points": profile.points,
    }


# ==============================================================================
# Task 2 — Daily Progress APIs
# ==============================================================================

class DailyProgressView(APIView):
    """
    GET /api/v1/progress/daily/
    Returns daily progress overview matching existing daily_report calculation.
    Supports ?date=YYYY-MM-DD (defaults to today).

    POST /api/v1/progress/daily/
    Logs daily progress / steps for the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        date_param = request.query_params.get('date')
        if date_param:
            try:
                target_date = datetime.strptime(date_param.strip(), '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {"date": "Invalid date format. Expected YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            target_date = localdate()

        metrics = get_daily_metrics(request.user, target_date)
        # Include step log items for that day
        step_logs = StepsLog.objects.filter(user=request.user, date=target_date).order_by('id')
        metrics['step_logs'] = StepsLogSerializer(step_logs, many=True).data

        return Response(metrics, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        serializer = StepsLogCreateUpdateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            step_log = serializer.save()
            updated_metrics = get_daily_metrics(request.user, step_log.date)
            return Response(
                {
                    "message": f"+{step_log.steps} steps added successfully.",
                    "log": StepsLogSerializer(step_log).data,
                    "daily_metrics": updated_metrics,
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DailyProgressDetailView(APIView):
    """
    GET /api/v1/progress/daily/{id}/
    Retrieves a daily log record by ID (scoped to authenticated user).

    PATCH /api/v1/progress/daily/{id}/
    Updates a daily log record.

    DELETE /api/v1/progress/daily/{id}/
    Deletes a daily log record.
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return StepsLog.objects.get(pk=pk, user=self.request.user)
        except StepsLog.DoesNotExist:
            return None

    def get(self, request, id, *args, **kwargs):
        log = self.get_object(id)
        if not log:
            return Response({"detail": "Daily progress record not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(StepsLogSerializer(log).data, status=status.HTTP_200_OK)

    def patch(self, request, id, *args, **kwargs):
        log = self.get_object(id)
        if not log:
            return Response({"detail": "Daily progress record not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = StepsLogCreateUpdateSerializer(log, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            updated = serializer.save()
            return Response(StepsLogSerializer(updated).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, id, *args, **kwargs):
        log = self.get_object(id)
        if not log:
            return Response({"detail": "Daily progress record not found."}, status=status.HTTP_404_NOT_FOUND)

        log.delete()
        return Response({"message": "Daily progress record deleted successfully."}, status=status.HTTP_200_OK)


# ==============================================================================
# Task 3 — Weight and Body Progress
# ==============================================================================

class WeightProgressView(APIView):
    """
    GET /api/v1/progress/weight/
    Returns current weight status, start weight, target weight, and calculated progress percent.

    POST /api/v1/progress/weight/ or PATCH /api/v1/progress/weight/
    Records or updates weight and body measurements on the user's profile.

    DELETE /api/v1/progress/weight/
    Resets current weight measurement.
    """
    permission_classes = [IsAuthenticated]

    def _calculate_weight_data(self, profile):
        weight_progress = 0.0
        if profile.start_weight and profile.target_weight and profile.weight:
            total = abs(profile.start_weight - profile.target_weight)
            done = abs(profile.start_weight - profile.weight)
            if total > 0:
                weight_progress = (done / total) * 100

        remaining = None
        if profile.weight is not None and profile.target_weight is not None:
            remaining = round(abs(profile.weight - profile.target_weight), 2)

        return {
            "current_weight": profile.weight,
            "start_weight": profile.start_weight,
            "target_weight": profile.target_weight,
            "height": profile.height,
            "weight_progress_percent": round(min(weight_progress, 100.0), 1),
            "weight_remaining": remaining,
            "goal": profile.goal,
        }

    def get(self, request, *args, **kwargs):
        profile = request.user.profile
        data = self._calculate_weight_data(profile)
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        profile = request.user.profile
        serializer = WeightUpdateSerializer(data=request.data)
        if serializer.is_valid():
            vdata = serializer.validated_data
            if 'weight' in vdata:
                profile.weight = vdata['weight']
            if 'start_weight' in vdata:
                profile.start_weight = vdata['start_weight']
            if 'target_weight' in vdata:
                profile.target_weight = vdata['target_weight']
            if 'height' in vdata:
                profile.height = vdata['height']
            profile.save()

            return Response(
                {
                    "message": "Weight record updated successfully.",
                    "data": self._calculate_weight_data(profile),
                },
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, *args, **kwargs):
        return self.post(request, *args, **kwargs)

    def delete(self, request, *args, **kwargs):
        profile = request.user.profile
        profile.weight = None
        profile.save()
        return Response(
            {
                "message": "Current weight record reset successfully.",
                "data": self._calculate_weight_data(profile),
            },
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# Task 4 — Step Tracking APIs
# ==============================================================================

class StepsLogListCreateView(APIView):
    """
    GET /api/v1/progress/steps/
    Returns step log history. Supports ?date=YYYY-MM-DD.
    Includes daily total, goal, remaining, and progress percent.

    POST /api/v1/progress/steps/
    Logs a new steps entry.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        profile = user.profile
        date_param = request.query_params.get('date')

        queryset = StepsLog.objects.filter(user=user).order_by('-date', '-id')

        if date_param:
            try:
                filter_date = datetime.strptime(date_param.strip(), '%Y-%m-%d').date()
                queryset = queryset.filter(date=filter_date)
            except ValueError:
                return Response(
                    {"date": "Invalid date format. Expected YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            target_date = filter_date
        else:
            target_date = localdate()

        # Today / target date summary metrics
        date_logs = StepsLog.objects.filter(user=user, date=target_date)
        total_steps = date_logs.aggregate(Sum('steps'))['steps__sum'] or 0
        goal = profile.daily_steps_target or 8000
        remaining = max(goal - total_steps, 0)
        progress_percent = round((total_steps / goal) * 100, 1) if goal else 0.0

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request)
        if page is not None:
            serializer = StepsLogSerializer(page, many=True)
            res = paginator.get_paginated_response(serializer.data)
            res.data['daily_summary'] = {
                "date": str(target_date),
                "total_steps": total_steps,
                "goal": goal,
                "remaining": remaining,
                "progress_percent": min(progress_percent, 100.0),
            }
            return res

        serializer = StepsLogSerializer(queryset, many=True)
        return Response(
            {
                "results": serializer.data,
                "daily_summary": {
                    "date": str(target_date),
                    "total_steps": total_steps,
                    "goal": goal,
                    "remaining": remaining,
                    "progress_percent": min(progress_percent, 100.0),
                },
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request, *args, **kwargs):
        serializer = StepsLogCreateUpdateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            log = serializer.save()
            return Response(StepsLogSerializer(log).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class StepsLogDetailView(APIView):
    """
    GET /api/v1/progress/steps/{id}/
    PATCH /api/v1/progress/steps/{id}/
    DELETE /api/v1/progress/steps/{id}/
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return StepsLog.objects.get(pk=pk, user=self.request.user)
        except StepsLog.DoesNotExist:
            return None

    def get(self, request, id, *args, **kwargs):
        log = self.get_object(id)
        if not log:
            return Response({"detail": "Steps log record not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(StepsLogSerializer(log).data, status=status.HTTP_200_OK)

    def patch(self, request, id, *args, **kwargs):
        log = self.get_object(id)
        if not log:
            return Response({"detail": "Steps log record not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = StepsLogCreateUpdateSerializer(log, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            updated = serializer.save()
            return Response(StepsLogSerializer(updated).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, id, *args, **kwargs):
        log = self.get_object(id)
        if not log:
            return Response({"detail": "Steps log record not found."}, status=status.HTTP_404_NOT_FOUND)

        log.delete()
        return Response({"message": "Steps log record deleted successfully."}, status=status.HTTP_200_OK)


# ==============================================================================
# Task 5 — Weekly Progress API
# ==============================================================================

class WeeklyProgressView(APIView):
    """
    GET /api/v1/progress/weekly/
    Replicates Progress/views.py weekly_report and workout_reports.
    Supports ?date=YYYY-MM-DD or ?week_offset=0.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        profile = user.profile

        date_param = request.query_params.get('date')
        if date_param:
            try:
                base_date = datetime.strptime(date_param.strip(), '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {"date": "Invalid date format. Expected YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            base_date = localdate()

        week_offset = int(request.query_params.get('week_offset') or request.query_params.get('week') or 0)
        # Apply week offset
        end_date = base_date - timedelta(weeks=week_offset)
        start_date = end_date - timedelta(days=6)

        # Batch query nutrition, steps, and workout sessions for the 7-day date range
        meal_aggregates = (
            MealLog.objects.filter(user=user, date__gte=start_date, date__lte=end_date)
            .values('date')
            .annotate(
                total_calories=Sum('calories'),
                total_protein=Sum('protein'),
                cheat_count=Count('id', filter=Q(is_cheat=True)),
            )
        )
        meal_map = {
            entry['date']: {
                'calories': float(entry['total_calories'] or 0.0),
                'protein': float(entry['total_protein'] or 0.0),
                'is_cheat': (entry['cheat_count'] or 0) > 0,
            }
            for entry in meal_aggregates
        }

        steps_aggregates = (
            StepsLog.objects.filter(user=user, date__gte=start_date, date__lte=end_date)
            .values('date')
            .annotate(total_steps=Sum('steps'))
        )
        steps_map = {
            entry['date']: int(entry['total_steps'] or 0)
            for entry in steps_aggregates
        }

        workout_aggregates = (
            WorkoutSession.objects.filter(user=user, date__gte=start_date, date__lte=end_date)
            .values('date')
            .annotate(session_count=Count('id'))
        )
        workout_map = {
            entry['date']: int(entry['session_count'] or 0)
            for entry in workout_aggregates
        }

        labels = []
        calories_data = []
        protein_data = []
        cheat_days = []
        steps_data = []
        workouts_data = []

        total_progress = 0
        target_calories = profile.daily_calorie_target or 2000

        # Assemble 7 days in chronological order
        for i in range(7):
            day = start_date + timedelta(days=i)
            labels.append(day.strftime('%a'))

            m_info = meal_map.get(day, {'calories': 0.0, 'protein': 0.0, 'is_cheat': False})
            cal = m_info['calories']
            pro = m_info['protein']
            is_cheat = m_info['is_cheat']

            calories_data.append(round(cal, 1))
            protein_data.append(round(pro, 1))
            cheat_days.append(is_cheat)

            if target_calories:
                total_progress += min(cal / target_calories, 1.0)

            steps_data.append(steps_map.get(day, 0))
            workouts_data.append(workout_map.get(day, 0))

        # Progress percent
        progress_percent = round((total_progress / 7) * 100, 1) if target_calories else 0.0

        # Strict streak (consecutive target met & no cheat, counting backwards from latest day)
        streak = 0
        for i in range(6, -1, -1):
            if calories_data[i] >= target_calories and not cheat_days[i]:
                streak += 1
            else:
                break

        # Weight metrics
        weight_progress = 0.0
        if profile.start_weight and profile.target_weight and profile.weight:
            total_w = abs(profile.start_weight - profile.target_weight)
            done_w = abs(profile.start_weight - profile.weight)
            if total_w > 0:
                weight_progress = round((done_w / total_w) * 100, 1)

        return Response(
            {
                "start_date": str(start_date),
                "end_date": str(end_date),
                "week_offset": week_offset,
                "labels": labels,
                "target_calories": target_calories,
                "target_protein": profile.daily_protein_target,
                "target_steps": profile.daily_steps_target,
                "progress_percent": progress_percent,
                "streak": streak,
                "daily_breakdown": [
                    {
                        "day": labels[idx],
                        "date": str(start_date + timedelta(days=idx)),
                        "calories": calories_data[idx],
                        "protein": protein_data[idx],
                        "is_cheat_day": cheat_days[idx],
                        "steps": steps_data[idx],
                        "workout_sessions": workouts_data[idx],
                    }
                    for idx in range(7)
                ],
                "totals": {
                    "total_calories": round(sum(calories_data), 1),
                    "avg_calories": round(sum(calories_data) / 7, 1),
                    "total_protein": round(sum(protein_data), 1),
                    "avg_protein": round(sum(protein_data) / 7, 1),
                    "total_steps": sum(steps_data),
                    "avg_steps": round(sum(steps_data) / 7, 0),
                    "total_workout_sessions": sum(workouts_data),
                    "cheat_days_count": sum(1 for c in cheat_days if c),
                },
                "weight_status": {
                    "current_weight": profile.weight,
                    "target_weight": profile.target_weight,
                    "start_weight": profile.start_weight,
                    "weight_progress_percent": min(weight_progress, 100.0),
                },
            },
            status=status.HTTP_200_OK,
        )


class MonthlyProgressView(APIView):
    """
    GET /api/v1/progress/monthly/
    Replicates Progress/views.py monthly_report (28-day 4-week window).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        profile = user.profile

        today = localdate()
        start_date = today - timedelta(days=27)

        meals = MealLog.objects.filter(user=user, date__gte=start_date, date__lte=today)
        daily_data = defaultdict(lambda: {'calories': 0.0, 'protein': 0.0, 'cheat': False})

        for m in meals:
            d = m.date
            daily_data[d]['calories'] += m.calories
            daily_data[d]['protein'] += m.protein
            if m.is_cheat:
                daily_data[d]['cheat'] = True

        all_days = []
        labels, calories, protein = [], [], []

        for i in range(28):
            day = start_date + timedelta(days=i)
            data = daily_data.get(day, {'calories': 0.0, 'protein': 0.0, 'cheat': False})
            all_days.append(data)
            labels.append(day.strftime("%d"))
            calories.append(round(data['calories'], 1))
            protein.append(round(data['protein'], 1))

        # 4-week summary
        weekly_summary = []
        total_fat_loss_days = 0
        total_cheat_days = 0
        target_calories = profile.daily_calorie_target or 2000

        for i in range(4):
            week = all_days[i*7:(i+1)*7]
            avg_cal = round(sum(d['calories'] for d in week) / 7, 1)
            avg_pro = round(sum(d['protein'] for d in week) / 7, 1)
            cheat_cnt = sum(1 for d in week if d['cheat'])
            fat_loss_cnt = sum(1 for d in week if d['calories'] <= target_calories)

            total_cheat_days += cheat_cnt
            total_fat_loss_days += fat_loss_cnt

            weekly_summary.append({
                'week': f"Week {i+1}",
                'avg_calories': avg_cal,
                'avg_protein': avg_pro,
                'cheat_days': cheat_cnt,
                'fat_loss_days': fat_loss_cnt,
            })

        consistency_days = total_fat_loss_days
        progress = int((consistency_days / 28) * 100)

        # Streak
        streak = 0
        for d in reversed(all_days):
            if d['calories'] <= target_calories and not d['cheat']:
                streak += 1
            else:
                break

        return Response(
            {
                "start_date": str(start_date),
                "end_date": str(today),
                "target_calories": target_calories,
                "weekly_summary": weekly_summary,
                "consistency_days": consistency_days,
                "total_cheat_days": total_cheat_days,
                "progress_percent": progress,
                "streak": streak,
            },
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# Task 6 — Workout Progress API
# ==============================================================================

class WorkoutProgressView(APIView):
    """
    GET /api/v1/progress/workout/
    Replicates Progress/views.py workout_progress, workout_reports, and workout_charts.
    Exposes:
    - exercise_progress: weight trends per exercise and improved flag.
    - muscle_balance: trained vs missing submuscles and balance score.
    - weekly_comparison: current week vs previous week changes.
    - volume_stats: overall volume and sets.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        week_offset = int(request.query_params.get('week_offset') or request.query_params.get('week') or 0)
        today = localdate()

        # 1. Exercise weight progression (from workout_progress)
        sets = WorkoutSet.objects.filter(
            session__user=user
        ).select_related(
            'exercise',
            'session__sub_muscle__muscle_group'
        ).order_by('session__date', 'id')

        exercise_grouped = defaultdict(lambda: defaultdict(list))
        for s in sets:
            muscle = s.session.sub_muscle.muscle_group.name
            ex_name = s.exercise.name
            exercise_grouped[muscle][ex_name].append({
                'date': str(s.session.date),
                'weight': s.weight,
                'reps': s.reps,
                'volume': round(s.reps * s.weight, 2),
            })

        exercise_progress = {}
        for muscle, ex_dict in exercise_grouped.items():
            exercise_progress[muscle] = []
            for ex_name, records in ex_dict.items():
                weights = [r['weight'] for r in records]
                improved = False
                if len(weights) >= 2:
                    improved = weights[-1] > weights[0]

                exercise_progress[muscle].append({
                    'exercise': ex_name,
                    'records': records[-5:],  # last 5 logs
                    'total_logs': len(records),
                    'start_weight': weights[0],
                    'latest_weight': weights[-1],
                    'max_weight': max(weights),
                    'improved': improved,
                })

        # 2. Weekly Balance & Comparison (from workout_reports)
        start_of_week = today - timedelta(days=today.weekday()) - timedelta(weeks=week_offset)
        end_of_week = start_of_week + timedelta(days=6)

        prev_start = start_of_week - timedelta(days=7)
        prev_end = start_of_week - timedelta(days=1)

        curr_sessions = WorkoutSession.objects.filter(
            user=user, date__range=(start_of_week, end_of_week)
        ).select_related('sub_muscle__muscle_group')

        prev_sessions = WorkoutSession.objects.filter(
            user=user, date__range=(prev_start, prev_end)
        ).select_related('sub_muscle__muscle_group')

        curr_muscles = defaultdict(int)
        curr_subs = defaultdict(int)
        prev_muscles = defaultdict(int)
        prev_subs = defaultdict(int)
        muscle_sub_map = defaultdict(set)

        for s in curr_sessions:
            m = s.sub_muscle.muscle_group.name
            sub = s.sub_muscle.name
            curr_muscles[m] += 1
            curr_subs[sub] += 1
            muscle_sub_map[m].add(sub)

        for s in prev_sessions:
            m = s.sub_muscle.muscle_group.name
            sub = s.sub_muscle.name
            prev_muscles[m] += 1
            prev_subs[sub] += 1

        # Muscle reports
        muscle_report = []
        all_muscles = set(list(curr_muscles.keys()) + list(prev_muscles.keys()))
        for m in sorted(all_muscles):
            c = curr_muscles[m]
            p = prev_muscles.get(m, 0)
            muscle_report.append({
                'muscle': m,
                'current_week': c,
                'previous_week': p,
                'change': c - p,
            })

        # Submuscle reports
        sub_report = []
        all_subs = set(list(curr_subs.keys()) + list(prev_subs.keys()))
        for sub in sorted(all_subs):
            c = curr_subs[sub]
            p = prev_subs.get(sub, 0)
            sub_report.append({
                'sub_muscle': sub,
                'current_week': c,
                'previous_week': p,
                'change': c - p,
            })

        # Balance score
        muscle_balance = {}
        for m in muscle_sub_map:
            all_subs_db = list(SubMuscle.objects.filter(muscle_group__name=m).values_list('name', flat=True))
            trained_subs = muscle_sub_map[m]
            missing = [s for s in all_subs_db if s not in trained_subs]
            balance_score = int((len(trained_subs) / len(all_subs_db)) * 100) if all_subs_db else 0
            muscle_balance[m] = {
                'trained_sub_muscles': list(trained_subs),
                'missing_sub_muscles': missing,
                'balance_score': balance_score,
            }

        return Response(
            {
                "week_range": {
                    "start_of_week": str(start_of_week),
                    "end_of_week": str(end_of_week),
                    "week_offset": week_offset,
                },
                "exercise_progress": exercise_progress,
                "weekly_muscle_report": muscle_report,
                "weekly_submuscle_report": sub_report,
                "muscle_balance": muscle_balance,
            },
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# Task 7 — Progress History and Summary
# ==============================================================================

class ProgressHistoryView(APIView):
    """
    GET /api/v1/progress/history/
    Returns chronological daily progress history over a date range.
    Supports ?start_date=YYYY-MM-DD and ?end_date=YYYY-MM-DD.
    Paginated with StandardResultsSetPagination.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        today = localdate()

        start_param = request.query_params.get('start_date')
        end_param = request.query_params.get('end_date')

        try:
            end_date = datetime.strptime(end_param.strip(), '%Y-%m-%d').date() if end_param else today
            start_date = datetime.strptime(start_param.strip(), '%Y-%m-%d').date() if start_param else (end_date - timedelta(days=29))
        except ValueError:
            return Response(
                {"detail": "Invalid date format. Expected YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if start_date > end_date:
            return Response(
                {"detail": "start_date cannot be after end_date."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Generate list of dates from end_date down to start_date
        total_days = (end_date - start_date).days + 1
        date_list = [end_date - timedelta(days=i) for i in range(total_days)]

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(date_list, request)
        target_dates = page if page is not None else date_list

        profile = user.profile
        calorie_target = profile.daily_calorie_target or 2000
        protein_target = profile.daily_protein_target or 80
        steps_goal = profile.daily_steps_target or 8000
        water_goal = profile.daily_water_goal or 3000

        # Batch queries across target_dates (5 queries instead of 180)
        meals_by_date = defaultdict(lambda: {'calories': 0.0, 'protein': 0.0})
        for m in MealLog.objects.filter(user=user, date__in=target_dates):
            meals_by_date[m.date]['calories'] += m.calories
            meals_by_date[m.date]['protein'] += m.protein

        steps_by_date = defaultdict(lambda: {'total': 0, 'count': 0})
        for s in StepsLog.objects.filter(user=user, date__in=target_dates):
            steps_by_date[s.date]['total'] += s.steps
            steps_by_date[s.date]['count'] += 1

        water_by_date = defaultdict(int)
        for w in WaterIntake.objects.filter(user=user, date__in=target_dates):
            water_by_date[w.date] += w.amount

        sessions = WorkoutSession.objects.filter(user=user, date__in=target_dates)
        sessions_by_date = defaultdict(list)
        for sess in sessions:
            sessions_by_date[sess.date].append(sess.id)

        session_ids = [sess.id for sess in sessions]
        sets_by_session = defaultdict(list)
        if session_ids:
            for wset in WorkoutSet.objects.filter(session_id__in=session_ids):
                sets_by_session[wset.session_id].append(wset)

        history_items = []
        for d in target_dates:
            total_cal = meals_by_date[d]['calories']
            total_pro = meals_by_date[d]['protein']
            cal_left = calorie_target - total_cal
            pro_left = protein_target - total_pro

            if profile.goal in ['cut', 'fat_loss']:
                if total_cal <= calorie_target:
                    day_type = "Good (Fat Loss)"
                    good_day = True
                else:
                    day_type = "Overeaten"
                    good_day = False
            else:
                if total_cal >= calorie_target:
                    day_type = "Good (Bulk)"
                    good_day = True
                else:
                    day_type = "Undereaten"
                    good_day = False

            total_st = steps_by_date[d]['total']
            st_left = max(steps_goal - total_st, 0)
            st_pct = round((total_st / steps_goal) * 100, 1) if steps_goal else 0.0

            total_wat = water_by_date[d]
            wat_left = max(water_goal - total_wat, 0)
            wat_pct = round((total_wat / water_goal) * 100, 1) if water_goal else 0.0

            d_sessions = sessions_by_date[d]
            d_sets = []
            for s_id in d_sessions:
                d_sets.extend(sets_by_session[s_id])
            d_volume = round(sum(s.reps * s.weight for s in d_sets), 2)

            history_items.append({
                "date": str(d),
                "nutrition": {
                    "total_calories": round(total_cal, 1),
                    "total_protein": round(total_pro, 1),
                    "calorie_target": calorie_target,
                    "protein_target": protein_target,
                    "calories_left": round(cal_left, 1),
                    "protein_left": round(pro_left, 1),
                    "day_type": day_type,
                    "good_day": good_day,
                },
                "steps": {
                    "total_steps": total_st,
                    "daily_steps_target": steps_goal,
                    "steps_left": st_left,
                    "steps_percent": min(st_pct, 100.0),
                    "logs_count": steps_by_date[d]['count'],
                },
                "water": {
                    "total_water_ml": total_wat,
                    "water_goal_ml": water_goal,
                    "water_left_ml": wat_left,
                    "water_percent": min(wat_pct, 100.0),
                },
                "workouts": {
                    "sessions_count": len(d_sessions),
                    "total_sets": len(d_sets),
                    "total_weight_volume": d_volume,
                },
                "points": profile.points,
            })

        if page is not None:
            return paginator.get_paginated_response(history_items)
        return Response(history_items, status=status.HTTP_200_OK)


class ProgressSummaryView(APIView):
    """
    GET /api/v1/progress/summary/
    Returns comprehensive lifetime progress dashboard summary.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        profile = user.profile

        # Nutrition stats
        meals = MealLog.objects.filter(user=user)
        total_meals = meals.count()
        total_cheat_meals = meals.filter(is_cheat=True).count()
        unique_days_tracked = meals.values('date').distinct().count()

        # Workout stats
        sessions = WorkoutSession.objects.filter(user=user)
        total_sessions = sessions.count()
        sets = WorkoutSet.objects.filter(session__user=user)
        total_sets = sets.count()
        total_volume = round(sum(s.reps * s.weight for s in sets), 2)
        distinct_exercises = sets.values('exercise_id').distinct().count()

        # Steps stats
        steps_logs = StepsLog.objects.filter(user=user)
        total_steps = steps_logs.aggregate(Sum('steps'))['steps__sum'] or 0
        step_days = steps_logs.values('date').distinct().count()
        avg_steps = round(total_steps / step_days, 0) if step_days else 0

        # Weight stats
        weight_progress = 0.0
        if profile.start_weight and profile.target_weight and profile.weight:
            total_w = abs(profile.start_weight - profile.target_weight)
            done_w = abs(profile.start_weight - profile.weight)
            if total_w > 0:
                weight_progress = round((done_w / total_w) * 100, 1)

        return Response(
            {
                "user": user.username,
                "profile": {
                    "goal": profile.goal,
                    "points": profile.points,
                    "daily_calorie_target": profile.daily_calorie_target,
                    "daily_protein_target": profile.daily_protein_target,
                    "daily_steps_target": profile.daily_steps_target,
                    "daily_water_goal": profile.daily_water_goal,
                },
                "nutrition_summary": {
                    "total_meals_logged": total_meals,
                    "total_cheat_meals": total_cheat_meals,
                    "days_tracked": unique_days_tracked,
                },
                "workout_summary": {
                    "total_sessions": total_sessions,
                    "total_sets": total_sets,
                    "total_volume_lifted": total_volume,
                    "distinct_exercises": distinct_exercises,
                },
                "steps_summary": {
                    "total_steps": total_steps,
                    "days_logged": step_days,
                    "avg_steps_per_day": avg_steps,
                },
                "weight_summary": {
                    "current_weight": profile.weight,
                    "start_weight": profile.start_weight,
                    "target_weight": profile.target_weight,
                    "height": profile.height,
                    "weight_progress_percent": min(weight_progress, 100.0),
                },
            },
            status=status.HTTP_200_OK,
        )
