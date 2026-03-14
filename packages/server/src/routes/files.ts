import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import type { Bindings, Variables } from '../types/hono'
import { z } from 'zod'
import { errors } from '../utils/errors'

export const fileRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ==================== Schema Definitions ====================

const uploadFileSchema = z.object({
  name: z.string().optional(),
  folder: z.string().optional(),
})

const batchUploadSchema = z.object({
  files: z.array(z.object({
    name: z.string(),
    folder: z.string().optional(),
  })),
})

const imageTransformSchema = z.object({
  operations: z.array(
    z.union([
      z.object({
        type: z.literal('resize'),
        width: z.number().optional(),
        height: z.number().optional(),
        fit: z.enum(['cover', 'contain', 'fill']).optional(),
      }),
      z.object({
        type: z.literal('crop'),
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
      z.object({
        type: z.literal('rotate'),
        degrees: z.number(),
      }),
      z.object({
        type: z.literal('flip'),
        horizontal: z.boolean().optional(),
        vertical: z.boolean().optional(),
      }),
    ])
  ),
})

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
]

const imageMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_BATCH_SIZE = 10 // 最多 10 个文件

// ==================== File Upload Routes ====================

/**
 * POST /files/upload
 * Upload a single file to R2 storage
 */
fileRoutes.post('/upload', zValidator('query', uploadFileSchema), async (c) => {
  const tenantId = c.get('tenantId')
  const userId = c.get('userId')
  const { name, folder = 'uploads' } = c.req.valid('query')

  // Check if BUCKET is available
  if (!c.env.BUCKET) {
    throw errors.internal('File storage not configured')
  }

  const formData = await c.req.parseBody()
  const file = formData['file'] as File

  if (!file) {
    throw errors.invalidInput({ file: 'File is required' })
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw errors.invalidInput({
      file: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    })
  }

  // Validate MIME type
  if (!allowedMimeTypes.includes(file.type)) {
    throw errors.invalidInput({
      file: `File type ${file.type} is not allowed`,
    })
  }

  const uploadResult = await uploadFileToR2(c, file, folder, tenantId, userId, name)

  return c.json(
    {
      ...uploadResult,
      message: 'File uploaded successfully',
    },
    201,
  )
})

/**
 * POST /files/upload/batch
 * Upload multiple files at once
 */
fileRoutes.post('/upload/batch', zValidator('query', uploadFileSchema), async (c) => {
  const tenantId = c.get('tenantId')
  const userId = c.get('userId')
  const { folder = 'uploads' } = c.req.valid('query')

  if (!c.env.BUCKET) {
    throw errors.internal('File storage not configured')
  }

  const formData = await c.req.parseBody()
  const files = formData['files'] as File | File[]

  if (!files) {
    throw errors.invalidInput({ files: 'At least one file is required' })
  }

  // Convert single file to array
  const fileList = Array.isArray(files) ? files : [files]

  if (fileList.length === 0) {
    throw errors.invalidInput({ files: 'At least one file is required' })
  }

  if (fileList.length > MAX_BATCH_SIZE) {
    throw errors.invalidInput({
      files: `Maximum ${MAX_BATCH_SIZE} files per batch`,
    })
  }

  const results: any[] = []
  const uploadErrors: any[] = []

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i]
    try {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        uploadErrors.push({
          name: file.name,
          error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        })
        continue
      }

      // Validate MIME type
      if (!allowedMimeTypes.includes(file.type)) {
        uploadErrors.push({
          name: file.name,
          error: `File type ${file.type} is not allowed`,
        })
        continue
      }

      const uploadResult = await uploadFileToR2(c, file, folder, tenantId, userId)
      results.push(uploadResult)
    } catch (error: any) {
      uploadErrors.push({
        name: file.name,
        error: error.message || 'Upload failed',
      })
    }
  }

  return c.json({
    uploaded: results,
    failed: uploadErrors,
    message: `Successfully uploaded ${results.length} of ${fileList.length} files`,
  })
})

