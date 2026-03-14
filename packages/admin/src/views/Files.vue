<template>
  <AppLayout>
    <div class="files-page">
      <div class="page-header">
        <h1 data-testid="page-title">文件管理</h1>
        <div class="header-actions">
          <button class="btn btn-secondary" @click="fetchFiles" :disabled="loading">
            🔄 刷新
          </button>
          <label class="btn btn-primary">
            📤 上传文件
            <input 
              type="file" 
              hidden 
              multiple 
              @change="handleFileUpload"
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.json,video/*,audio/*"
            >
          </label>
        </div>
      </div>

      <!-- 拖拽上传区域 -->
      <div 
        class="drop-zone"
        :class="{ 'drag-over': isDragOver }"
        @dragover.prevent="isDragOver = true"
        @dragleave.prevent="isDragOver = false"
        @drop.prevent="handleDrop"
      >
        <div class="drop-zone-content">
          <div class="drop-icon">📁</div>
          <p>拖拽文件到此处上传</p>
          <p class="drop-hint">支持多文件上传，单个文件最大 50MB</p>
        </div>
      </div>

      <!-- 筛选栏 -->
      <div class="filter-bar">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索文件..."
          class="search-input"
          @input="debouncedSearch"
        >
        <select v-model="filterType" class="select-input" @change="fetchFiles">
          <option value="">所有类型</option>
          <option value="image">图片</option>
          <option value="document">文档</option>
          <option value="video">视频</option>
          <option value="audio">音频</option>
          <option value="other">其他</option>
        </select>
        <select v-model="sortBy" class="select-input" @change="fetchFiles">
          <option value="created_at">最新上传</option>
          <option value="name">名称</option>
          <option value="size">大小</option>
        </select>
      </div>

      <!-- 批量操作栏 -->
      <div v-if="selectedFiles.length > 0" class="batch-actions">
        <span class="selected-count">已选择 {{ selectedFiles.length }} 个文件</span>
        <button class="btn btn-sm" @click="batchDownload">⬇️ 批量下载</button>
        <button class="btn btn-sm danger" @click="batchDelete">🗑️ 批量删除</button>
        <button class="btn btn-sm" @click="clearSelection">❌ 取消选择</button>
      </div>

      <!-- 文件列表 -->
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="files.length === 0" class="empty-state">
        <div class="empty-icon">📁</div>
        <h3>暂无文件</h3>
        <p>上传第一个文件或使用拖拽上传</p>
        <label class="btn btn-primary">
          上传文件
          <input 
            type="file" 
            hidden 
            multiple 
            @change="handleFileUpload"
          >
        </label>
      </div>
      <div v-else class="files-grid">
        <div v-for="file in files" :key="file.id" class="file-card" :class="{ selected: selectedFiles.includes(file.id) }">
          <div class="file-select">
            <input 
              type="checkbox" 
              :checked="selectedFiles.includes(file.id)"
              @change="toggleSelection(file.id)"
            >
          </div>
          <div class="file-preview" @click="openFilePreview(file)">
            <img
              v-if="isImage(file)"
              :src="file.url"
              :alt="file.name"
              class="preview-image"
              loading="lazy"
            >
            <div v-else class="file-icon">
              {{ getFileIcon(file) }}
            </div>
            <!-- 图片操作按钮 -->
            <div v-if="isImage(file)" class="image-actions">
              <button class="btn-icon" @click.stop="generateThumbnail(file)" title="生成缩略图">
                🖼️
              </button>
              <button class="btn-icon" @click.stop="openTransformDialog(file)" title="图片变换">
                ✂️
              </button>
              <button class="btn-icon" @click.stop="optimizeImage(file)" title="优化图片">
                ⚡
              </button>
            </div>
          </div>
          <div class="file-info">
            <h3 class="file-name" :title="file.name">{{ file.name }}</h3>
            <div class="file-meta">
              <span class="file-size">{{ formatSize(file.size) }}</span>
              <span class="file-type">{{ file.mime_type.split('/')[1]?.toUpperCase() || file.mime_type }}</span>
            </div>
            <div class="file-date">
              {{ formatDate(file.created_at) }}
            </div>
          </div>
          <div class="file-actions">
            <button class="btn-sm" @click="downloadFile(file)" title="下载">
              ⬇️
            </button>
            <button class="btn-sm" @click="copyUrl(file)" title="复制链接">
              🔗
            </button>
            <button class="btn-sm" @click="openPreview(file)" title="预览">
              👁️
            </button>
            <button class="btn-sm danger" @click="deleteFile(file)" title="删除">
              🗑️
            </button>
          </div>
        </div>
      </div>

      <!-- 上传进度 -->
      <div v-if="uploadingFiles.length > 0" class="upload-progress-container">
        <div v-for="(upload, index) in uploadingFiles" :key="index" class="upload-progress">
          <div class="upload-info">
            <span class="upload-name">{{ upload.name }}</span>
            <span class="upload-percent">{{ upload.progress }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress" :style="{ width: upload.progress + '%' }" />
          </div>
        </div>
      </div>

      <!-- 文件预览对话框 -->
      <div v-if="previewFile" class="modal-overlay" @click="closePreview">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>{{ previewFile.name }}</h3>
            <button class="close-btn" @click="closePreview">✕</button>
          </div>
          <div class="modal-body">
            <img v-if="isImage(previewFile)" :src="previewFile.url" class="preview-full">
            <iframe v-else-if="isPDF(previewFile)" :src="previewFile.url" class="preview-full"></iframe>
            <div v-else class="preview-placeholder">
              {{ getFileIcon(previewFile) }}
              <p>此文件类型不支持预览</p>
            </div>
          </div>
          <div class="modal-footer">
            <a :href="previewFile.url" download class="btn btn-primary">下载</a>
            <button class="btn" @click="copyUrl(previewFile)">复制链接</button>
          </div>
        </div>
      </div>

      <!-- 图片变换对话框 -->
      <div v-if="transformFile" class="modal-overlay" @click="closeTransformDialog">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>图片变换 - {{ transformFile.name }}</h3>
            <button class="close-btn" @click="closeTransformDialog">✕</button>
          </div>
          <div class="modal-body">
            <div class="transform-options">
              <div class="transform-option">
                <label>宽度 (px)</label>
                <input type="number" v-model.number="transformOptions.width" placeholder="800">
              </div>
              <div class="transform-option">
                <label>高度 (px)</label>
                <input type="number" v-model.number="transformOptions.height" placeholder="600">
              </div>
              <div class="transform-option">
                <label>质量 (%)</label>
                <input type="number" v-model.number="transformOptions.quality" min="1" max="100" value="80">
              </div>
              <div class="transform-option">
                <label>格式</label>
                <select v-model="transformOptions.format">
                  <option value="webp">WebP</option>
                  <option value="jpeg">JPEG</option>
                  <option value="png">PNG</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" @click="applyTransform">应用变换</button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

import { api } from '@/api'
import { AppLayout } from '@/components'

interface File {
  id: string
  name: string
  url: string
  mime_type: string
  size: number
  created_at: string
  folder?: string
  r2Key?: string
}

interface UploadingFile {
  name: string
  progress: number
}

const files = ref<File[]>([])
const loading = ref(true)
const uploadingFiles = ref<UploadingFile[]>([])
const searchQuery = ref('')
const filterType = ref('')
const sortBy = ref('created_at')
const selectedFiles = ref<string[]>([])
const isDragOver = ref(false)
const previewFile = ref<File | null>(null)
const transformFile = ref<File | null>(null)
const transformOptions = ref({
  width: 800,
  height: 600,
  quality: 80,
  format: 'webp',
})

let searchTimeout: NodeJS.Timeout | null = null

onMounted(() => {
  fetchFiles()
})

async function fetchFiles() {
  try {
    loading.value = true
    const response = await api.get('/files', {
      params: {
        type: filterType.value,
        search: searchQuery.value,
        sort: sortBy.value,
      },
    })
    files.value = response.data?.data || response.data || []
  } catch (error) {
    console.error('Failed to fetch files:', error)
    alert('加载文件列表失败')
  } finally {
    loading.value = false
  }
}

function debouncedSearch() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    fetchFiles()
  }, 300)
}

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const fileList = target.files
  if (!fileList || fileList.length === 0) return

  await uploadFiles(Array.from(fileList))
  target.value = ''
}

async function handleDrop(event: DragEvent) {
  isDragOver.value = false
  const fileList = event.dataTransfer?.files
  if (!fileList || fileList.length === 0) return

  await uploadFiles(Array.from(fileList))
}

async function uploadFiles(fileList: File[]) {
  try {
    const uploading = fileList.map(f => ({ name: f.name, progress: 0 }))
    uploadingFiles.value = uploading

    // 批量上传
    const formData = new FormData()
    fileList.forEach(f => formData.append('files', f))

    const response = await api.post('/files/upload/batch', formData, {
      params: { folder: 'uploads' },
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && progressEvent.loaded !== undefined) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          uploadingFiles.value = uploading.map((u, i) => ({
            ...u,
            progress: percent,
          }))
        }
      },
    })

    // 刷新文件列表
    await fetchFiles()
    
    // 显示上传结果
    const success = response.data?.uploaded?.length || 0
    const failed = response.data?.failed?.length || 0
    if (failed > 0) {
      alert(`上传完成：成功 ${success} 个，失败 ${failed} 个`)
    }
  } catch (error: any) {
    console.error(error)
    alert(`上传失败：${error.message || '未知错误'}`)
  } finally {
    uploadingFiles.value = []
  }
}

function isImage(file: File): boolean {
  return file.mime_type.startsWith('image/')
}

function isPDF(file: File): boolean {
  return file.mime_type === 'application/pdf'
}

function getFileIcon(file: File): string {
  if (file.mime_type.includes('pdf')) return '📄'
  if (file.mime_type.includes('word')) return '📝'
  if (file.mime_type.includes('excel')) return '📊'
  if (file.mime_type.includes('video')) return '🎬'
  if (file.mime_type.includes('audio')) return '🎵'
  return '📁'
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN')
}

function toggleSelection(fileId: string) {
  const index = selectedFiles.value.indexOf(fileId)
  if (index > -1) {
    selectedFiles.value.splice(index, 1)
  } else {
    selectedFiles.value.push(fileId)
  }
}

function clearSelection() {
  selectedFiles.value = []
}

async function batchDownload() {
  const toDownload = files.value.filter(f => selectedFiles.value.includes(f.id))
  for (const file of toDownload) {
    window.open(file.url, '_blank')
  }
  clearSelection()
}

async function batchDelete() {
  if (!confirm(`确定删除选中的 ${selectedFiles.value.length} 个文件？`)) return
  
  try {
    const promises = selectedFiles.value.map(id => api.delete(`/files/${id}`))
    await Promise.all(promises)
    await fetchFiles()
    clearSelection()
  } catch (error) {
    alert('批量删除失败')
    console.error(error)
  }
}

async function downloadFile(file: File) {
  window.open(file.url, '_blank')
}

async function copyUrl(file: File) {
  try {
    await navigator.clipboard.writeText(file.url)
    alert('链接已复制到剪贴板')
  } catch {
    alert('复制失败')
  }
}

async function deleteFile(file: File) {
  if (!confirm(`确定删除文件 "${file.name}"？`)) return
  try {
    await api.delete(`/files/${file.id}`)
    await fetchFiles()
  } catch (error) {
    alert('删除失败')
    console.error(error)
  }
}

function openFilePreview(file: File) {
  if (isImage(file) || isPDF(file)) {
    previewFile.value = file
  } else {
    downloadFile(file)
  }
}

function openPreview(file: File) {
  previewFile.value = file
}

function closePreview() {
  previewFile.value = null
}

function openTransformDialog(file: File) {
  transformFile.value = file
  transformOptions.value = {
    width: 800,
    height: 600,
    quality: 80,
    format: 'webp',
  }
}

function closeTransformDialog() {
  transformFile.value = null
}

async function generateThumbnail(file: File) {
  try {
    const thumbnailUrl = `${file.url}/thumbnail?width=200&height=200`
    window.open(thumbnailUrl, '_blank')
  } catch (error) {
    alert('生成缩略图失败')
    console.error(error)
  }
}

async function applyTransform() {
  if (!transformFile.value) return
  
  try {
    const response = await api.post(`/files/${transformFile.value.id}/transform`, {
      operations: [
        { type: 'resize', width: transformOptions.value.width, height: transformOptions.value.height },
      ],
    })
    
    alert('图片变换成功！')
    closeTransformDialog()
    await fetchFiles()
  } catch (error: any) {
    alert(`变换失败：${error.message || '未知错误'}`)
    console.error(error)
  }
}

async function optimizeImage(file: File) {
  if (!confirm('优化图片将转换为 WebP 格式并压缩，是否继续？')) return
  
  try {
    const response = await api.post(`/files/${file.id}/optimize?quality=80&format=webp`)
    alert('图片优化成功！')
    await fetchFiles()
  } catch (error: any) {
    alert(`优化失败：${error.message || '未知错误'}`)
    console.error(error)
  }
}
</script>

<style scoped>
.files-page {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.page-header h1 {
  font-size: 1.5rem;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

/* 拖拽上传区域 */
.drop-zone {
  border: 2px dashed #cbd5e1;
  border-radius: 12px;
  padding: 3rem;
  text-align: center;
  margin-bottom: 1.5rem;
  transition: all 0.3s;
  cursor: pointer;
}

