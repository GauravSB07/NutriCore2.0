import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PhoneLayout from './layouts/PhoneLayout';
import AdminLayout from './layouts/AdminLayout';
import ProtectedRoute from './components/common/ProtectedRoute';
import AdminRoute from './components/common/AdminRoute';
import PublicRoute from './components/common/PublicRoute';

// Lazy-loaded pages for route-based code splitting
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const WelcomePage = lazy(() => import('./pages/WelcomePage'));
const HomePage = lazy(() => import('./pages/dashboard/HomePage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const EditProfilePage = lazy(() => import('./pages/profile/EditProfilePage'));
const FoodListPage = lazy(() => import('./pages/nutrition/FoodListPage'));
const FoodDetailPage = lazy(() => import('./pages/nutrition/FoodDetailPage'));
const LogMealPage = lazy(() => import('./pages/nutrition/LogMealPage'));
const MealListPage = lazy(() => import('./pages/nutrition/MealListPage'));
const WaterPage = lazy(() => import('./pages/nutrition/WaterPage'));
const CheatMealPage = lazy(() => import('./pages/nutrition/CheatMealPage'));
const StartWorkoutPage = lazy(() => import('./pages/workouts/StartWorkoutPage'));
const ChooseSubPage = lazy(() => import('./pages/workouts/ChooseSubPage'));
const ChooseExercisePage = lazy(() => import('./pages/workouts/ChooseExercisePage'));
const ExerciseDetailPage = lazy(() => import('./pages/workouts/ExerciseDetailPage'));
const LogSetsPage = lazy(() => import('./pages/workouts/LogSetsPage'));
const WorkoutHistoryPage = lazy(() => import('./pages/workouts/WorkoutHistoryPage'));
const ProgressDashboardPage = lazy(() => import('./pages/progress/ProgressDashboardPage'));
const DailyReportPage = lazy(() => import('./pages/progress/DailyReportPage'));
const LogStepsPage = lazy(() => import('./pages/progress/LogStepsPage'));
const WeeklyReportPage = lazy(() => import('./pages/progress/WeeklyReportPage'));
const MonthlyReportPage = lazy(() => import('./pages/progress/MonthlyReportPage'));
const WorkoutProgressPage = lazy(() => import('./pages/progress/WorkoutProgressPage'));
const WorkoutReportsPage = lazy(() => import('./pages/progress/WorkoutReportsPage'));
const WorkoutChartsPage = lazy(() => import('./pages/progress/WorkoutChartsPage'));
const WeightTrackingPage = lazy(() => import('./pages/progress/WeightTrackingPage'));
const RecipeListPage = lazy(() => import('./pages/recipes/RecipeListPage'));
const RecipeDetailPage = lazy(() => import('./pages/recipes/RecipeDetailPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminProfilesPage = lazy(() => import('./pages/admin/AdminProfilesPage'));
const AdminCategoriesPage = lazy(() => import('./pages/admin/AdminCategoriesPage'));
const AdminFoodsPage = lazy(() => import('./pages/admin/AdminFoodsPage'));
const AdminExercisesPage = lazy(() => import('./pages/admin/AdminExercisesPage'));
const AdminMusclesPage = lazy(() => import('./pages/admin/AdminMusclesPage'));
const AdminSubMusclesPage = lazy(() => import('./pages/admin/AdminSubMusclesPage'));
const AdminRecipesPage = lazy(() => import('./pages/admin/AdminRecipesPage'));
const AdminRecipeCategoriesPage = lazy(() => import('./pages/admin/AdminRecipeCategoriesPage'));
const AdminMealLogsPage = lazy(() => import('./pages/admin/AdminMealLogsPage'));
const TestPage = lazy(() => import('./pages/TestPage'));

const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center p-6 text-[#7c3aed]">
    <div className="w-8 h-8 border-3 border-[#7c3aed] border-t-transparent rounded-full animate-spin"></div>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public authentication routes */}
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
            </Route>

            {/* Protected authenticated routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/welcome" element={<WelcomePage />} />
              <Route path="/" element={<PhoneLayout />}>
                <Route index element={<HomePage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="profile/edit" element={<EditProfilePage />} />

                {/* Nutrition Module Routes */}
                <Route path="nutrition/foods" element={<FoodListPage />} />
                <Route path="nutrition/foods/:id" element={<FoodDetailPage />} />
                <Route path="nutrition/meals" element={<MealListPage />} />
                <Route path="nutrition/log" element={<LogMealPage />} />
                <Route path="nutrition/meals/:id/edit" element={<LogMealPage />} />
                <Route path="nutrition/water" element={<WaterPage />} />
                <Route path="nutrition/cheat" element={<CheatMealPage />} />
                <Route path="nutrition/cheat/:foodId" element={<CheatMealPage />} />

                {/* Workout Module Routes */}
                <Route path="workouts" element={<Navigate to="/workouts/start" replace />} />
                <Route path="workouts/start" element={<StartWorkoutPage />} />
                <Route path="workouts/start/:muscleId" element={<ChooseSubPage />} />
                <Route path="workouts/start/sub/:subId" element={<ChooseExercisePage />} />
                <Route path="workouts/exercises/:id" element={<ExerciseDetailPage />} />
                <Route path="workouts/log/:sessionId" element={<LogSetsPage />} />
                <Route path="workouts/history" element={<WorkoutHistoryPage />} />
                <Route path="workouts/library" element={<StartWorkoutPage />} />

                {/* Progress Module Routes */}
                <Route path="progress" element={<ProgressDashboardPage />} />
                <Route path="progress/daily" element={<DailyReportPage />} />
                <Route path="progress/steps" element={<LogStepsPage />} />
                <Route path="progress/weight" element={<WeightTrackingPage />} />
                <Route path="progress/weekly" element={<WeeklyReportPage />} />
                <Route path="progress/monthly" element={<MonthlyReportPage />} />
                <Route path="progress/workout" element={<WorkoutProgressPage />} />
                <Route path="progress/muscle-reports" element={<WorkoutReportsPage />} />
                <Route path="progress/workout-charts" element={<WorkoutChartsPage />} />

                {/* Backward-compatibility / Reports aliases */}
                <Route path="reports/daily" element={<DailyReportPage />} />
                <Route path="reports/weekly" element={<WeeklyReportPage />} />
                <Route path="reports/monthly" element={<MonthlyReportPage />} />

                {/* Recipe Module Routes */}
                <Route path="recipes" element={<RecipeListPage />} />
                <Route path="recipes/:id" element={<RecipeDetailPage />} />

                <Route path="test" element={<TestPage />} />
              </Route>
            </Route>

            {/* Protected admin routes (superuser only) */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboardPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="profiles" element={<AdminProfilesPage />} />
                <Route path="categories" element={<AdminCategoriesPage />} />
                <Route path="foods" element={<AdminFoodsPage />} />
                <Route path="meals" element={<AdminMealLogsPage />} />
                <Route path="recipes" element={<AdminRecipesPage />} />
                <Route path="recipe-categories" element={<AdminRecipeCategoriesPage />} />
                <Route path="exercises" element={<AdminExercisesPage />} />
                <Route path="muscles" element={<AdminMusclesPage />} />
                <Route path="submuscles" element={<AdminSubMusclesPage />} />
              </Route>
            </Route>

            {/* Catch-all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
