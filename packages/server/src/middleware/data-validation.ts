/**
 * Data Validation Middleware
 * Dynamically generates Zod schemas based on metadata_fields
 */

import { z } from 'zod';
import { Context, Next } from 'hono';
import { errors } from '../utils/errors';

export interface FieldMetadata {
  id: string;
  name: string;
  type: string;
  required: boolean;
  unique: boolean;
  defaultValue?: any;
  validation?: any;
}

export interface SchemaMetadata {
  id: string;
  name: string;
  fields: FieldMetadata[];
}

/**
 * Map field types to Zod schemas
 */
function getZodType(field: FieldMetadata): z.ZodTypeAny {
  const { type, validation } = field;

  let zodType: z.ZodTypeAny;

  switch (type) {
    case 'text':
    case 'string':
      zodType = z.string();
      if (validation?.min) {
        zodType = zodType.min(validation.min, `Minimum length is ${validation.min}`);
      }
      if (validation?.max) {
        zodType = zodType.max(validation.max, `Maximum length is ${validation.max}`);
      }
      if (validation?.pattern) {
        zodType = zodType.regex(
          new RegExp(validation.pattern),
          `Must match pattern: ${validation.pattern}`
        );
      }
      if (validation?.email) {
        zodType = zodType.email('Invalid email address');
      }
      if (validation?.url) {
        zodType = zodType.url('Invalid URL');
      }
      break;

    case 'number':
    case 'int':
      zodType = z.number();
      if (validation?.min !== undefined) {
        zodType = zodType.min(validation.min, `Minimum value is ${validation.min}`);
      }
      if (validation?.max !== undefined) {
        zodType = zodType.max(validation.max, `Maximum value is ${validation.max}`);
      }
      if (validation?.positive) {
        zodType = zodType.positive('Must be a positive number');
      }
      if (validation?.integer) {
        zodType = zodType.int('Must be an integer');
      }
      break;

    case 'boolean':
      zodType = z.boolean();
      break;

    case 'date':
      zodType = z.union([
        z.date(),
        z.string().transform((val) => new Date(val)),
      ]);
      if (validation?.minDate) {
        zodType = zodType.refine(
          (date) => date >= new Date(validation.minDate),
          `Date must be after ${validation.minDate}`
        );
      }
      if (validation?.maxDate) {
        zodType = zodType.refine(
          (date) => date <= new Date(validation.maxDate),
          `Date must be before ${validation.maxDate}`
        );
      }
      break;

    case 'json':
    case 'object':
      zodType = z.record(z.any());
      if (validation?.shape) {
        zodType = z.object(validation.shape);
      }
      break;

    case 'array':
      zodType = z.array(z.any());
      if (validation?.items) {
        zodType = z.array(getZodType({ ...field, type: validation.items.type }));
      }
      if (validation?.minItems) {
        zodType = zodType.min(validation.minItems, `Minimum ${validation.minItems} items`);
      }
      if (validation?.maxItems) {
        zodType = zodType.max(validation.maxItems, `Maximum ${validation.maxItems} items`);
      }
      break;

    case 'enum':
      if (validation?.values && Array.isArray(validation.values)) {
        zodType = z.enum(validation.values as [string, ...string[]]);
      } else {
        zodType = z.string();
      }
      break;

    case 'relation':
      zodType = z.string().uuid('Invalid relation ID');
      break;

    case 'file':
      zodType = z.string().url('Invalid file URL');
      break;

    case 'richtext':
      zodType = z.string();
      break;

    default:
      zodType = z.any();
  }

  return zodType;
}

/**
 * Build Zod schema from field metadata
 */
export function buildZodSchema(fields: FieldMetadata[]): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let zodType = getZodType(field);

    // Handle required vs optional
    if (field.required) {
      shape[field.name] = zodType;
    } else {
      // Optional fields can be undefined or null
      shape[field.name] = zodType.optional().nullable();
    }

    // Handle default values
    if (field.defaultValue !== undefined && !field.required) {
      shape[field.name] = shape[field.name].default(field.defaultValue);
    }
  }

  return z.object(shape);
}