.drop-zone.drag-over {
  border-color: #667eea;
  background: #f0f4ff;
  transform: scale(1.02);
}

.drop-zone-content {
  color: #64748b;
}

.drop-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.drop-hint {
  font-size: 0.875rem;
  color: #94a3b8;
  margin-top: 0.5rem;
}

.filter-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 200px;
  max-width: 400px;
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.875rem;
}

.select-input {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.875rem;
  background: white;
}

/* 批量操作栏 */
.batch-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  border: 1px solid #e2e8f0;
}

.selected-count {
  font-weight: 600;
  color: #667eea;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-sm:hover {
  background: #f1f5f9;
}

.btn-sm.danger {
  color: #ef4444;
  border-color: #ef4444;
}

.btn-sm.danger:hover {
  background: #fef2f2;
}

.loading,
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  margin-bottom: 0.5rem;
  color: #334155;
}

.empty-state p {
  color: #64748b;
  margin-bottom: 1.5rem;
}

.files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.5rem;
}

.file-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.2s;
  position: relative;
}

.file-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.file-card.selected {
  border: 2px solid #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
}

.file-select {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 10;
}

.file-select input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.file-preview {
  height: 160px;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  cursor: pointer;
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.file-card:hover .preview-image {
  transform: scale(1.05);
}

.file-icon {
  font-size: 3.5rem;
}

.image-actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.file-card:hover .image-actions {
  opacity: 1;
}

.btn-icon {
  background: white;
  border: none;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: #667eea;
  color: white;
}

.file-info {
  padding: 1rem;
}

.file-name {
  font-size: 0.875rem;
  margin: 0 0 0.5rem 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #1e293b;
}

.file-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 0.5rem;
}

