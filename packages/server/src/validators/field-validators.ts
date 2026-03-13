/**
 * Field Validators
 * Validation functions for all supported field types
 */

import { FieldConfig, FieldType } from '../utils/field-types'

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  value?: any
}

/**
 * Email regex pattern
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * URL regex pattern (supports http, https, ftp)
 */
const URL_REGEX = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i

/**
 * Phone regex pattern (supports international formats)
 */
const PHONE_REGEX = /^\+?[\d\s-()]{8,20}$/

/**
 * Text field validator
 * Validates string length and pattern
 */
export function textValidator(value: any, config?: FieldConfig): ValidationResult {
  const errors: string[] = []

  // Handle null/undefined
  if (value === null || value === undefined) {
    return { valid: true, errors: [], value: null }
  }

  // Type check
  if (typeof value !== 'string') {
    return { valid: false, errors: ['Value must be a string'], value }
  }

  // Min length validation
  if (config?.minLength !== undefined && value.length < config.minLength) {
    errors.push(`Text must be at least ${config.minLength} characters`)
  }

  // Max length validation
  if (config?.maxLength !== undefined && value.length > config.maxLength) {
    errors.push(`Text must be at most ${config.maxLength} characters`)
  }

  // Pattern validation
  if (config?.pattern) {
    try {
      const regex = new RegExp(config.pattern)
      if (!regex.test(value)) {
        errors.push(`Text does not match required pattern`)
      }
    } catch (e) {
      errors.push('Invalid pattern in field configuration')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    value: errors.length === 0 ? value : undefined,
  }
}

/**
 * Email field validator
 * Validates email format
 */
export function emailValidator(value: any, config?: FieldConfig): ValidationResult {
  const errors: string[] = []

  // Handle null/undefined
  if (value === null || value === undefined) {
    return { valid: true, errors: [], value: null }
  }

  // Type check
  if (typeof value !== 'string') {
    return { valid: false, errors: ['Value must be a string'], value }
  }

  // Email format validation
  if (!EMAIL_REGEX.test(value)) {
    errors.push('Invalid email format')
  }

  // Additional length constraints
  if (config?.maxLength !== undefined && value.length > config.maxLength) {
    errors.push(`Email must be at most ${config.maxLength} characters`)
  }

  return {
    valid: errors.length === 0,
    errors,
    value: errors.length === 0 ? value : undefined,
  }
}

/**
 * URL field validator
 * Validates URL format
 */
export function urlValidator(value: any, config?: FieldConfig): ValidationResult {
  const errors: string[] = []

  // Handle null/undefined
  if (value === null || value === undefined) {
    return { valid: true, errors: [], value: null }
  }

  // Type check
  if (typeof value !== 'string') {
    return { valid: false, errors: ['Value must be a string'], value }
  }

  // URL format validation
  if (!URL_REGEX.test(value)) {
    errors.push('Invalid URL format')
  }

  return {
    valid: errors.length === 0,
    errors,
    value: errors.length === 0 ? value : undefined,
  }
}

/**
 * Phone field validator
 * Validates phone number format
 */
export function phoneValidator(value: any, config?: FieldConfig): ValidationResult {
  const errors: string[] = []

  // Handle null/undefined
  if (value === null || value === undefined) {
    return { valid: true, errors: [], value: null }
  }

  // Type check
  if (typeof value !== 'string') {
    return { valid: false, errors: ['Value must be a string'], value }
  }

  // Phone format validation
  if (!PHONE_REGEX.test(value)) {
    errors.push('Invalid phone number format')
  }

  return {
    valid: errors.length === 0,
    errors,
    value: errors.length === 0 ? value : undefined,
  }
}

/**
 * Number field validator
 * Validates numeric value and range
 */
export function numberValidator(value: any, config?: FieldConfig): ValidationResult {
  const errors: string[] = []

  // Handle null/undefined
  if (value === null || value === undefined) {
    return { valid: true, errors: [], value: null }
  }

  // Type check (allow string numbers)
  let numValue: number
  if (typeof value === 'number') {
    numValue = value
  } else if (typeof value === 'string' && !isNaN(Number(value))) {
    numValue = Number(value)
  } else {
    return { valid: false, errors: ['Value must be a number'], value }
  }

  // Check for NaN
  if (isNaN(numValue)) {
    return { valid: false, errors: ['Value must be a valid number'], value }
  }

  // Min validation
  if (config?.min !== undefined && numValue < config.min) {
    errors.push(`Value must be at least ${config.min}`)
  }

  // Max validation
  if (config?.max !== undefined && numValue > config.max) {
    errors.push(`Value must be at most ${config.max}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    value: errors.length === 0 ? numValue : undefined,
  }
}

/**
 * Boolean field validator
 * Validates boolean value
 */
export function booleanValidator(value: any, config?: FieldConfig): ValidationResult {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return { valid: true, errors: [], value: null }
  }

  // Type check
  if (typeof value !== 'boolean') {
    // Allow string "true"/"false" and 0/1
    if (value === 'true' || value === '1' || value === 1) {
      return { valid: true, errors: [], value: true }
    }
    if (value === 'false' || value === '0' || value === 0) {
      return { valid: true, errors: [], value: false }
    }
    return { valid: false, errors: ['Value must be a boolean'], value }
  }

  return {
    valid: true,
    errors: [],
    value,
  }
}

/**
 * Date field validator
 * Validates date value
 */
export function dateValidator(value: any, config?: FieldConfig): ValidationResult {
  const errors: string[] = []

  // Handle null/undefined
  if (value === null || value === undefined) {
    return { valid: true, errors: [], value: null }
  }

  let dateValue: Date

  // Handle different input types
  if (value instanceof Date) {
    dateValue = value
  } else if (typeof value === 'string') {
    dateValue = new Date(value)
  } else if (typeof value === 'number') {
    dateValue = new Date(value)
  } else {
    return { valid: false, errors: ['Value must be a date'], value }
  }

  // Check for invalid date
  if (isNaN(dateValue.getTime())) {
    return { valid: false, errors: ['Invalid date value'], value }
  }

  return {
    valid: true,
    errors: [],
    value: dateValue,
  }
}

/**
 * JSON field validator
 * Validates JSON object/array
 */
export function jsonValidator(value: any, config?: FieldConfig): ValidationResult {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return { valid: true, errors: [], value: null }
  }

  // If it's already an object/array, it's valid
  if (typeof value === 'object') {
    return {
      valid: true,
      errors: [],
      value,
    }
  }

  // If it's a string, try to parse it
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return {
        valid: true,
        errors: [],
        value: parsed,
      }
    } catch (e) {
      return { valid: false, errors: ['Invalid JSON format'], value }
    }
  }

  return { valid: false, errors: ['Value must be a valid JSON object or array'], value }
}

/**
 * Select field validator
 * Validates single select value
 */
export function selectValidator(value: any, config?: FieldConfig): ValidationResult {
  const errors: string[] = []

  // Handle null/undefined
  if (value === null || value === undefined) {
    return { valid: true, errors: [], value: null }
  }

  // Type check
  if (typeof value !== 'string') {
    return { valid: false, errors: ['Value must be a string'], value }
  }

  // Check if value is in options
  if (config?.options && !config.options.includes(value)) {
    errors.push(`Value must be one of: ${config.options.join(', ')}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    value: errors.length === 0 ? value : undefined,
  }
}

/**
 * Multiselect field validator
 * Validates multiple select values
 */
export function multiselectValidator(value: any, config?: FieldConfig): ValidationResult {
  const errors: string[] = []

  // Handle null/undefined
  if (value === null || value === undefined) {
    return { valid: true, errors: [], value: null }
  }

  // Type check - must be array
  if (!Array.isArray(value)) {
    return { valid: false, errors: ['Value must be an array'], value }
  }

  // Check each value
  for (const item of value) {
    if (typeof item !== 'string') {
      errors.push('All values must be strings')
      break
    }
    if (config?.options && !config.options.includes(item)) {
      errors.push(`Value "${item}" is not a valid option`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    value: errors.length === 0 ? value : undefined,
  }
}

/**
 * Relation field validator
 * Validates relation field value (ID reference)
 */
export function relationValidator(value: any, config?: FieldConfig): ValidationResult {
  const errors: string[] = []

  // Handle null/undefined
  if (value === null || value === undefined) {
    return { valid: true, errors: [], value: null }
  }

  // Type check - relation should be a string ID or array of IDs
  if (typeof value !== 'string' && !Array.isArray(value)) {
    return { valid: false, errors: ['Value must be a string ID or array of IDs'], value }
  }

  // Validate ID format (basic check - should be non-empty string)
  if (typeof value === 'string' && value.trim() === '') {
    errors.push('Relation ID cannot be empty')
  }

  if (Array.isArray(value)) {
    for (const id of value) {
      if (typeof id !== 'string' || id.trim() === '') {
        errors.push('All relation IDs must be non-empty strings')
        break
      }
    }
  }

  // Note: Actual existence check of referenced record should be done at service layer
  // This validator only checks the format

  return {
    valid: errors.length === 0,
    errors,
    value: errors.length === 0 ? value : undefined,
  }
}

/**
 * Generic field validator
 * Routes to appropriate validator based on field type
 */
export function validateField(value: any, config: FieldConfig): ValidationResult {
  const validators: Record<FieldType, (value: any, config?: FieldConfig) => ValidationResult> = {
    text: textValidator,
    email: emailValidator,
    url: urlValidator,
    phone: phoneValidator,
    number: numberValidator,
    boolean: booleanValidator,
    date: dateValidator,
    json: jsonValidator,
    select: selectValidator,
    multiselect: multiselectValidator,
    relation: relationValidator,
  }

  const validator = validators[config.type]
  if (!validator) {
    return {
      valid: false,
      errors: [`Unknown field type: ${config.type}`],
      value,
    }
  }

  return validator(value, config)
}
