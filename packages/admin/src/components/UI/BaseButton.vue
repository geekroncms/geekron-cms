<template>
  <button
    class="base-button"
    :class="[typeClass, sizeClass, { 
      'btn-loading': loading, 
      'btn-disabled': disabled,
      'btn-block': block,
      'btn-icon': icon && !$slots.default
    }]"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="btn-spinner"></span>
    <span v-if="icon" class="btn-icon">{{ icon }}</span>
    <span v-if="$slots.default || label" class="btn-text">
      <slot>{{ label }}</slot>
    </span>
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{
  type?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  icon?: string;
  label?: string;
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
}>();

defineEmits<{
  click: [event: MouseEvent];
}>();

const typeClass = props.type ? `btn-${props.type}` : 'btn-primary';
const sizeClass = props.size ? `btn-${props.size}` : 'btn-medium';
</script>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.base-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 类型 */
.btn-primary {
  background: #667eea;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #5a6fd6;
}

.btn-secondary {
  background: #e2e8f0;
  color: #333;
}

.btn-secondary:hover:not(:disabled) {
  background: #cbd5e1;
}

.btn-danger {
  background: #e53e3e;
  color: #fff;
}

.btn-danger:hover:not(:disabled) {
  background: #c53030;
}

.btn-success {
  background: #38a169;
  color: #fff;
}

.btn-success:hover:not(:disabled) {
  background: #2f855a;
}

.btn-warning {
  background: #dd6b20;
  color: #fff;
}

.btn-warning:hover:not(:disabled) {
  background: #c05621;
}

.btn-ghost {
  background: transparent;
  color: #667eea;
}

.btn-ghost:hover:not(:disabled) {
  background: rgba(102, 126, 234, 0.1);
}

/* 尺寸 */
.btn-small {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}

.btn-medium {
  padding: 0.5rem 1rem;
}

.btn-large {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
}

/* 状态 */
.btn-loading {
  position: relative;
}

.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-block {
  width: 100%;
}

.btn-icon:not(.btn-block) {
  padding: 0.5rem;
}
</style>
