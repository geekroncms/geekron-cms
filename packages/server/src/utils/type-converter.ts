/**
 * Type Converter Utilities
 * Convert string values to appropriate types for field processing
 */

/**
 * Convert string to number
 * Returns null for null/undefined, NaN for invalid strings
 */
export function stringToNumber(value: string | number | null | undefined): number | null {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }

  // Already a number
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }

  // Convert string to number
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  const num = Number(trimmed);
  return isNaN(num) ? null : num;
}

/**
 * Convert string to boolean
 * Supports: 'true', 'false', '1', '0', 'yes', 'no', 'on', 'off'
 */
export function stringToBoolean(value: string | boolean | null | undefined): boolean | null {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }

  // Already a boolean
  if (typeof value === 'boolean') {
    return value;
  }

  // Handle number
  if (typeof value === 'number') {
    return value !== 0;
  }

  // Convert string to boolean
  const trimmed = value.trim().toLowerCase();

  // Truthy values
  if (['true', '1', 'yes', 'on', 'y'].includes(trimmed)) {
    return true;
  }

  // Falsy values
  if (['false', '0', 'no', 'off', 'n', ''].includes(trimmed)) {
    return false;
  }

  // Invalid string - return null
  return null;
}

/**
 * Convert string to Date
 * Supports ISO 8601, Unix timestamps, and common date formats
 */
export function stringToDate(value: string | number | Date | null | undefined): Date | null {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }

  // Already a Date
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // Handle number (Unix timestamp in seconds or milliseconds)
  if (typeof value === 'number') {
    // If timestamp is in seconds (< year 2100 in seconds), convert to milliseconds
    const timestamp = value < 10000000000 ? value * 1000 : value;
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? null : date;
  }

  // Convert string to Date
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }

    // Try parsing as ISO 8601 or other standard formats
    const date = new Date(trimmed);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/**
 * Convert string to JSON
 * Parses JSON string or returns the value if already an object
 */
export function stringToJson<T = any>(value: string | object | null | undefined): T | null {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }

  // Already an object/array
  if (typeof value === 'object') {
    return value as T;
  }

  // Convert string to JSON
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }

    try {
      return JSON.parse(trimmed) as T;
    } catch (e) {
      // Invalid JSON
      return null;
    }
  }

  return null;
}

/**
 * Convert value to string
 * Handles all types including null/undefined
 */
export function toString(value: any): string | null {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }

  // Already a string
  if (typeof value === 'string') {
    return value;
  }

  // Convert objects to JSON string
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }

  // Convert primitives to string
  return String(value);
}

/**
 * Convert value to array
 * Wraps single values in array, keeps arrays as-is
 */
export function toArray<T>(value: T | T[] | null | undefined): T[] | null {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }

  // Already an array
  if (Array.isArray(value)) {
    return value;
  }

  // Wrap single value in array
  return [value];
}

/**
 * Smart type conversion based on target type
 * Converts any input value to the specified type
 */
export function convertType<T = any>(
  value: any,
  targetType: 'text' | 'number' | 'boolean' | 'date' | 'json' | 'array',
): T | null {
  switch (targetType) {
    case 'text':
      return toString(value) as T;
    case 'number':
      return stringToNumber(value) as T;
    case 'boolean':
      return stringToBoolean(value) as T;
    case 'date':
      return stringToDate(value) as T;
    case 'json':
      return stringToJson<T>(value);
    case 'array':
      return toArray<T>(value) as T;
    default:
      return null;
  }
}

/**
 * Normalize value based on field type
 * Ensures consistent representation of values
 */
export function normalizeValue(value: any, fieldType: string): any {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }

  switch (fieldType) {
    case 'number':
      return stringToNumber(value);
    case 'boolean':
      return stringToBoolean(value);
    case 'date':
      const date = stringToDate(value);
      return date ? date.toISOString() : null;
    case 'json':
      return stringToJson(value);
    case 'text':
    case 'email':
    case 'url':
    case 'phone':
      return toString(value);
    case 'select':
    case 'multiselect':
    case 'relation':
      return value;
    default:
      return value;
  }
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim() === '';
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }

  return false;
}
