<template>
  <div class="table-container">
    <div v-if="loading" class="table-loading">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>
    
    <table v-else-if="data.length > 0" class="table">
      <thead>
        <tr>
          <th v-if="selectable" class="select-col">
            <input 
              type="checkbox" 
              :checked="allSelected"
              @change="toggleSelectAll"
            />
          </th>
          <th v-for="column in columns" :key="column.key" :style="{ width: column.width }">
            <div class="th-content">
              {{ column.title }}
              <span v-if="column.sortable" class="sort-icon" @click="handleSort(column.key)">
                {{ getSortIcon(column.key) }}
              </span>
            </div>
          </th>
          <th v-if="$slots.actions" class="actions-col">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in data" :key="getRowKey(row)">
          <td v-if="selectable" class="select-col">
            <input 
              type="checkbox" 
              :checked="isSelected(row)"
              @change="toggleSelect(row)"
            />
          </td>
          <td v-for="column in columns" :key="column.key">
            <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]">
              {{ renderCell(row, column) }}
            </slot>
          </td>
          <td v-if="$slots.actions">
            <slot name="actions" :row="row"></slot>
          </td>
        </tr>
      </tbody>
    </table>
    
    <div v-else class="table-empty">
      <slot name="empty">
        <p>暂无数据</p>
      </slot>
    </div>
    
    <!-- 分页 -->
    <div v-if="pagination && data.length > 0" class="table-pagination">
      <span class="pagination-info">
        共 {{ pagination.total }} 条，第 {{ pagination.current }} / {{ pagination.pages }} 页
      </span>
      <div class="pagination-buttons">
        <button 
          @click="$emit('page-change', pagination.current - 1)"
          :disabled="pagination.current <= 1"
          class="btn-page"
        >
          上一页
        </button>
        <button 
          @click="$emit('page-change', pagination.current + 1)"
          :disabled="pagination.current >= pagination.pages"
          class="btn-page"
        >
          下一页
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

interface Column {
  key: string;
  title: string;
  width?: string;
  sortable?: boolean;
  render?: (value: any, row: any) => string;
}

interface Pagination {
  total: number;
  current: number;
  pages: number;
}

const props = defineProps<{
  data: any[];
  columns: Column[];
  rowKey?: string;
  selectable?: boolean;
  loading?: boolean;
  pagination?: Pagination;
}>();

const emit = defineEmits<{
  'page-change': [page: number];
  'sort-change': [key: string, order: 'asc' | 'desc'];
  'selection-change': [selectedRows: any[]];
}>();

const selectedRows = ref<any[]>([]);
const sortState = ref<{ key: string; order: 'asc' | 'desc' } | null>(null);

const allSelected = computed(() => {
  return props.data.length > 0 && selectedRows.value.length === props.data.length;
});

function getRowKey(row: any) {
  return props.rowKey ? row[props.rowKey] : row.id;
}

function renderCell(row: any, column: Column) {
  if (column.render) {
    return column.render(row[column.key], row);
  }
  return row[column.key];
}

function getSortIcon(key: string) {
  if (!sortState.value || sortState.value.key !== key) return '↕';
  return sortState.value.order === 'asc' ? '↑' : '↓';
}

function handleSort(key: string) {
  const order = sortState.value?.key === key && sortState.value.order === 'asc' ? 'desc' : 'asc';
  sortState.value = { key, order };
  emit('sort-change', key, order);
}

function isSelected(row: any) {
  return selectedRows.value.some(r => getRowKey(r) === getRowKey(row));
}

function toggleSelect(row: any) {
  const index = selectedRows.value.findIndex(r => getRowKey(r) === getRowKey(row));
  if (index > -1) {
    selectedRows.value.splice(index, 1);
  } else {
    selectedRows.value.push(row);
  }
  emit('selection-change', selectedRows.value);
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedRows.value = [];
  } else {
    selectedRows.value = [...props.data];
  }
  emit('selection-change', selectedRows.value);
}
</script>

<style scoped>
.table-container {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.table-loading, .table-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #999;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e2e8f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 0.75rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th, .table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.table th {
  background: #f8fafc;
  font-weight: 600;
  font-size: 0.875rem;
  color: #555;
}

.table tbody tr:hover {
  background: #f8fafc;
}

.th-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.sort-icon {
  cursor: pointer;
  color: #999;
  user-select: none;
}

.sort-icon:hover {
  color: #667eea;
}

.select-col {
  width: 50px;
  text-align: center;
}

.actions-col {
  width: 150px;
  text-align: right;
}

.table-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}

.pagination-info {
  font-size: 0.875rem;
  color: #666;
}

.pagination-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-page {
  padding: 0.5rem 1rem;
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn-page:hover:not(:disabled) {
  background: #667eea;
  color: #fff;
  border-color: #667eea;
}

.btn-page:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}
</style>
