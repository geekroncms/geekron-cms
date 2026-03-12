import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { errors } from '../utils/errors';

export const fileRoutes = new Hono();

// ==================== Schema Definitions ====================

const uploadFileSchema = z.object({
  name: z.string().optional(),
  folder: z.string().optional(),
});

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/json',
  'video/mp4',
  'audio/mpeg',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// ==================== File Upload Routes ====================

/**
 * POST /files/upload
 * Upload a file to R2 storage
 */
fileRoutes.post('/upload', zValidator('query', uploadFileSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { name, folder = 'uploads' } = c.req.valid('query');

  // Check if BUCKET is available
  if (!c.env.BUCKET) {
    throw errors.internal('File storage not configured');
  }

  const formData = await c.req.parseBody();
  const file = formData['file'] as File;

  if (!file) {
    throw errors.invalidInput({ file: 'File is required' });
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw errors.invalidInput({ 
      file: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` 
    });
  }

  // Validate MIME type
  if (!allowedMimeTypes.includes(file.type)) {
    throw errors.invalidInput({ 
      file: `File type ${file.type} is not allowed` 
    });
  }

  // Generate unique filename
  const ext = file.name.split('.').pop() || '';
  const baseName = name || file.name.replace(`.${ext}`, '');
  const sanitizedName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = Date.now();
  const r2Key = `${folder}/${tenantId}/${timestamp}-${sanitizedName}.${ext}`;

  // Upload to R2
  const arrayBuffer = await file.arrayBuffer();
  await c.env.BUCKET.put(r2Key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type,
    },
    customMetadata: {
      tenantId,
      uploadedBy: userId,
      originalName: file.name,
    },
  });

  // Save file record to database
  const fileId = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    INSERT INTO files (id, tenant_id, name, path, mime_type, size, r2_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(fileId, tenantId, file.name, r2Key, file.type, file.size, r2Key, now).run();

  // Generate public URL (if bucket has public access)
  const publicUrl = c.env.BUCKET_URL 
    ? `${c.env.BUCKET_URL}/${r2Key}`
    : `/api/v1/files/${fileId}/download`;

  return c.json({
    id: fileId,
    name: file.name,
    url: publicUrl,
    r2Key,
    mimeType: file.type,
    size: file.size,
    message: 'File uploaded successfully',
  }, 201);
});

/**
 * POST /files/upload/multipart
 * Initiate multipart upload for large files
 */
fileRoutes.post('/upload/multipart', async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  
  const { filename, mimeType, size } = await c.req.json();

  if (!c.env.BUCKET) {
    throw errors.internal('File storage not configured');
  }

  if (size > 500 * 1024 * 1024) { // 500MB max
    throw errors.invalidInput({ size: 'File size exceeds maximum of 500MB' });
  }

  const ext = filename.split('.').pop() || '';
  const sanitizedName = filename.replace(`.${ext}`, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = Date.now();
  const r2Key = `uploads/${tenantId}/${timestamp}-${sanitizedName}.${ext}`;

  // Create multipart upload
  const upload = await c.env.BUCKET.createMultipartUpload(r2Key, {
    httpMetadata: {
      contentType: mimeType,
    },
    customMetadata: {
      tenantId,
      uploadedBy: userId,
      originalName: filename,
    },
  });

  return c.json({
    uploadId: upload.uploadId,
    key: r2Key,
    filename,
    message: 'Multipart upload initiated',
  });
});

/**
 * POST /files/upload/multipart/:uploadId
 * Upload a part of a multipart upload
 */
fileRoutes.post('/upload/multipart/:uploadId', async (c) => {
  const uploadId = c.req.param('uploadId');
  const { partNumber } = c.req.query('partNumber');
  
  if (!c.env.BUCKET) {
    throw errors.internal('File storage not configured');
  }

  const part = await c.req.arrayBuffer();
  const upload = c.env.BUCKET.resumeMultipartUpload(uploadId);
  
  const uploadedPart = await upload.uploadPart(parseInt(partNumber || '1'), part);

  return c.json({
    partNumber: parseInt(partNumber || '1'),
    etag: uploadedPart.etag,
  });
});

/**
 * POST /files/upload/multipart/:uploadId/complete
 * Complete a multipart upload
 */
fileRoutes.post('/upload/multipart/:uploadId/complete', async (c) => {
  const uploadId = c.req.param('uploadId');
  const { parts } = await c.req.json();
  
  if (!c.env.BUCKET) {
    throw errors.internal('File storage not configured');
  }

  const upload = c.env.BUCKET.resumeMultipartUpload(uploadId);
  await upload.complete(parts);

  // Get upload info to save to database
  const uploadInfo = await upload.state();

  const fileId = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    INSERT INTO files (id, tenant_id, name, path, mime_type, size, r2_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    fileId, 
    uploadInfo.customMetadata?.tenantId || c.get('tenantId'),
    uploadInfo.customMetadata?.originalName || 'unknown',
    uploadInfo.key,
    uploadInfo.httpMetadata?.contentType || 'application/octet-stream',
    uploadInfo.size || 0,
    uploadInfo.key,
    now
  ).run();

  return c.json({
    message: 'Multipart upload completed successfully',
    key: uploadInfo.key,
  });
});

/**
 * GET /files
 * List all files for tenant
 */
fileRoutes.get('/', async (c) => {
  const tenantId = c.get('tenantId');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;

  const files: any = await c.env.DB.prepare(`
    SELECT * FROM files 
    WHERE tenant_id = ? 
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(tenantId, limit, offset).all();

  const total: any = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM files WHERE tenant_id = ?
  `).bind(tenantId).first();

  const fileList = (files.results || []).map((f: any) => ({
    ...f,
    url: c.env.BUCKET_URL 
      ? `${c.env.BUCKET_URL}/${f.r2_key}`
      : `/api/v1/files/${f.id}/download`,
  }));

  return c.json({
    data: fileList,
    pagination: {
      page,
      limit,
      total: total?.count || 0,
      totalPages: Math.ceil((total?.count || 0) / limit),
    },
  });
});

/**
 * GET /files/:id
 * Get file info
 */
fileRoutes.get('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const fileId = c.req.param('id');

  const file: any = await c.env.DB.prepare(`
    SELECT * FROM files WHERE id = ? AND tenant_id = ?
  `).bind(fileId, tenantId).first();

  if (!file) {
    throw errors.notFound('File');
  }

  return c.json({
    ...file,
    url: c.env.BUCKET_URL 
      ? `${c.env.BUCKET_URL}/${file.r2_key}`
      : `/api/v1/files/${fileId}/download`,
  });
});

/**
 * GET /files/:id/download
 * Download file (proxy through server if not public)
 */
fileRoutes.get('/:id/download', async (c) => {
  const tenantId = c.get('tenantId');
  const fileId = c.req.param('id');

  const file: any = await c.env.DB.prepare(`
    SELECT * FROM files WHERE id = ? AND tenant_id = ?
  `).bind(fileId, tenantId).first();

  if (!file) {
    throw errors.notFound('File');
  }

  if (!c.env.BUCKET) {
    throw errors.internal('File storage not configured');
  }

  // Get file from R2
  const object = await c.env.BUCKET.get(file.r2_key);

  if (!object) {
    throw errors.notFound('File content');
  }

  const arrayBuffer = await object.arrayBuffer();

  return c.body(arrayBuffer, 200, {
    'Content-Type': file.mime_type,
    'Content-Disposition': `attachment; filename="${file.name}"`,
  });
});

/**
 * DELETE /files/:id
 * Delete file
 */
fileRoutes.delete('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const fileId = c.req.param('id');

  const file: any = await c.env.DB.prepare(`
    SELECT * FROM files WHERE id = ? AND tenant_id = ?
  `).bind(fileId, tenantId).first();

  if (!file) {
    throw errors.notFound('File');
  }

  if (c.env.BUCKET) {
    // Delete from R2
    await c.env.BUCKET.delete(file.r2_key);
  }

  // Delete from database
  await c.env.DB.prepare('DELETE FROM files WHERE id = ?').bind(fileId).run();

  return c.json({ message: 'File deleted successfully' });
});
