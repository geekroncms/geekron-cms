<template>
  <AppLayout v-if="authStore.isAuthenticated && $route.path !== '/login'">
    <router-view />
  </AppLayout>
  <router-view v-else />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { AppLayout } from '@/components';

const authStore = useAuthStore();

onMounted(async () => {
  if (authStore.isAuthenticated) {
    await authStore.fetchUser();
  }
});
</script>

<style>
#app {
  width: 100%;
  height: 100vh;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: #f5f7fa;
}

a {
  text-decoration: none;
  color: inherit;
}

button {
  font-family: inherit;
}
</style>