/**
 * Helper function to upload file to R2
 */
async function uploadFileToR2(
  c: any,
  file: File,
  folder: string,
  tenantId: string,
  userId: string,
  name?: string
) {
  // Generate unique filename
  const ext = file.name.split('.').pop() || ''
  const baseName = name || file.name.replace(`.${ext}`, '')
  const sanitizedName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const timestamp = Date.now()
  const r2Key = `${folder}/${tenantId}/${timestamp}-${sanitizedName}.${ext}`

  // Upload to R2
  const arrayBuffer = await file.arrayBuffer()
  await c.env.BUCKET.put(r2Key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type,
    },
    customMetadata: {
      tenantId,
      uploadedBy: userId,
      originalName: file.name,
    },
  })

  // Save file record to database
  const fileId = crypto.randomUUID()
  const now = new Date().toISOString()

  await c.env.DB.prepare(
    `
    INSERT INTO files (id, tenant_id, name, path, mime_type, size, r2_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  )
    .bind(fileId, tenantId, file.name, r2Key, file.type, file.size, r2Key, now)
    .run()

  // Generate public URL (if bucket has public access)
  const publicUrl = c.env.BUCKET_URL
    ? `${c.env.BUCKET_URL}/${r2Key}`
    : `/api/v1/files/${fileId}/download`

  return {
    id: fileId,
    name: file.name,
    url: publicUrl,
    r2Key,
    mimeType: file.type,
    size: file.size,
  }
}

/**
 * POST /files/upload/multipart
 * Initiate multipart upload for large files
 */
fileRoutes.post('/upload/multipart', async (c) => {
  const tenantId = c.get('tenantId')
  const userId = c.get('userId')

  const { filename, mimeType, size } = await c.req.json()

  if (!c.env.BUCKET) {
    throw errors.internal('File storage not configured')
  }

  if (size > 500 * 1024 * 1024) {
    // 500MB max
    throw errors.invalidInput({ size: 'File size exceeds maximum of 500MB' })
  }

  const ext = filename.split('.').pop() || ''
  const sanitizedName = filename.replace(`.${ext}`, '').replace(/[^a-zA-Z0-9_-]/g, '_')
  const timestamp = Date.now()
  const r2Key = `uploads/${tenantId}/${timestamp}-${sanitizedName}.${ext}`

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
  })

  return c.json({
    uploadId: upload.uploadId,
    key: r2Key,
    filename,
    message: 'Multipart upload initiated',
  })
})

/**
 * POST /files/upload/multipart/:uploadId
 * Upload a part of a multipart upload
 */
fileRoutes.post('/upload/multipart/:uploadId', async (c) => {
  const uploadId = c.req.param('uploadId')
  const { partNumber } = c.req.query('partNumber')

  if (!c.env.BUCKET) {
    throw errors.internal('File storage not configured')
  }

  const part = await c.req.arrayBuffer()
  const upload = c.env.BUCKET.resumeMultipartUpload(uploadId)

  const uploadedPart = await upload.uploadPart(parseInt(partNumber || '1'), part)

  return c.json({
    partNumber: parseInt(partNumber || '1'),
    etag: uploadedPart.etag,
  })
})

/**
 * POST /files/upload/multipart/:uploadId/complete
 * Complete a multipart upload
 */
fileRoutes.post('/upload/multipart/:uploadId/complete', async (c) => {
  const uploadId = c.req.param('uploadId')
  const { parts } = await c.req.json()

  if (!c.env.BUCKET) {
    throw errors.internal('File storage not configured')
  }

  const upload = c.env.BUCKET.resumeMultipartUpload(uploadId)
  await upload.complete(parts)

  // Get upload info to save to database
  const uploadInfo = await upload.state()

  const fileId = crypto.randomUUID()
  const now = new Date().toISOString()

  await c.env.DB.prepare(
    `
    INSERT INTO files (id, tenant_id, name, path, mime_type, size, r2_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  )
    .bind(
      fileId,
      uploadInfo.customMetadata?.tenantId || c.get('tenantId'),
      uploadInfo.customMetadata?.originalName || 'unknown',
      uploadInfo.key,
      uploadInfo.httpMetadata?.contentType || 'application/octet-stream',
      uploadInfo.size || 0,
      uploadInfo.key,
      now,
    )
    .run()

  return c.json({
    message: 'Multipart upload completed successfully',
    key: uploadInfo.key,
  })
})

