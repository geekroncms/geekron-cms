import { describe, expect, test } from 'bun:test'
import {
  FieldConfig,
  isPrimitiveType,
  isRelationType,
  supportsOptions,
  validateFieldConfig,
} from '../src/utils/field-types'
import {
  convertType,
  isEmpty,
  normalizeValue,
  stringToBoolean,
  stringToDate,
  stringToJson,
  stringToNumber,
  toArray,
  toString,
} from '../src/utils/type-converter'
import {
  booleanValidator,
  dateValidator,
  emailValidator,
  jsonValidator,
  multiselectValidator,
  numberValidator,
  phoneValidator,
  relationValidator,
  selectValidator,
  textValidator,
  urlValidator,
  validateField,
} from '../src/validators/field-validators'

describe('Field Types', () => {
  describe('validateFieldConfig', () => {
    test('should validate text field config', () => {
      const config: FieldConfig = {
        type: 'text',
        minLength: 5,
        maxLength: 100,
      }

      const result = validateFieldConfig(config)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('should reject invalid text config (minLength > maxLength)', () => {
      const config: FieldConfig = {
        type: 'text',
        minLength: 100,
        maxLength: 50,
      }

      const result = validateFieldConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('minLength cannot be greater than maxLength')
    })

    test('should validate number field config', () => {
      const config: FieldConfig = {
        type: 'number',
        min: 0,
        max: 100,
      }

      const result = validateFieldConfig(config)
      expect(result.valid).toBe(true)
    })

    test('should reject invalid number config (min > max)', () => {
      const config: FieldConfig = {
        type: 'number',
        min: 100,
        max: 50,
      }

      const result = validateFieldConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('min cannot be greater than max')
    })

    test('should validate select field with options', () => {
      const config: FieldConfig = {
        type: 'select',
        options: ['option1', 'option2', 'option3'],
      }

      const result = validateFieldConfig(config)
      expect(result.valid).toBe(true)
    })

    test('should reject select field without options', () => {
      const config: FieldConfig = {
        type: 'select',
      }

      const result = validateFieldConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Select fields must have at least one option')
    })

    test('should validate relation field config', () => {
      const config: FieldConfig = {
        type: 'relation',
        relation: {
          targetSchema: 'users',
          type: 'one-to-many',
        },
      }

      const result = validateFieldConfig(config)
      expect(result.valid).toBe(true)
    })

    test('should reject relation field without relation config', () => {
      const config: FieldConfig = {
        type: 'relation',
      }

      const result = validateFieldConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Relation fields must have relation configuration')
    })

    test('should reject relation field without targetSchema', () => {
      const config: FieldConfig = {
        type: 'relation',
        relation: {
          targetSchema: '',
          type: 'one-to-many',
        },
      }

      const result = validateFieldConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Relation must specify targetSchema')
    })

    test('should reject invalid relation type', () => {
      const config: FieldConfig = {
        type: 'relation',
        relation: {
          targetSchema: 'users',
          type: 'invalid' as any,
        },
      }

      const result = validateFieldConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Relation type must be one-to-many or many-to-many')
    })
  })

  describe('isPrimitiveType', () => {
    test('should return true for primitive types', () => {
      expect(isPrimitiveType('text')).toBe(true)
      expect(isPrimitiveType('number')).toBe(true)
      expect(isPrimitiveType('boolean')).toBe(true)
      expect(isPrimitiveType('date')).toBe(true)
      expect(isPrimitiveType('email')).toBe(true)
      expect(isPrimitiveType('url')).toBe(true)
      expect(isPrimitiveType('phone')).toBe(true)
    })

    test('should return false for non-primitive types', () => {
      expect(isPrimitiveType('json')).toBe(false)
      expect(isPrimitiveType('relation')).toBe(false)
      expect(isPrimitiveType('select')).toBe(false)
      expect(isPrimitiveType('multiselect')).toBe(false)
    })
  })

  describe('supportsOptions', () => {
    test('should return true for select and multiselect', () => {
      expect(supportsOptions('select')).toBe(true)
      expect(supportsOptions('multiselect')).toBe(true)
    })

    test('should return false for other types', () => {
      expect(supportsOptions('text')).toBe(false)
      expect(supportsOptions('number')).toBe(false)
      expect(supportsOptions('relation')).toBe(false)
    })
  })

  describe('isRelationType', () => {
    test('should return true for relation type', () => {
      expect(isRelationType('relation')).toBe(true)
    })

    test('should return false for other types', () => {
      expect(isRelationType('text')).toBe(false)
      expect(isRelationType('number')).toBe(false)
    })
  })
})

describe('Field Validators', () => {
  describe('textValidator', () => {
    test('should validate valid text', () => {
      const result = textValidator('Hello World')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('should reject non-string values', () => {
      const result = textValidator(123)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Value must be a string')
    })

    test('should validate minLength', () => {
      const result = textValidator('Hi', { type: 'text', minLength: 5 })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Text must be at least 5 characters')
    })

    test('should validate maxLength', () => {
      const result = textValidator('Very long text', { type: 'text', maxLength: 5 })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Text must be at most 5 characters')
    })

    test('should validate pattern', () => {
      const result = textValidator('abc123', { type: 'text', pattern: '^[a-z]+$' })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Text does not match required pattern')
    })

    test('should handle null/undefined', () => {
      expect(textValidator(null).valid).toBe(true)
      expect(textValidator(undefined).valid).toBe(true)
    })
  })

  describe('emailValidator', () => {
    test('should validate valid email', () => {
      const result = emailValidator('test@example.com')
      expect(result.valid).toBe(true)
    })

    test('should reject invalid email', () => {
      const result = emailValidator('invalid-email')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid email format')
    })

    test('should handle null/undefined', () => {
      expect(emailValidator(null).valid).toBe(true)
      expect(emailValidator(undefined).valid).toBe(true)
    })
  })

  describe('urlValidator', () => {
    test('should validate valid URL', () => {
      expect(urlValidator('https://example.com').valid).toBe(true)
      expect(urlValidator('http://example.com/path').valid).toBe(true)
      expect(urlValidator('ftp://files.example.com').valid).toBe(true)
    })

    test('should reject invalid URL', () => {
      const result = urlValidator('not-a-url')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid URL format')
    })

    test('should handle null/undefined', () => {
      expect(urlValidator(null).valid).toBe(true)
    })
  })

  describe('phoneValidator', () => {
    test('should validate valid phone numbers', () => {
      expect(phoneValidator('+1 234 567 8900').valid).toBe(true)
      expect(phoneValidator('123-456-7890').valid).toBe(true)
      expect(phoneValidator('+86 186 6685 3325').valid).toBe(true)
    })

    test('should reject invalid phone numbers', () => {
      const result = phoneValidator('123')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid phone number format')
    })

    test('should handle null/undefined', () => {
      expect(phoneValidator(null).valid).toBe(true)
    })
  })

  describe('numberValidator', () => {
    test('should validate valid numbers', () => {
      expect(numberValidator(42).valid).toBe(true)
      expect(numberValidator('42').valid).toBe(true)
      expect(numberValidator(3.14).valid).toBe(true)
    })

    test('should reject non-numeric values', () => {
      const result = numberValidator('not-a-number')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Value must be a number')
    })

    test('should validate min', () => {
      const result = numberValidator(5, { type: 'number', min: 10 })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Value must be at least 10')
    })

    test('should validate max', () => {
      const result = numberValidator(100, { type: 'number', max: 50 })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Value must be at most 50')
    })

    test('should handle null/undefined', () => {
      expect(numberValidator(null).valid).toBe(true)
    })
  })

  describe('booleanValidator', () => {
    test('should validate boolean values', () => {
      expect(booleanValidator(true).valid).toBe(true)
      expect(booleanValidator(false).valid).toBe(true)
    })

    test('should convert string booleans', () => {
      expect(booleanValidator('true').value).toBe(true)
      expect(booleanValidator('false').value).toBe(false)
      expect(booleanValidator('1').value).toBe(true)
      expect(booleanValidator('0').value).toBe(false)
    })

    test('should convert numeric booleans', () => {
      expect(booleanValidator(1).value).toBe(true)
      expect(booleanValidator(0).value).toBe(false)
    })

    test('should reject invalid values', () => {
      const result = booleanValidator('maybe')
      expect(result.valid).toBe(false)
    })

    test('should handle null/undefined', () => {
      expect(booleanValidator(null).valid).toBe(true)
    })
  })

  describe('dateValidator', () => {
    test('should validate Date objects', () => {
      const result = dateValidator(new Date())
      expect(result.valid).toBe(true)
    })

    test('should validate ISO date strings', () => {
      const result = dateValidator('2024-01-15T10:30:00Z')
      expect(result.valid).toBe(true)
    })

    test('should validate timestamps', () => {
      const result = dateValidator(Date.now())
      expect(result.valid).toBe(true)
    })

    test('should reject invalid dates', () => {
      const result = dateValidator('not-a-date')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid date value')
    })

    test('should handle null/undefined', () => {
      expect(dateValidator(null).valid).toBe(true)
    })
  })

  describe('jsonValidator', () => {
    test('should validate JSON objects', () => {
      const result = jsonValidator({ key: 'value' })
      expect(result.valid).toBe(true)
    })

    test('should validate JSON arrays', () => {
      const result = jsonValidator([1, 2, 3])
      expect(result.valid).toBe(true)
    })

    test('should parse JSON strings', () => {
      const result = jsonValidator('{"key": "value"}')
      expect(result.valid).toBe(true)
      expect(result.value).toEqual({ key: 'value' })
    })

    test('should reject invalid JSON', () => {
      const result = jsonValidator('{invalid: json}')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid JSON format')
    })

    test('should handle null/undefined', () => {
      expect(jsonValidator(null).valid).toBe(true)
    })
  })

  describe('selectValidator', () => {
    test('should validate valid option', () => {
      const result = selectValidator('option1', {
        type: 'select',
        options: ['option1', 'option2'],
      })
      expect(result.valid).toBe(true)
    })

    test('should reject invalid option', () => {
      const result = selectValidator('option3', {
        type: 'select',
        options: ['option1', 'option2'],
      })
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Value must be one of')
    })

    test('should handle null/undefined', () => {
      expect(selectValidator(null).valid).toBe(true)
    })
  })

  describe('multiselectValidator', () => {
    test('should validate valid options', () => {
      const result = multiselectValidator(['option1', 'option2'], {
        type: 'multiselect',
        options: ['option1', 'option2', 'option3'],
      })
      expect(result.valid).toBe(true)
    })

    test('should reject non-array values', () => {
      const result = multiselectValidator('option1', {
        type: 'multiselect',
        options: ['option1', 'option2'],
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Value must be an array')
    })

    test('should reject invalid options', () => {
      const result = multiselectValidator(['option1', 'option4'], {
        type: 'multiselect',
        options: ['option1', 'option2', 'option3'],
      })
      expect(result.valid).toBe(false)
    })

    test('should handle null/undefined', () => {
      expect(multiselectValidator(null).valid).toBe(true)
    })
  })

  describe('relationValidator', () => {
    test('should validate string ID', () => {
      const result = relationValidator('user-123')
      expect(result.valid).toBe(true)
    })

    test('should validate array of IDs', () => {
      const result = relationValidator(['user-123', 'user-456'])
      expect(result.valid).toBe(true)
    })

    test('should reject empty string', () => {
      const result = relationValidator('')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Relation ID cannot be empty')
    })

    test('should handle null/undefined', () => {
      expect(relationValidator(null).valid).toBe(true)
    })
  })

  describe('validateField (generic)', () => {
    test('should route to correct validator based on type', () => {
      // Text validation
      expect(validateField('hello', { type: 'text' }).valid).toBe(true)

      // Number validation
      expect(validateField(42, { type: 'number' }).valid).toBe(true)

      // Email validation
      expect(validateField('test@example.com', { type: 'email' }).valid).toBe(true)

      // Boolean validation
      expect(validateField(true, { type: 'boolean' }).valid).toBe(true)
    })

    test('should reject unknown field types', () => {
      const result = validateField('value', { type: 'unknown' as any })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Unknown field type: unknown')
    })
  })
})

describe('Type Converter', () => {
  describe('stringToNumber', () => {
    test('should convert valid number strings', () => {
      expect(stringToNumber('42')).toBe(42)
      expect(stringToNumber('3.14')).toBe(3.14)
      expect(stringToNumber('-10')).toBe(-10)
    })

    test('should handle already numeric values', () => {
      expect(stringToNumber(42)).toBe(42)
      expect(stringToNumber(3.14)).toBe(3.14)
    })

    test('should return null for invalid strings', () => {
      expect(stringToNumber('not-a-number')).toBe(null)
      expect(stringToNumber('')).toBe(null)
      expect(stringToNumber('   ')).toBe(null)
    })

    test('should handle null/undefined', () => {
      expect(stringToNumber(null)).toBe(null)
      expect(stringToNumber(undefined)).toBe(null)
    })
  })

  describe('stringToBoolean', () => {
    test('should convert truthy strings', () => {
      expect(stringToBoolean('true')).toBe(true)
      expect(stringToBoolean('1')).toBe(true)
      expect(stringToBoolean('yes')).toBe(true)
      expect(stringToBoolean('on')).toBe(true)
    })

    test('should convert falsy strings', () => {
      expect(stringToBoolean('false')).toBe(false)
      expect(stringToBoolean('0')).toBe(false)
      expect(stringToBoolean('no')).toBe(false)
      expect(stringToBoolean('off')).toBe(false)
    })

    test('should handle boolean values', () => {
      expect(stringToBoolean(true)).toBe(true)
      expect(stringToBoolean(false)).toBe(false)
    })

    test('should return null for invalid strings', () => {
      expect(stringToBoolean('maybe')).toBe(null)
      expect(stringToBoolean('invalid')).toBe(null)
    })

    test('should handle null/undefined', () => {
      expect(stringToBoolean(null)).toBe(null)
      expect(stringToBoolean(undefined)).toBe(null)
    })
  })

  describe('stringToDate', () => {
    test('should convert ISO date strings', () => {
      const result = stringToDate('2024-01-15T10:30:00Z')
      expect(result).toBeInstanceOf(Date)
      expect(result?.getFullYear()).toBe(2024)
    })

    test('should convert timestamps', () => {
      const now = Date.now()
      const result = stringToDate(now)
      expect(result?.getTime()).toBe(now)
    })

    test('should handle Date objects', () => {
      const date = new Date()
      const result = stringToDate(date)
      expect(result).toBe(date)
    })

    test('should return null for invalid dates', () => {
      expect(stringToDate('not-a-date')).toBe(null)
      expect(stringToDate('')).toBe(null)
    })

    test('should handle null/undefined', () => {
      expect(stringToDate(null)).toBe(null)
      expect(stringToDate(undefined)).toBe(null)
    })
  })

  describe('stringToJson', () => {
    test('should parse valid JSON strings', () => {
      const result = stringToJson('{"key": "value"}')
      expect(result).toEqual({ key: 'value' })
    })

    test('should handle arrays', () => {
      const result = stringToJson('[1, 2, 3]')
      expect(result).toEqual([1, 2, 3])
    })

    test('should return objects as-is', () => {
      const obj = { key: 'value' }
      expect(stringToJson(obj)).toBe(obj)
    })

    test('should return null for invalid JSON', () => {
      expect(stringToJson('{invalid: json}')).toBe(null)
      expect(stringToJson('')).toBe(null)
    })

    test('should handle null/undefined', () => {
      expect(stringToJson(null)).toBe(null)
      expect(stringToJson(undefined)).toBe(null)
    })
  })

  describe('toString', () => {
    test('should convert primitives to strings', () => {
      expect(toString(42)).toBe('42')
      expect(toString(true)).toBe('true')
      expect(toString(3.14)).toBe('3.14')
    })

    test('should convert objects to JSON strings', () => {
      expect(toString({ key: 'value' })).toBe('{"key":"value"}')
    })

    test('should return strings as-is', () => {
      expect(toString('hello')).toBe('hello')
    })

    test('should handle null/undefined', () => {
      expect(toString(null)).toBe(null)
      expect(toString(undefined)).toBe(null)
    })
  })

  describe('toArray', () => {
    test('should wrap single values in array', () => {
      expect(toArray('hello')).toEqual(['hello'])
      expect(toArray(42)).toEqual([42])
    })

    test('should return arrays as-is', () => {
      const arr = [1, 2, 3]
      expect(toArray(arr)).toBe(arr)
    })

    test('should handle null/undefined', () => {
      expect(toArray(null)).toBe(null)
      expect(toArray(undefined)).toBe(null)
    })
  })

  describe('convertType', () => {
    test('should convert to text', () => {
      expect(convertType<string>(42, 'text')).toBe('42')
    })

    test('should convert to number', () => {
      expect(convertType<number>('42', 'number')).toBe(42)
    })

    test('should convert to boolean', () => {
      expect(convertType<boolean>('true', 'boolean')).toBe(true)
    })

    test('should convert to date', () => {
      const result = convertType<Date>('2024-01-15T10:30:00Z', 'date')
      expect(result).toBeInstanceOf(Date)
    })

    test('should convert to json', () => {
      expect(convertType('{"key": "value"}', 'json')).toEqual({ key: 'value' })
    })

    test('should convert to array', () => {
      expect(convertType('hello', 'array')).toEqual(['hello'])
    })
  })

  describe('normalizeValue', () => {
    test('should normalize numbers', () => {
      expect(normalizeValue('42', 'number')).toBe(42)
    })

    test('should normalize booleans', () => {
      expect(normalizeValue('true', 'boolean')).toBe(true)
    })

    test('should normalize dates to ISO string', () => {
      const result = normalizeValue('2024-01-15T10:30:00Z', 'date')
      expect(result).toBe('2024-01-15T10:30:00.000Z')
    })

    test('should normalize JSON', () => {
      expect(normalizeValue('{"key": "value"}', 'json')).toEqual({ key: 'value' })
    })

    test('should handle null values', () => {
      expect(normalizeValue(null, 'text')).toBe(null)
    })
  })

  describe('isEmpty', () => {
    test('should return true for null/undefined', () => {
      expect(isEmpty(null)).toBe(true)
      expect(isEmpty(undefined)).toBe(true)
    })

    test('should return true for empty strings', () => {
      expect(isEmpty('')).toBe(true)
      expect(isEmpty('   ')).toBe(true)
    })

    test('should return true for empty arrays', () => {
      expect(isEmpty([])).toBe(true)
    })

    test('should return true for empty objects', () => {
      expect(isEmpty({})).toBe(true)
    })

    test('should return false for non-empty values', () => {
      expect(isEmpty('hello')).toBe(false)
      expect(isEmpty([1])).toBe(false)
      expect(isEmpty({ key: 'value' })).toBe(false)
      expect(isEmpty(0)).toBe(false)
      expect(isEmpty(false)).toBe(false)
    })
  })
})

describe('Edge Cases', () => {
  test('should handle very long text', () => {
    const longText = 'a'.repeat(10000)
    const result = textValidator(longText, { type: 'text', maxLength: 1000 })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('at most 1000 characters')
  })

  test('should handle very large numbers', () => {
    const result = numberValidator(Number.MAX_SAFE_INTEGER)
    expect(result.valid).toBe(true)
  })

  test('should handle special characters in text', () => {
    const specialText = 'Hello 世界！🚀 @#$%^&*()'
    const result = textValidator(specialText)
    expect(result.valid).toBe(true)
  })

  test('should handle unicode in email', () => {
    // Basic email regex doesn't support international domains
    // This is expected behavior - production should use a more comprehensive validator
    const result = emailValidator('test@例子。测试')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Invalid email format')
  })

  test('should handle timezone in dates', () => {
    const result = dateValidator('2024-01-15T10:30:00+08:00')
    expect(result.valid).toBe(true)
  })

  test('should handle nested JSON', () => {
    const nestedJson = {
      user: {
        name: 'John',
        address: {
          city: 'New York',
          zip: '10001',
        },
      },
    }
    const result = jsonValidator(nestedJson)
    expect(result.valid).toBe(true)
  })

  test('should handle empty select options array', () => {
    const result = selectValidator('', { type: 'select', options: [] })
    expect(result.valid).toBe(false)
  })

  test('should handle mixed type arrays in multiselect', () => {
    const result = multiselectValidator(['opt1', 123], {
      type: 'multiselect',
      options: ['opt1', 'opt2'],
    })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('must be strings')
  })
})
