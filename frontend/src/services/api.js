import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// In-memory token management
let inMemoryAccessToken = null;
let inMemoryRefreshToken = null;

export const setTokens = ({ access, refresh }) => {
  if (access !== undefined) inMemoryAccessToken = access;
  if (refresh !== undefined) inMemoryRefreshToken = refresh;
};

export const getAccessToken = () => inMemoryAccessToken;
export const getRefreshToken = () => inMemoryRefreshToken;

export const clearTokens = () => {
  inMemoryAccessToken = null;
  inMemoryRefreshToken = null;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach in-memory access token
api.interceptors.request.use(
  (config) => {
    if (inMemoryAccessToken) {
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Concurrency queue to prevent multiple simultaneous refresh calls
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor: handle 401 with queued token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Do not attempt refresh on auth endpoints or already retried requests
    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login/') ||
      originalRequest?.url?.includes('/auth/register/') ||
      originalRequest?.url?.includes('/auth/token/refresh/');

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // Queue this request until current refresh finishes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const payload = inMemoryRefreshToken ? { refresh: inMemoryRefreshToken } : {};
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/auth/token/refresh/`,
          payload,
          { withCredentials: true }
        );

        const newAccessToken = refreshResponse.data.access;
        inMemoryAccessToken = newAccessToken;

        // If backend returns a new rotated refresh token
        if (refreshResponse.data.refresh) {
          inMemoryRefreshToken = refreshResponse.data.refresh;
        }

        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearTokens();
        window.dispatchEvent(new CustomEvent('nutricore:auth:unauthorized'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Authentication service helpers
export const authService = {
  login: async (username, password) => {
    const response = await api.post('/auth/login/', { username, password });
    if (response.data.tokens) {
      setTokens({
        access: response.data.tokens.access,
        refresh: response.data.tokens.refresh,
      });
    }
    return response.data;
  },

  register: async ({ username, email, password, password_confirm }) => {
    const response = await api.post('/auth/register/', {
      username,
      email,
      password,
      password_confirm,
      password2: password_confirm,
    });
    if (response.data.tokens) {
      setTokens({
        access: response.data.tokens.access,
        refresh: response.data.tokens.refresh,
      });
    }
    return response.data;
  },

  logout: async () => {
    const refresh = getRefreshToken();
    try {
      await api.post('/auth/logout/', refresh ? { refresh } : {});
    } catch {
      // Ignore network errors during logout
    } finally {
      clearTokens();
    }
  },

  getMe: async () => {
    const response = await api.get('/auth/me/');
    return response.data;
  },

  updateMe: async (data, isMultipart = false) => {
    const config = isMultipart
      ? { headers: { 'Content-Type': 'multipart/form-data' } }
      : {};
    const response = await api.patch('/auth/me/', data, config);
    return response.data;
  },

  refreshToken: async (token) => {
    const refresh = token || getRefreshToken();
    const response = await axios.post(
      `${API_BASE_URL}/auth/token/refresh/`,
      refresh ? { refresh } : {},
      { withCredentials: true }
    );
    if (response.data.access) {
      setTokens({
        access: response.data.access,
        refresh: response.data.refresh || refresh,
      });
    }
    return response.data;
  },
};

// Dashboard and metrics service helpers
export const dashboardService = {
  getNutritionSummary: async (date = null) => {
    const params = date ? { date } : {};
    const response = await api.get('/nutrition/summary/', { params });
    return response.data;
  },

  getProgressDaily: async (date = null) => {
    const params = date ? { date } : {};
    const response = await api.get('/progress/daily/', { params });
    return response.data;
  },

  getProgressSummary: async () => {
    const response = await api.get('/progress/summary/');
    return response.data;
  },

  getCheatStatus: async (date = null) => {
    const params = date ? { date } : {};
    const response = await api.get('/nutrition/cheat/status/', { params });
    return response.data;
  },
};

// Nutrition service helpers
export const nutritionService = {
  getCategories: async () => {
    const response = await api.get('/nutrition/categories/');
    return response.data;
  },

  getFoods: async (params = {}) => {
    const response = await api.get('/nutrition/foods/', { params });
    return response.data;
  },

  getFoodDetail: async (id) => {
    const response = await api.get(`/nutrition/foods/${id}/`);
    return response.data;
  },

  getMeals: async (params = {}) => {
    const response = await api.get('/nutrition/meals/', { params });
    return response.data;
  },

  getMealDetail: async (id) => {
    const response = await api.get(`/nutrition/meals/${id}/`);
    return response.data;
  },

  logMeal: async (data) => {
    const response = await api.post('/nutrition/meals/', data);
    return response.data;
  },

  updateMeal: async (id, data) => {
    const response = await api.patch(`/nutrition/meals/${id}/`, data);
    return response.data;
  },

  deleteMeal: async (id) => {
    const response = await api.delete(`/nutrition/meals/${id}/`);
    return response.data;
  },

  getSummary: async (date = null) => {
    const params = date ? { date } : {};
    const response = await api.get('/nutrition/summary/', { params });
    return response.data;
  },

  getWater: async (date = null) => {
    const params = date ? { date } : {};
    const response = await api.get('/nutrition/water/', { params });
    return response.data;
  },

  logWater: async (amount, date = null) => {
    const payload = { amount: parseFloat(amount) };
    if (date) payload.date = date;
    const response = await api.post('/nutrition/water/', payload);
    return response.data;
  },

  deleteWater: async (id) => {
    const response = await api.delete(`/nutrition/water/${id}/`);
    return response.data;
  },

  getCheatStatus: async (date = null) => {
    const params = date ? { date } : {};
    const response = await api.get('/nutrition/cheat/status/', { params });
    return response.data;
  },

  logCheatMeal: async (data) => {
    const response = await api.post('/nutrition/cheat/', data);
    return response.data;
  },
};

// Workout service helpers
export const workoutService = {
  getMuscles: async () => {
    const response = await api.get('/workouts/muscles/');
    return response.data;
  },

  getMuscleDetail: async (id) => {
    const response = await api.get(`/workouts/muscles/${id}/`);
    return response.data;
  },

  getSubMuscles: async (muscleId = null) => {
    const params = muscleId ? { muscle: muscleId } : {};
    const response = await api.get('/workouts/submuscles/', { params });
    return response.data;
  },

  getSubMuscleDetail: async (id) => {
    const response = await api.get(`/workouts/submuscles/${id}/`);
    return response.data;
  },

  getExercises: async (params = {}) => {
    const response = await api.get('/workouts/exercises/', { params });
    return response.data;
  },

  getExerciseDetail: async (id) => {
    const response = await api.get(`/workouts/exercises/${id}/`);
    return response.data;
  },

  getSessions: async (params = {}) => {
    const response = await api.get('/workouts/sessions/', { params });
    return response.data;
  },

  createSession: async (data) => {
    const response = await api.post('/workouts/sessions/', data);
    return response.data;
  },

  getSessionDetail: async (id) => {
    const response = await api.get(`/workouts/sessions/${id}/`);
    return response.data;
  },

  deleteSession: async (id) => {
    const response = await api.delete(`/workouts/sessions/${id}/`);
    return response.data;
  },

  getSessionSets: async (sessionId) => {
    const response = await api.get(`/workouts/sessions/${sessionId}/sets/`);
    return response.data;
  },

  logSet: async (sessionId, data) => {
    const response = await api.post(`/workouts/sessions/${sessionId}/sets/`, data);
    return response.data;
  },

  updateSet: async (setId, data) => {
    const response = await api.patch(`/workouts/sets/${setId}/`, data);
    return response.data;
  },

  deleteSet: async (setId) => {
    const response = await api.delete(`/workouts/sets/${setId}/`);
    return response.data;
  },

  getHistory: async (params = {}) => {
    const response = await api.get('/workouts/history/', { params });
    return response.data;
  },

  getSummary: async (date = null) => {
    const params = date ? { date } : {};
    const response = await api.get('/workouts/summary/', { params });
    return response.data;
  },
};

// Progress service helpers
export const progressService = {
  // Daily Progress Endpoints
  getDailyProgress: async (date = null) => {
    const params = date ? { date } : {};
    const response = await api.get('/progress/daily/', { params });
    return response.data;
  },

  createDailyProgress: async (data) => {
    const response = await api.post('/progress/daily/', data);
    return response.data;
  },

  getDailyProgressDetail: async (id) => {
    const response = await api.get(`/progress/daily/${id}/`);
    return response.data;
  },

  updateDailyProgress: async (id, data) => {
    const response = await api.patch(`/progress/daily/${id}/`, data);
    return response.data;
  },

  deleteDailyProgress: async (id) => {
    const response = await api.delete(`/progress/daily/${id}/`);
    return response.data;
  },

  // Steps Tracking Endpoints
  getSteps: async (params = {}) => {
    const response = await api.get('/progress/steps/', { params });
    return response.data;
  },

  logSteps: async (stepsData) => {
    const payload = typeof stepsData === 'number' ? { steps: stepsData } : stepsData;
    const response = await api.post('/progress/steps/', payload);
    return response.data;
  },

  getStepsDetail: async (id) => {
    const response = await api.get(`/progress/steps/${id}/`);
    return response.data;
  },

  updateSteps: async (id, data) => {
    const response = await api.patch(`/progress/steps/${id}/`, data);
    return response.data;
  },

  deleteSteps: async (id) => {
    const response = await api.delete(`/progress/steps/${id}/`);
    return response.data;
  },

  // Weight Tracking Endpoints
  getWeight: async () => {
    const response = await api.get('/progress/weight/');
    return response.data;
  },

  updateWeight: async (data) => {
    const response = await api.patch('/progress/weight/', data);
    return response.data;
  },

  deleteWeight: async () => {
    const response = await api.delete('/progress/weight/');
    return response.data;
  },

  // Weekly and Monthly Reports
  getWeeklyReport: async (params = {}) => {
    const queryParams = typeof params === 'string' ? { date: params } : params;
    const response = await api.get('/progress/weekly/', { params: queryParams });
    return response.data;
  },

  getMonthlyReport: async (params = {}) => {
    const queryParams = typeof params === 'string' ? { date: params } : params;
    const response = await api.get('/progress/monthly/', { params: queryParams });
    return response.data;
  },

  // Workout Progress, Reports & Charts
  getWorkoutProgress: async (params = {}) => {
    const queryParams = typeof params === 'number' ? { week: params } : params;
    const response = await api.get('/progress/workout/', { params: queryParams });
    return response.data;
  },

  // Progress History & Lifetime Summary
  getHistory: async (params = {}) => {
    const response = await api.get('/progress/history/', { params });
    return response.data;
  },

  getSummary: async () => {
    const response = await api.get('/progress/summary/');
    return response.data;
  },
};

// Recipe service helpers
export const recipeService = {
  // Public Recipe Endpoints
  getRecipes: async (params = {}) => {
    const response = await api.get('/recipes/', { params });
    return response.data;
  },

  getRecipeDetail: async (id) => {
    const response = await api.get(`/recipes/${id}/`);
    return response.data;
  },

  getCategories: async () => {
    const response = await api.get('/recipes/categories/');
    return response.data;
  },

  getCategoryDetail: async (id) => {
    const response = await api.get(`/recipes/categories/${id}/`);
    return response.data;
  },

  // Admin Management Endpoints
  createRecipe: async (data) => {
    const response = await api.post('/recipes/', data);
    return response.data;
  },

  updateRecipe: async (id, data) => {
    const response = await api.patch(`/recipes/${id}/`, data);
    return response.data;
  },

  deleteRecipe: async (id) => {
    const response = await api.delete(`/recipes/${id}/`);
    return response.data;
  },

  createCategory: async (data) => {
    const response = await api.post('/recipes/categories/', data);
    return response.data;
  },

  updateCategory: async (id, data) => {
    const response = await api.patch(`/recipes/categories/${id}/`, data);
    return response.data;
  },

  deleteCategory: async (id) => {
    const response = await api.delete(`/recipes/categories/${id}/`);
    return response.data;
  },
};

// Admin Service Helpers (for superuser Control Panel)
export const adminService = {
  // Dashboard
  getDashboard: async () => {
    const response = await api.get('/admin/dashboard/');
    return response.data;
  },

  // Users
  getUsers: async (params = {}) => {
    const response = await api.get('/admin/users/', { params });
    return response.data;
  },

  getUserDetail: async (id) => {
    const response = await api.get(`/admin/users/${id}/`);
    return response.data;
  },

  createUser: async (data) => {
    const response = await api.post('/admin/users/', data);
    return response.data;
  },

  updateUser: async (id, data) => {
    const response = await api.patch(`/admin/users/${id}/`, data);
    return response.data;
  },

  deleteUser: async (id) => {
    const response = await api.delete(`/admin/users/${id}/`);
    return response.data;
  },

  // Profiles
  getProfiles: async (params = {}) => {
    const response = await api.get('/admin/profiles/', { params });
    return response.data;
  },

  getProfileDetail: async (id) => {
    const response = await api.get(`/admin/profiles/${id}/`);
    return response.data;
  },

  updateProfile: async (id, data, isMultipart = false) => {
    const config = isMultipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const response = await api.patch(`/admin/profiles/${id}/`, data, config);
    return response.data;
  },

  // Global Meal Logs
  getMealLogs: async (params = {}) => {
    const response = await api.get('/admin/meals/', { params });
    return response.data;
  },

  deleteMealLog: async (id) => {
    const response = await api.delete(`/admin/meals/${id}/`);
    return response.data;
  },

  // Food & Categories Management
  getFoods: async (params = {}) => {
    const response = await api.get('/nutrition/foods/', { params });
    return response.data;
  },

  getFoodDetail: async (id) => {
    const response = await api.get(`/nutrition/foods/${id}/`);
    return response.data;
  },

  createFood: async (data, isMultipart = false) => {
    const config = isMultipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const response = await api.post('/nutrition/foods/', data, config);
    return response.data;
  },

  updateFood: async (id, data, isMultipart = false) => {
    const config = isMultipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const response = await api.patch(`/nutrition/foods/${id}/`, data, config);
    return response.data;
  },

  deleteFood: async (id) => {
    const response = await api.delete(`/nutrition/foods/${id}/`);
    return response.data;
  },

  getCategories: async () => {
    const response = await api.get('/nutrition/categories/');
    return response.data;
  },

  createCategory: async (data) => {
    const response = await api.post('/nutrition/categories/', data);
    return response.data;
  },

  updateCategory: async (id, data) => {
    const response = await api.patch(`/nutrition/categories/${id}/`, data);
    return response.data;
  },

  deleteCategory: async (id) => {
    const response = await api.delete(`/nutrition/categories/${id}/`);
    return response.data;
  },

  // Workouts Management
  getExercises: async (params = {}) => {
    const response = await api.get('/workouts/exercises/', { params });
    return response.data;
  },

  getExerciseDetail: async (id) => {
    const response = await api.get(`/workouts/exercises/${id}/`);
    return response.data;
  },

  createExercise: async (data, isMultipart = false) => {
    const config = isMultipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const response = await api.post('/workouts/exercises/', data, config);
    return response.data;
  },

  updateExercise: async (id, data, isMultipart = false) => {
    const config = isMultipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const response = await api.patch(`/workouts/exercises/${id}/`, data, config);
    return response.data;
  },

  deleteExercise: async (id) => {
    const response = await api.delete(`/workouts/exercises/${id}/`);
    return response.data;
  },

  getMuscleGroups: async () => {
    const response = await api.get('/workouts/muscles/');
    return response.data;
  },

  createMuscleGroup: async (data, isMultipart = false) => {
    const config = isMultipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const response = await api.post('/workouts/muscles/', data, config);
    return response.data;
  },

  updateMuscleGroup: async (id, data, isMultipart = false) => {
    const config = isMultipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const response = await api.patch(`/workouts/muscles/${id}/`, data, config);
    return response.data;
  },

  deleteMuscleGroup: async (id) => {
    const response = await api.delete(`/workouts/muscles/${id}/`);
    return response.data;
  },

  getSubMuscles: async (muscleId = null) => {
    const params = muscleId ? { muscle: muscleId } : {};
    const response = await api.get('/workouts/submuscles/', { params });
    return response.data;
  },

  createSubMuscle: async (data) => {
    const response = await api.post('/workouts/submuscles/', data);
    return response.data;
  },

  updateSubMuscle: async (id, data) => {
    const response = await api.patch(`/workouts/submuscles/${id}/`, data);
    return response.data;
  },

  deleteSubMuscle: async (id) => {
    const response = await api.delete(`/workouts/submuscles/${id}/`);
    return response.data;
  },

  // Recipes Management
  getRecipes: async (params = {}) => {
    const response = await api.get('/recipes/', { params });
    return response.data;
  },

  getRecipeDetail: async (id) => {
    const response = await api.get(`/recipes/${id}/`);
    return response.data;
  },

  createRecipe: async (data, isMultipart = false) => {
    const config = isMultipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const response = await api.post('/recipes/', data, config);
    return response.data;
  },

  updateRecipe: async (id, data, isMultipart = false) => {
    const config = isMultipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const response = await api.patch(`/recipes/${id}/`, data, config);
    return response.data;
  },

  deleteRecipe: async (id) => {
    const response = await api.delete(`/recipes/${id}/`);
    return response.data;
  },

  getRecipeCategories: async () => {
    const response = await api.get('/recipes/categories/');
    return response.data;
  },

  createRecipeCategory: async (data) => {
    const response = await api.post('/recipes/categories/', data);
    return response.data;
  },

  updateRecipeCategory: async (id, data) => {
    const response = await api.patch(`/recipes/categories/${id}/`, data);
    return response.data;
  },

  deleteRecipeCategory: async (id) => {
    const response = await api.delete(`/recipes/categories/${id}/`);
    return response.data;
  },
};

export default api;


