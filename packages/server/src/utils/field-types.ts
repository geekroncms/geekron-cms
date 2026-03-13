/**
 * Field Type Definitions
 * Defines all supported field types and their configurations for the data model engine
 */

/**
 * Supported field types
 */
export type FieldType =
  | 'text' // 文本
  | 'number' // 数字
  | 'boolean' // 布尔
  | 'date' // 日期时间
  | 'json' // JSON 对象
  | 'relation' // 关系字段
  | 'email' // 邮箱
  | 'url' // URL
  | 'phone' // 电话
  | 'select' // 单选
  | 'multiselect' // 多选

/**
 * Relation field configuration
 */
export interface RelationConfig {
  targetSchema: string
  type: 'one-to-many' | 'many-to-many'
}

/**
 * Field configuration interface
 * Defines validation rules and options for each field type
 */
export interface FieldConfig {
  type: FieldType

  // Text validation
  minLength?: number
  maxLength?: number
  pattern?: string // 正则表达式

  // Number validation
  min?: number // 数字最小值
  max?: number // 数字最大值

  // Select validation
  options?: string[] // select/multiselect 选项

  // Relation configuration
  relation?: RelationConfig
}

/**
 * Default field configurations for each type
 */
export const defaultFieldConfigs: Record<FieldType, FieldConfig> = {
  text: { type: 'text' },
  number: { type: 'number' },
  boolean: { type: 'boolean' },
  date: { type: 'date' },
  json: { type: 'json' },
  relation: { type: 'relation' },
  email: { type: 'email' },
  url: { type: 'url' },
  phone: { type: 'phone' },
  select: { type: 'select' },
  multiselect: { type: 'multiselect' },
}

/**
 * Check if a field type is a primitive type (not relation or complex)
 */
export function isPrimitiveType(type: FieldType): boolean {
  const primitiveTypes: FieldType[] = ['text', 'number', 'boolean', 'date', 'email', 'url', 'phone']
  return primitiveTypes.includes(type)
}

/**
 * Check if a field type supports options
 */
export function supportsOptions(type: FieldType): boolean {
  return type === 'select' || type === 'multiselect'
}

/**
 * Check if a field type is a relation type
 */
export function isRelationType(type: FieldType): boolean {
  return type === 'relation'
}

/**
 * Validate field configuration
 */
export function validateFieldConfig(config: FieldConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check required type
  if (!config.type) {
    errors.push('Field type is required')
    return { valid: false, errors }
  }

  // Validate text-specific config
  if (
    config.type === 'text' ||
    config.type === 'email' ||
    config.type === 'url' ||
    config.type === 'phone'
  ) {
    if (config.minLength !== undefined && config.maxLength !== undefined) {
      if (config.minLength > config.maxLength) {
        errors.push('minLength cannot be greater than maxLength')
      }
    }
    if (config.minLength !== undefined && config.minLength < 0) {
      errors.push('minLength must be non-negative')
    }
  }

  // Validate number-specific config
  if (config.type === 'number') {
    if (config.min !== undefined && config.max !== undefined) {
      if (config.min > config.max) {
        errors.push('min cannot be greater than max')
      }
    }
  }

  // Validate select-specific config
  if (config.type === 'select' || config.type === 'multiselect') {
    if (!config.options || config.options.length === 0) {
      errors.push('Select fields must have at least one option')
    }
  }

  // Validate relation-specific config
  if (config.type === 'relation') {
    if (!config.relation) {
      errors.push('Relation fields must have relation configuration')
    } else if (!config.relation.targetSchema) {
      errors.push('Relation must specify targetSchema')
    } else if (!['one-to-many', 'many-to-many'].includes(config.relation.type)) {
      errors.push('Relation type must be one-to-many or many-to-many')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
