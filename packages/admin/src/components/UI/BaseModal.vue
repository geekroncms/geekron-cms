<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="modal-overlay"
      :data-testid="overlayTestid"
      @click="handleOverlayClick"
    >
      <div
        class="modal"
        :class="[`modal-${size}`, { 'modal-centered': centered }]"
        :data-testid="modalTestid"
        @click.stop
      >
        <div
          v-if="$slots.header || title"
          class="modal-header"
        >
          <slot name="header">
            <h2>{{ title }}</h2>
          </slot>
          <button
            v-if="showClose"
            class="modal-close"
            :data-testid="closeBtnTestid"
            @click="close"
          >
            ×
          </button>
        </div>

        <div class="modal-body">
          <slot />
        </div>

        <div
          v-if="$slots.footer"
          class="modal-footer"
        >
          <slot name="footer">
            <button
              class="btn btn-secondary"
              @click="close"
            >
              取消
            </button>
            <button
              class="btn btn-primary"
              @click="confirm"
            >
              确认
            </button>
          </slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  centered?: boolean
  closeOnOverlay?: boolean
  showClose?: boolean
  overlayTestid?: string
  modalTestid?: string
  closeBtnTestid?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  size: 'md',
  centered: true,
  closeOnOverlay: true,
  showClose: true,
  overlayTestid: '',
  modalTestid: '',
  closeBtnTestid: '',
})

const emit = defineEmits(['update:modelValue', 'close', 'confirm'])

const close = () => {
  emit('update:modelValue', false)
  emit('close')
}

const confirm = () => {
  emit('confirm')
}

const handleOverlayClick = () => {
  if (props.closeOnOverlay) {
    close()
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  animation: slideIn 0.3s ease;
}

.modal-centered {
  margin: auto;
}

.modal-sm {
  width: 90%;
  max-width: 400px;
}
.modal-md {
  width: 90%;
  max-width: 500px;
}
.modal-lg {
  width: 90%;
  max-width: 700px;
}
.modal-xl {
  width: 90%;
  max-width: 900px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e9ecef;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.75rem;
  line-height: 1;
  color: #6c757d;
  cursor: pointer;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.modal-close:hover {
  background: #f8f9fa;
  color: #1a1a1a;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid #e9ecef;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
