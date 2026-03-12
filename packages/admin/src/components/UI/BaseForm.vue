<template>
  <div class="base-form" :class="{ 'form-inline': inline }">
    <div v-for="field in fields" :key="field.key" class="form-item" :class="{ 'has-error': errors?.[field.key] }">
      <label v-if="field.label" class="form-label" :class="{ required: field.required }">
        {{ field.label }}
      </label>
      
      <!-- 文本输入 -->
      <input
        v-if="field.type === 'text' || field.type === 'email' || field.type === 'password' || field.type === 'number'"
        :type="field.type"
        :placeholder="field.placeholder"
        :value="modelValue[field.key]"
        @input="$emit('update:modelValue', { ...modelValue, [field.key]: ($event.target as HTMLInputElement).value })"
        class="form-input"
        :required="field.required"
      />
      
      <!-- 文本域 -->
      <textarea
        v-else-if="field.type === 'textarea'"
        :placeholder="field.placeholder"
        :value="modelValue[field.key]"
        @input="$emit('update:modelValue', { ...modelValue, [field.key]: ($event.target as HTMLTextAreaElement).value })"
        class="form-textarea"
        :rows="field.rows || 4"
        :required="field.required"
      />
      
      <!-- 下拉选择 -->
      <select
        v-else-if="field.type === 'select'"
        :value="modelValue[field.key]"
        @change="$emit('update:modelValue', { ...modelValue, [field.key]: ($event.target as HTMLSelectElement).value })"
        class="form-select"
        :required="field.required"
      >
        <option v-if="field.placeholder" value="">{{ field.placeholder }}</option>
        <option v-for="option in field.options" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      
      <!-- 单选框组 -->
      <div v-else-if="field.type === 'radio'" class="form-radio-group">
        <label v-for="option in field.options" :key="option.value" class="form-radio">
          <input
            type="radio"
            :value="option.value"
            :checked="modelValue[field.key] === option.value"
            @change="$emit('update:modelValue', { ...modelValue, [field.key]: option.value })"
          />
          <span>{{ option.label }}</span>
        </label>
      </div>
      
      <!-- 复选框 -->
      <label v-else-if="field.type === 'checkbox'" class="form-checkbox">
        <input
          type="checkbox"
          :checked="modelValue[field.key]"
          @change="$emit('update:modelValue', { ...modelValue, [field.key]: ($event.target as HTMLInputElement).checked })"
        />
        <span>{{ field.label }}</span>
      </label>
      
      <!-- 开关 -->
      <div v-else-if="field.type === 'switch'" class="form-switch">
        <label class="switch">
          <input
            type="checkbox"
            :checked="modelValue[field.key]"
            @change="$emit('update:modelValue', { ...modelValue, [field.key]: ($event.target as HTMLInputElement).checked })"
          />
          <span class="slider"></span>
        </label>
        <span v-if="field.label" class="switch-label">{{ field.label }}</span>
      </div>
      
      <!-- 错误提示 -->
      <div v-if="errors?.[field.key]" class="form-error">
        {{ errors?.[field.key] }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface FormField {
  key: string;
  label?: string;
  type: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'switch';
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  rows?: number;
}

const props = defineProps<{
  modelValue: Record<string, any>;
  fields: FormField[];
  inline?: boolean;
  errors?: Record<string, string>;
}>();

defineEmits<{
  'update:modelValue': [value: Record<string, any>];
}>();
</script>

<style scoped>
.base-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.base-form.form-inline {
  flex-direction: row;
  flex-wrap: wrap;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 200px;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #555;
}

.form-label.required::before {
  content: '* ';
  color: #e53e3e;
}

.form-input,
.form-textarea,
.form-select {
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.9375rem;
  transition: all 0.2s;
  background: #fff;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input.has-error,
.form-textarea.has-error,
.form-select.has-error {
  border-color: #e53e3e;
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.form-radio-group {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.form-radio {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9375rem;
  color: #555;
}

.form-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9375rem;
  color: #555;
}

.form-switch {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #e2e8f0;
  transition: 0.3s;
  border-radius: 26px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #667eea;
}

input:checked + .slider:before {
  transform: translateX(22px);
}

.switch-label {
  font-size: 0.9375rem;
  color: #555;
}

.form-error {
  font-size: 0.8125rem;
  color: #e53e3e;
}

input[type="radio"],
input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}
</style>
