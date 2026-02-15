import { describe, it, expect } from 'vitest'
import { isValidUUID, errorMessage, isErrorWithCode, AppError, HttpStatus } from '../src/errors.js'

describe('isValidUUID', () => {
  it('returns true for valid UUID v4', () => {
    expect(isValidUUID('00000000-0000-4000-a000-000000000001')).toBe(true)
  })

  it('returns true for uppercase UUID', () => {
    expect(isValidUUID('A0B1C2D3-E4F5-6789-ABCD-EF0123456789')).toBe(true)
  })

  it('returns false for empty string', () => {
    expect(isValidUUID('')).toBe(false)
  })

  it('returns false for short string', () => {
    expect(isValidUUID('abc-123')).toBe(false)
  })

  it('returns false for wrong format', () => {
    expect(isValidUUID('not-a-valid-uuid-at-all-0000000')).toBe(false)
  })
})

describe('errorMessage', () => {
  it('returns message for Error instances', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
  })

  it('returns String(val) for non-Error', () => {
    expect(errorMessage(42)).toBe('42')
  })

  it('returns "null" for null', () => {
    expect(errorMessage(null)).toBe('null')
  })
})

describe('isErrorWithCode', () => {
  it('returns true for object with code string', () => {
    expect(isErrorWithCode({ code: 'P2002' })).toBe(true)
  })

  it('returns false for null', () => {
    expect(isErrorWithCode(null)).toBe(false)
  })

  it('returns false for string', () => {
    expect(isErrorWithCode('some string')).toBe(false)
  })

  it('returns false for object without code', () => {
    expect(isErrorWithCode({ message: 'no code here' })).toBe(false)
  })
})

describe('AppError', () => {
  it('creates with statusCode, message, details', () => {
    const err = new AppError(HttpStatus.BAD_REQUEST, 'bad', { field: 'x' })
    expect(err.statusCode).toBe(400)
    expect(err.message).toBe('bad')
    expect(err.details).toEqual({ field: 'x' })
  })

  it('is instanceof Error', () => {
    const err = new AppError(HttpStatus.INTERNAL_SERVER_ERROR, 'fail')
    expect(err).toBeInstanceOf(Error)
  })
})