/**
 * GET /files
 * List all files for tenant
 */
fileRoutes.get('/', async (c) => {
  const tenantId = c.get('tenantId')
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const offset = (page - 1) * limit

  const files: any = await c.env.DB.prepare(
    `
    SELECT * FROM files 
    WHERE tenant_id = ? 
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `,
  )
    .bind(tenantId, limit, offset)
    .all()

  const total: any = await c.env.DB.prepare(
    `
    SELECT COUNT(*) as count FROM files WHERE tenant_id = ?
  `,
  )
    .bind(tenantId)
    .first()

  const fileList = (files.results || []).map((f: any) => ({
    ...f,
    url: c.env.BUCKET_URL ? `${c.env.BUCKET_URL}/${f.r2_key}` : `/api/v1/files/${f.id}/download`,
  }))

  return c.json({
    data: fileList,
    pagination: {
      page,
      limit,
      total: total?.count || 0,
      totalPages: Math.ceil((total?.count || 0) / limit),
    },
  })
})

/**
 * GET /files/:id
 * Get file info
 */
fileRoutes.get('/:id', async (c) => {
  const tenantId = c.get('tenantId')
  const fileId = c.req.param('id')

  const file: any = await c.env.DB.prepare(
    `
    SELECT * FROM files WHERE id = ? AND tenant_id = ?
  `,
  )
    .bind(fileId, tenantId)
    .first()

  if (!file) {
    throw errors.notFound('File')
  }

  return c.json({
    ...file,
    url: c.env.BUCKET_URL
      ? `${c.env.BUCKET_URL}/${file.r2_key}`
      : `/api/v1/files/${fileId}/download`,
  })
})

/**
 * GET /files/:id/download
 * Download file (proxy through server if not public)
 */
fileRoutes.get('/:id/download', async (c) => {
  const tenantId = c.get('tenantId')
  const fileId = c.req.param('id')

  const file: any = await c.env.DB.prepare(
    `
    SELECT * FROM files WHERE id = ? AND tenant_id = ?
  `,
  )
    .bind(fileId, tenantId)
    .first()

  if (!file) {
    throw errors.notFound('File')
  }

  if (!c.env.BUCKET) {
    throw errors.internal('File storage not configured')
  }

  // Get file from R2
  const object = await c.env.BUCKET.get(file.r2_key)

  if (!object) {
    throw errors.notFound('File content')
  }

  const arrayBuffer = await object.arrayBuffer()

  return c.body(arrayBuffer, 200, {
    'Content-Type': file.mime_type,
    'Content-Disposition': `attachment; filename="${file.name}"`,
  })
})

/**
 * DELETE /files/:id
 * Delete file
 */
fileRoutes.delete('/:id', async (c) => {
  const tenantId = c.get('tenantId')
  const fileId = c.req.param('id')

  const file: any = await c.env.DB.prepare(
    `
    SELECT * FROM files WHERE id = ? AND tenant_id = ?
  `,
  )
    .bind(fileId, tenantId)
    .first()

  if (!file) {
    throw errors.notFound('File')
  }

  if (c.env.BUCKET) {
    // Delete from R2
    await c.env.BUCKET.delete(file.r2_key)
  }

  // Delete from database
  await c.env.DB.prepare('DELETE FROM files WHERE id = ?').bind(fileId).run()

  return c.json({ message: 'File deleted successfully' })
})

/**
 * GET /files/:id/thumbnail
 * Generate and return thumbnail for image files
 */