/**
 * Type conversion middleware - converts string values to appropriate types
 */
export function typeConversionMiddleware() {
  return async (c: Context, next: Next) => {
    const body = await c.req.json().catch(() => null);
    
    if (!body || typeof body !== 'object') {
      return await next();
    }

    // Get schema metadata from context (set by previous middleware)
    const schemaMetadata: SchemaMetadata | undefined = c.get('schemaMetadata');
    
    if (!schemaMetadata) {
      return await next();
    }

    // Convert types based on field metadata
    const convertedBody: Record<string, any> = { ...body };

    for (const field of schemaMetadata.fields) {
      const value = convertedBody[field.name];
      
      if (value === undefined || value === null) continue;

      switch (field.type) {
        case 'number':
        case 'int':
          if (typeof value === 'string') {
            const num = parseFloat(value);
            if (!isNaN(num)) {
              convertedBody[field.name] = field.type === 'int' ? Math.round(num) : num;
            }
          }
          break;

        case 'boolean':
          if (typeof value === 'string') {
            convertedBody[field.name] = 
              value.toLowerCase() === 'true' || value === '1' || value === 'yes';
          }
          break;

        case 'date':
          if (typeof value === 'string') {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              convertedBody[field.name] = date;
            }
          }
          break;
      }
    }

    // Store converted body for later use
    c.set('convertedBody', convertedBody);

    await next();
  };
}

/**
 * Validation middleware - validates request body against dynamic schema
 */
export function validationMiddleware() {
  return async (c: Context, next: Next) => {
    const schemaMetadata: SchemaMetadata | undefined = c.get('schemaMetadata');
    
    if (!schemaMetadata) {
      return await next();
    }

    // Get body (may already be converted by typeConversionMiddleware)
    const body = c.get('convertedBody') || (await c.req.json().catch(() => null));

    if (!body) {
      return await next();
    }

    // Build and validate against schema
    const schema = buildZodSchema(schemaMetadata.fields);
    const result = schema.safeParse(body);

    if (!result.success) {
      const errorDetails = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      throw errors.invalidInput({
        fields: errorDetails,
        message: 'Validation failed',
      });
    }

    // Store validated data
    c.set('validatedData', result.data);

    await next();
  };
}

/**
 * Combined middleware - type conversion + validation
 */
export function dataValidationMiddleware() {
  return async (c: Context, next: Next) => {
    // First convert types
    await typeConversionMiddleware()(c, async () => {
      // Then validate
      await validationMiddleware()(c, next);
    });
  };
}

/**
 * Helper to load schema metadata from database
 */
export async function loadSchemaMetadata(
  db: any,
  schemaId: string,
  tenantId: string
): Promise<SchemaMetadata | null> {
  // Get schema definition
  const schema: any = await db.prepare(`
    SELECT * FROM collections 
    WHERE id = ? AND tenant_id = ?
  `).bind(schemaId, tenantId).first();

  if (!schema) {
    return null;
  }

  // Get field definitions
  const fields: any = await db.prepare(`
    SELECT * FROM collection_fields 
    WHERE collection_id = ?
    ORDER BY order_index, created_at
  `).bind(schemaId).all();

  const fieldMetadata: FieldMetadata[] = (fields.results || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    required: !!f.required,
    unique: !!f.unique,
    defaultValue: f.default_value ? JSON.parse(f.default_value) : undefined,
    validation: f.validation ? JSON.parse(f.validation) : undefined,
  }));

  return {
    id: schema.id,
    name: schema.name,
    fields: fieldMetadata,
  };
}

/**
 * Create validation middleware for a specific schema
 */
export function createSchemaValidator(schemaId: string) {
  return async (c: Context, next: Next) => {
    const tenantId = c.get('tenantId');
    const db = c.env.DB;

    // Load schema metadata
    const schemaMetadata = await loadSchemaMetadata(db, schemaId, tenantId);

    if (!schemaMetadata) {
      throw errors.notFound('Schema');
    }

    // Store in context for validation middleware
    c.set('schemaMetadata', schemaMetadata);

    // Run validation
    await dataValidationMiddleware()(c, next);
  };
}
