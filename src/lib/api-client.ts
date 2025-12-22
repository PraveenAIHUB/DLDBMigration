const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken() {
    return this.token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async get(endpoint: string) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete(endpoint: string) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  auth = {
    adminLogin: async (email: string, password: string) => {
      const result = await this.post('/auth/admin/login', { email, password });
      if (result.session?.access_token) {
        this.setToken(result.session.access_token);
      }
      return result;
    },

    businessLogin: async (email: string, password: string) => {
      const result = await this.post('/auth/business/login', { email, password });
      if (result.session?.access_token) {
        this.setToken(result.session.access_token);
      }
      return result;
    },

    userLogin: async (email: string, password: string) => {
      const result = await this.post('/auth/user/login', { email, password });
      if (result.session?.access_token) {
        this.setToken(result.session.access_token);
      }
      return result;
    },

    userSignUp: async (userData: any) => {
      return this.post('/auth/user/signup', userData);
    },

    resetPassword: async (email: string, newPassword: string) => {
      return this.post('/auth/user/reset-password', { email, newPassword });
    },

    signOut: () => {
      this.setToken(null);
      return Promise.resolve();
    },
  };

  cars = {
    list: async (params?: { lotId?: string; status?: string }) => {
      const query = new URLSearchParams(params as any).toString();
      return this.get(`/cars${query ? `?${query}` : ''}`);
    },

    get: async (id: string) => {
      return this.get(`/cars/${id}`);
    },

    create: async (carData: any) => {
      return this.post('/cars', carData);
    },

    update: async (id: string, carData: any) => {
      return this.put(`/cars/${id}`, carData);
    },

    delete: async (id: string) => {
      return this.delete(`/cars/${id}`);
    },

    bulkCreate: async (cars: any[]) => {
      return this.post('/cars/bulk', { cars });
    },
  };

  bids = {
    list: async (carId?: string) => {
      const query = carId ? `?carId=${carId}` : '';
      return this.get(`/bids${query}`);
    },

    create: async (carId: string, amount: number) => {
      return this.post('/bids', { carId, amount });
    },

    update: async (id: string, amount: number) => {
      return this.put(`/bids/${id}`, { amount });
    },

    delete: async (id: string) => {
      return this.delete(`/bids/${id}`);
    },

    markWinner: async (id: string) => {
      return this.put(`/bids/${id}/winner`, {});
    },
  };

  lots = {
    list: async () => {
      return this.get('/lots');
    },

    get: async (id: string) => {
      return this.get(`/lots/${id}`);
    },

    create: async (lotData: any) => {
      return this.post('/lots', lotData);
    },

    update: async (id: string, lotData: any) => {
      return this.put(`/lots/${id}`, lotData);
    },

    approve: async (id: string) => {
      return this.put(`/lots/${id}/approve`, {});
    },

    close: async (id: string) => {
      return this.put(`/lots/${id}/close`, {});
    },

    delete: async (id: string) => {
      return this.delete(`/lots/${id}`);
    },
  };

  users = {
    list: async (params?: { role?: string; approved?: boolean }) => {
      const query = new URLSearchParams(params as any).toString();
      return this.get(`/users${query ? `?${query}` : ''}`);
    },

    getMe: async () => {
      return this.get('/users/me');
    },

    updateMe: async (userData: any) => {
      return this.put('/users/me', userData);
    },

    approve: async (id: string) => {
      return this.put(`/users/${id}/approve`, {});
    },

    reject: async (id: string) => {
      return this.put(`/users/${id}/reject`, {});
    },

    delete: async (id: string) => {
      return this.delete(`/users/${id}`);
    },
  };

  admin = {
    getMe: async () => {
      return this.get('/admin/me');
    },

    create: async (adminData: any) => {
      return this.post('/admin/create', adminData);
    },
  };

  business = {
    list: async () => {
      return this.get('/business');
    },

    getMe: async () => {
      return this.get('/business/me');
    },

    create: async (businessUserData: any) => {
      return this.post('/business', businessUserData);
    },

    update: async (id: string, businessUserData: any) => {
      return this.put(`/business/${id}`, businessUserData);
    },

    delete: async (id: string) => {
      return this.delete(`/business/${id}`);
    },
  };

  questions = {
    list: async (params?: { lotId?: string; carId?: string }) => {
      const query = new URLSearchParams(params as any).toString();
      return this.get(`/questions${query ? `?${query}` : ''}`);
    },

    create: async (questionData: any) => {
      return this.post('/questions', questionData);
    },

    answer: async (id: string, answerText: string) => {
      return this.put(`/questions/${id}/answer`, { answerText });
    },

    delete: async (id: string) => {
      return this.delete(`/questions/${id}`);
    },
  };

  terms = {
    list: async () => {
      return this.get('/terms');
    },

    getLatest: async () => {
      return this.get('/terms/latest');
    },

    create: async (termsData: any) => {
      return this.post('/terms', termsData);
    },
  };

  otp = {
    send: async (email: string, phone: string, method: 'email' | 'mobile') => {
      return this.post('/otp/send', { email, phone, method });
    },

    verify: async (email: string, phone: string, otpCode: string) => {
      return this.post('/otp/verify', { email, phone, otpCode });
    },
  };
}

export const apiClient = new ApiClient();
