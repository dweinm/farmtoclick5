import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Base URL - Change this to your Flask server URL
const API_BASE_URL = 'http://192.168.2.170:5001'; // Replace with your computer's IP address

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor to add auth token and handle FormData
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // Let axios set the correct Content-Type (with boundary) for FormData
      if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
      }
    } catch (error) {
      console.error('Error getting token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
    }
    return Promise.reject(error);
  }
);

export { api, API_BASE_URL };

// Auth API
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),
  register: (userData: any) =>
    api.post('/api/auth/register', userData),
};

// Products API
export const productsAPI = {
  getAll: () => api.get('/api/products'),
  getById: (id: string) => api.get(`/api/products/${id}`),
  // Farmer product management
  getProducts: () => api.get('/api/farmer/products'),
  addProduct: (formData: FormData) => api.post('/api/farmer/products', formData),
  updateProduct: (id: string, formData: FormData) => api.put(`/api/farmer/products/${id}`, formData),
  deleteProduct: (id: string) => api.delete(`/api/farmer/products/${id}`),
};

// Farmers API
export const farmersAPI = {
  getAll: () => api.get('/api/farmers'),
  getById: (id: string) => api.get(`/api/farmer/${id}`),
};

// User API
export const userAPI = {
  getProfile: () => api.get('/api/user/profile'),
  updateProfile: (userData: any) => api.put('/api/user/profile', userData),
  updateProfileWithFormData: (formData: FormData) => api.put('/api/user/profile', formData),
};

// Cart API
export const cartAPI = {
  getCart: () => api.get('/api/cart'),
  addToCart: (productId: string, quantity: number) => 
    api.post('/api/cart', { product_id: productId, quantity }),
  updateQuantity: (productId: string, quantity: number) => 
    api.put(`/api/cart/${productId}`, { quantity }),
  removeItem: (productId: string) => api.delete(`/api/cart/${productId}`),
  clearCart: () => api.delete('/api/cart'),
  checkout: (orderData: any) => api.post('/api/orders', orderData),
};

// Orders API
export const ordersAPI = {
  getOrders: () => api.get('/api/orders'),
  getOrderById: (id: string) => api.get(`/api/orders/${id}`),
  createOrder: (orderData: any) => api.post('/api/orders', orderData),
  updateOrderStatus: (id: string, status: string) => 
    api.put(`/api/orders/${id}/status`, { status }),
  getSellerOrders: () => api.get('/api/farmer/orders'),
  updateSellerOrderStatus: (id: string, payload: any) => 
    api.post(`/api/order/${id}/status`, payload),
  getOrderTracking: (id: string) => api.get(`/api/orders/${id}/tracking`),
};

// DTI Price API
export const dtiAPI = {
  suggestPrice: (name: string, unit?: string, category?: string) =>
    api.get('/api/dti/suggest-price', { params: { name, unit, category } }),
  suggestProductNames: (name: string, limit: number = 10) =>
    api.get('/api/dti/product-suggestions', { params: { name, limit } }),
};

// Farmer Verification API
export const verificationAPI = {
  submitVerification: (formData: FormData) => 
    api.post('/api/farmer/verify', formData),
  getVerificationStatus: () => api.get('/api/user/verification-status'),
};

// Admin API
export const adminAPI = {
  // Dashboard stats
  getDashboardStats: () => api.get('/api/admin/dashboard'),
  // Products management
  getProducts: () => api.get('/api/admin/products'),
  deleteProduct: (id: string) => api.delete(`/api/admin/products/${id}`),
  // Farmers management
  getFarmers: () => api.get('/api/admin/farmers'),
  // Orders management
  getOrders: () => api.get('/api/admin/orders'),
  // Verifications management - uses permit_verifications collection
  getVerifications: () => api.get('/api/admin/permit-verifications'),
  getVerificationDetail: (verificationId: string) => 
    api.get(`/api/admin/permit-verifications/${verificationId}`),
  approveVerification: (verificationId: string) => 
    api.put(`/api/admin/permit-verifications/${verificationId}`, { status: 'verified' }),
  rejectVerification: (verificationId: string, reason: string) => 
    api.put(`/api/admin/permit-verifications/${verificationId}`, { status: 'rejected', admin_notes: reason }),
  // Reports
  getReports: (days: number = 30) => api.get(`/api/admin/reports?days=${days}`),
  // Users
  getUsers: () => api.get('/api/admin/users'),
  updateUserRole: (userId: string, role: string) => 
    api.put(`/api/admin/users/${userId}/role`, { role }),
};

export default api;