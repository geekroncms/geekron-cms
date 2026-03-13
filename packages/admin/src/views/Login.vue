<template>
  <div class="login-page">
    <div class="login-container">
      <h1 data-testid="page-title">
        Geekron CMS
      </h1>
      <p class="subtitle">
        管理后台
      </p>

      <form
        class="login-form"
        @submit.prevent="handleLogin"
      >
        <div class="form-group">
          <label for="email">邮箱</label>
          <input
            id="email"
            v-model="email"
            type="email"
            name="email"
            required
            data-testid="email-input"
            placeholder="admin@example.com"
          >
        </div>
        <div class="form-group">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="password"
            type="password"
            name="password"
            required
            data-testid="password-input"
            placeholder="password123"
          >
        </div>
        <button
          type="submit"
          class="btn btn-primary"
          data-testid="login-btn"
        >
          登录
        </button>
      </form>

      <div
        v-if="error"
        class="error-message"
        data-testid="error-message"
      >
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import api from '@/api'

const router = useRouter()
const email = ref('admin@example.com')
const password = ref('password123')
const error = ref('')

const handleLogin = async () => {
  try {
    const response = await api.post('/auth/login', {
      email: email.value,
      password: password.value,
    })

    // 保存 token
    localStorage.setItem('token', response.data.token)
    localStorage.setItem('userRole', response.data.user?.role || 'user')

    // 跳转到首页
    router.push('/')
  } catch (err: unknown) {
    const error_ = err as { response?: { data?: { message?: string } } }
    error.value = error_.response?.data?.message || '登录失败，请检查邮箱和密码'
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-container {
  background: white;
  padding: 3rem;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 400px;
}

.login-container h1 {
  font-size: 2rem;
  text-align: center;
  margin-bottom: 0.5rem;
  color: #1a1a1a;
}

.subtitle {
  text-align: center;
  color: #6c757d;
  margin-bottom: 2rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  color: #1a1a1a;
}

.form-group input {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.btn {
  padding: 0.75rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #f8d7da;
  color: #721c24;
  border-radius: 6px;
  text-align: center;
}
</style>
