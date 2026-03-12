<template>
  <div class="page">
    <h1>{{ title }}</h1>
    <p>页面内容</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const title = computed(() => route.meta.title as string || '页面');
</script>

<style scoped>
.page {
  padding: 2rem;
}
</style>