.file-date {
  font-size: 0.75rem;
  color: #94a3b8;
}

.file-actions {
  display: flex;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid #e2e8f0;
}

.btn {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn:hover {
  background: #f1f5f9;
}

.btn-primary {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.btn-primary:hover {
  background: #5568d3;
}

.btn-secondary {
  background: #e2e8f0;
  color: #333;
  border-color: #e2e8f0;
}

.btn-sm {
  padding: 0.5rem;
  font-size: 1rem;
  border: none;
  background: none;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-sm:hover {
  opacity: 0.7;
}

.btn-sm.danger:hover {
  opacity: 1;
}

/* 上传进度 */
.upload-progress-container {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 350px;
  max-height: 400px;
  overflow-y: auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  padding: 1rem;
  z-index: 1000;
}

.upload-progress {
  margin-bottom: 1rem;
}

.upload-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.upload-name {
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 250px;
}

.upload-percent {
  color: #667eea;
  font-weight: 600;
}

.progress-bar {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  transition: width 0.3s;
}

/* 对话框 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #64748b;
  padding: 0.25rem;
}

.close-btn:hover {
  color: #1e293b;
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.preview-full {
  width: 100%;
  max-height: 60vh;
  object-fit: contain;
}

.preview-placeholder {
  text-align: center;
  padding: 4rem 2rem;
  color: #64748b;
}

.preview-placeholder .file-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.transform-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.transform-option {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.transform-option label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #475569;
}

.transform-option input,
.transform-option select {
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .files-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  
  .filter-bar {
    flex-direction: column;
  }
  
  .search-input {
    max-width: 100%;
  }
  
  .upload-progress-container {
    left: 1rem;
    right: 1rem;
    width: auto;
  }
}
</style>
