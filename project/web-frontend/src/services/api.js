import axios from 'axios';

// Use relative URLs so React dev server proxy (package.json "proxy") forwards to backend
// This avoids all CORS issues regardless of which port the frontend runs on
const API_BASE_URL = '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token and handle FormData
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Let axios set the correct Content-Type (with boundary) for FormData
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only auto-logout on 401 for non-auth endpoints (don't clear on login/register failures)
    const url = error.config?.url || '';
    if (error.response?.status === 401 && !url.includes('/api/auth/')) {
      localStorage.removeItem('userToken');
      localStorage.removeItem('userData');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  register: (userData) => api.post('/api/auth/register', userData),
  updateProfile: (userData) => api.put('/api/user/profile', userData),
};

export const productsAPI = {
  getAll: () => api.get('/api/products'),
  getById: (id) => api.get(`/api/products/${id}`),
  getProducts: () => api.get('/api/farmer/products'),
  getCovendors: () => api.get('/api/products/covendors'),
  addProduct: (formData) => api.post('/api/farmer/products', formData),
  updateProduct: (id, formData) => api.put(`/api/farmer/products/${id}`, formData),
  deleteProduct: (id) => api.delete(`/api/farmer/products/${id}`),
};

export const farmersAPI = {
  getAll: () => api.get('/api/farmers'),
  getById: (id) => api.get(`/api/farmer/${id}`),
};

export const userAPI = {
  getProfile: () => api.get('/api/user/profile'),
  updateProfile: (userData) => api.put('/api/user/profile', userData),
};

export const notificationsAPI = {
  getNotifications: () => api.get('/api/user/notifications'),
  markAsRead: (id) => api.post(`/api/user/notifications/${id}/read`),
};

export const cartAPI = {
  getCart: () => api.get('/api/cart'),
  addToCart: (productId, quantity) => api.post('/api/cart', { product_id: productId, quantity }),
  updateQuantity: (productId, quantity) => api.put(`/api/cart/${productId}`, { quantity }),
  removeItem: (productId) => api.delete(`/api/cart/${productId}`),
  updateCartItem: (productId, quantity) => api.put(`/api/cart/${productId}`, { quantity }),
  removeFromCart: (productId) => api.delete(`/api/cart/${productId}`),
  clearCart: () => api.delete('/api/cart'),
  checkout: (orderData) => api.post('/api/orders', orderData),
};

export const ordersAPI = {
  getOrders: () => api.get('/api/orders'),
  getOrderById: (id) => api.get(`/api/orders/${id}`),
  createOrder: (orderData) => api.post('/api/orders', orderData),
  updateOrderStatus: (id, status) => api.put(`/api/orders/${id}/status`, { status }),
  getSellerOrders: () => api.get('/api/farmer/orders'),
  updateSellerOrderStatus: (id, payload) => api.post(`/api/order/${id}/status`, payload),
  getOrderTracking: (id) => api.get(`/api/orders/${id}/tracking`),
  assignRider: (id, payload) => api.post(`/api/orders/${id}/assign-rider`, payload),
  getRiderOrders: () => api.get('/api/rider/orders'),
  updateRiderOrderStatus: (id, payload) => api.post(`/api/rider/orders/${id}/status`, payload),
  confirmPaymongo: (orderId) => api.post('/api/paymongo/confirm', { order_id: orderId }),
};

export const ridersAPI = {
  getActive: () => api.get('/api/riders'),
  getAdminRiders: () => api.get('/api/admin/riders'),
  createAdminRider: (payload) => api.post('/api/admin/riders', payload),
  updateAdminRider: (id, payload) => api.put(`/api/admin/riders/${id}`, payload),
  deleteAdminRider: (id) => api.delete(`/api/admin/riders/${id}`),
};

export const dtiAPI = {
  suggestPrice: (name, unit, category, audience) => api.get('/api/dti/suggest-price', { params: { name, unit, category, audience } }),
  suggestProductNames: (name, limit = 10) =>
    api.get('/api/dti/product-suggestions', { params: { name, limit } }),
  getPrices: () => api.get('/api/dti/prices'),
  uploadPdf: (formData) => api.post('/api/dti/upload-pdf', formData),
  // Bulk delete DTI records (Admin only). body: { record_ids: [...], delete_all: bool }
  bulkDelete: (recordIds, deleteAll = false) =>
    api.post('/api/dti/records/bulk-delete', { record_ids: recordIds, delete_all: deleteAll }),
};

export default api;