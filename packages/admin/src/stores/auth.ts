import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'));
  const user = ref<any | null>(null);
  const tenantId = ref<string | null>(localStorage.getItem('tenantId'));

  const isAuthenticated = computed(() => !!token.value);

  async function login(email: string, password: string) {
    const response = await authApi.login(email, password);
    const { token: newToken, user: userData } = response.data;
    
    token.value = newToken;
    user.value = userData;
    localStorage.setItem('token', newToken);
    
    return response.data;
  }

  async function register(email: string, password: string, name: string) {
    const response = await authApi.register(email, password, name);
    return response.data;
  }

  async function fetchUser() {
    try {
      const response = await authApi.me();
      user.value = response.data;
    } catch (error) {
      logout();
    }
  }

  function logout() {
    token.value = null;
    user.value = null;
    tenantId.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('tenantId');
  }

  return {
    token,
    user,
    tenantId,
    isAuthenticated,
    login,
    register,
    fetchUser,
    logout,
  };
});