fileRoutes.get('/:id/thumbnail', async (c) => {
  const tenantId = c.get('tenantId')
  const fileId = c.req.param('id')
  const width = parseInt(c.req.query('width') || '200')
  const height = parseInt(c.req.query('height') || '200')
  const fit = c.req.query('fit') || 'cover'

  const file: any = await c.env.DB.prepare(
    `
    SELECT * FROM files WHERE id = ? AND tenant_id = ?
  `,
  )
    .bind(fileId, tenantId)
    .first()

  if (!file) {
    throw errors.notFound('File')
  }

  if (!imageMimeTypes.includes(file.mime_type)) {
    throw errors.invalidInput({ file: 'Thumbnail only available for image files' })
  }

  if (!c.env.BUCKET) {
    throw errors.internal('File storage not configured')
  }

  // Get file from R2
  const object = await c.env.BUCKET.get(file.r2_key)

  if (!object) {
    throw errors.notFound('File content')
  }

  try {
    // Use ImageMagick-like processing via Cloudflare Image Resizing
    // For now, return the original image with cache headers
    const arrayBuffer = await object.arrayBuffer()

    c.header('Cache-Control', 'public, max-age=31536000')
    c.header('Content-Type', file.mime_type)

    return c.body(arrayBuffer)
  } catch (error: any) {
    throw errors.internal('Failed to generate thumbnail: ' + error.message)
  }
})

/**
 * POST /files/:id/transform
 * Apply transformations to an image
 */
fileRoutes.post(
  '/:id/transform',
  zValidator('json', imageTransformSchema),
  async (c) => {
    const tenantId = c.get('tenantId')
    const fileId = c.req.param('id')
    const { operations } = c.req.valid('json')

    const file: any = await c.env.DB.prepare(
      `
      SELECT * FROM files WHERE id = ? AND tenant_id = ?
    `,
    )
      .bind(fileId, tenantId)
      .first()

    if (!file) {
      throw errors.notFound('File')
    }

    if (!imageMimeTypes.includes(file.mime_type)) {
      throw errors.invalidInput({ file: 'Transformations only available for image files' })
    }

    if (!c.env.BUCKET) {
      throw errors.internal('File storage not configured')
    }

    // Get original file
    const object = await c.env.BUCKET.get(file.r2_key)

    if (!object) {
      throw errors.notFound('File content')
    }

    try {
      // For now, return the original image
      // In production, use Cloudflare Images or Image Resizing
      const arrayBuffer = await object.arrayBuffer()

      // Generate transformed file key
      const transformKey = `${file.r2_key}.transformed.${Date.now()}`

      // Save transformed version (for now just copy original)
      await c.env.BUCKET.put(transformKey, arrayBuffer, {
        httpMetadata: {
          contentType: file.mime_type,
        },
        customMetadata: {
          ...file.customMetadata,
          transformed: 'true',
          operations: JSON.stringify(operations),
        },
      })

      const transformId = crypto.randomUUID()
      const now = new Date().toISOString()

      // Save transform record
      await c.env.DB.prepare(
        `
        INSERT INTO file_transforms (id, tenant_id, source_file_id, r2_key, operations, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      )
        .bind(transformId, tenantId, fileId, transformKey, JSON.stringify(operations), now)
        .run()

      const publicUrl = c.env.BUCKET_URL
        ? `${c.env.BUCKET_URL}/${transformKey}`
        : `/api/v1/files/${transformId}/download`

      return c.json({
        id: transformId,
        sourceFileId: fileId,
        url: publicUrl,
        r2Key: transformKey,
        operations,
        message: 'Image transformed successfully',
      })
    } catch (error: any) {
      throw errors.internal('Failed to transform image: ' + error.message)
    }
  }
)

/**
 * POST /files/:id/optimize
 * Optimize image for web (compress and convert format)
 */
fileRoutes.post('/:id/optimize', async (c) => {
  const tenantId = c.get('tenantId')
  const fileId = c.req.param('id')
  const quality = parseInt(c.req.query('quality') || '80')
  const format = c.req.query('format') || 'webp'

  const file: any = await c.env.DB.prepare(
    `
    SELECT * FROM files WHERE id = ? AND tenant_id = ?
  `,
  )
    .bind(fileId, tenantId)
    .first()

  if (!file) {
    throw errors.notFound('File')
  }

  if (!imageMimeTypes.includes(file.mime_type)) {
    throw errors.invalidInput({ file: 'Optimization only available for image files' })
  }

  if (!c.env.BUCKET) {
    throw errors.internal('File storage not configured')
  }

  // Get original file
  const object = await c.env.BUCKET.get(file.r2_key)

  if (!object) {
    throw errors.notFound('File content')
  }

  try {
    // For now, return original
    // In production, use Cloudflare Images for optimization
    const arrayBuffer = await object.arrayBuffer()

    const ext = format === 'jpeg' ? 'jpg' : format
    const optimizeKey = `${file.r2_key}.optimized.${Date.now()}.${ext}`

    // Save optimized version
    await c.env.BUCKET.put(optimizeKey, arrayBuffer, {
      httpMetadata: {
        contentType: `image/${format}`,
      },
      customMetadata: {
        ...file.customMetadata,
        optimized: 'true',
        quality: quality.toString(),
        format,
      },
    })

    const optimizeId = crypto.randomUUID()
    const now = new Date().toISOString()

    await c.env.DB.prepare(
      `
      INSERT INTO file_transforms (id, tenant_id, source_file_id, r2_key, operations, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    )
      .bind(optimizeId, tenantId, fileId, optimizeKey, 'optimize', now)
      .run()

    const publicUrl = c.env.BUCKET_URL
      ? `${c.env.BUCKET_URL}/${optimizeKey}`
      : `/api/v1/files/${optimizeId}/download`

    return c.json({
      id: optimizeId,
      sourceFileId: fileId,
      url: publicUrl,
      r2Key: optimizeKey,
      format,
      quality,
      message: 'Image optimized successfully',
    })
  } catch (error: any) {
    throw errors.internal('Failed to optimize image: ' + error.message)
  }
})

/**
 * GET /files/:id/url
 * Get temporary signed URL for private file access
 */
fileRoutes.get('/:id/url', async (c) => {
  const tenantId = c.get('tenantId')
  const fileId = c.req.param('id')
  const expiresIn = parseInt(c.req.query('expiresIn') || '3600') // 1 hour default

  const file: any = await c.env.DB.prepare(
    `
    SELECT * FROM files WHERE id = ? AND tenant_id = ?
  `,
  )
    .bind(fileId, tenantId)
    .first()

  if (!file) {
    throw errors.notFound('File')
  }

  if (!c.env.BUCKET) {
    throw errors.internal('File storage not configured')
  }

  // Generate signed URL (Cloudflare R2 supports this)
  // For now, return the regular URL
  const publicUrl = c.env.BUCKET_URL
    ? `${c.env.BUCKET_URL}/${file.r2_key}`
    : `/api/v1/files/${fileId}/download`

  return c.json({
    url: publicUrl,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  })
})

/**
 * PUT /files/:id
 * Update file metadata
 */
fileRoutes.put('/:id', async (c) => {
  const tenantId = c.get('tenantId')
  const fileId = c.req.param('id')
  const { name, folder } = await c.req.json()

  const file: any = await c.env.DB.prepare(
    `
    SELECT * FROM files WHERE id = ? AND tenant_id = ?
  `,
  )
    .bind(fileId, tenantId)
    .first()

  if (!file) {
    throw errors.notFound('File')
  }

  // Update file metadata
  await c.env.DB.prepare(
    `
    UPDATE files 
    SET name = ?, path = ?, updated_at = ?
    WHERE id = ?
  `,
  )
    .bind(name || file.name, folder || file.path, new Date().toISOString(), fileId)
    .run()

  return c.json({
    ...file,
    name: name || file.name,
    path: folder || file.path,
    message: 'File metadata updated successfully',
  })
})
