/**
 * Unit tests for AppError class hierarchy
 */
import { describe, it, expect } from 'vitest';
import { AppError, ErrorCode } from '../../server/utils/errors';

describe('AppError', () => {
  it('should create error with all properties', () => {
    const error = new AppError('Test error', 400, ErrorCode.BAD_REQUEST, true);
    
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe(ErrorCode.BAD_REQUEST);
    expect(error.isOperational).toBe(true);
    expect(error instanceof Error).toBe(true);
    expect(error instanceof AppError).toBe(true);
  });

  it('should default isOperational to true', () => {
    const error = new AppError('Test', 500, ErrorCode.INTERNAL_ERROR);
    
    expect(error.isOperational).toBe(true);
  });

  it('should support additional context data', () => {
    const error = new AppError('Test', 400, ErrorCode.BAD_REQUEST, true, {
      field: 'email',
      value: 'invalid',
    });
    
    expect((error as any).details).toEqual({
      field: 'email',
      value: 'invalid',
    });
  });

  it('should serialize to JSON correctly', () => {
    const error = new AppError('Test', 400, ErrorCode.BAD_REQUEST);
    const json = JSON.stringify(error);
    const parsed = JSON.parse(json);
    
    expect(parsed.error.message).toBe('Test');
    expect(parsed.error.code).toBe(ErrorCode.BAD_REQUEST);
  });

  it('should capture stack trace', () => {
    const error = new AppError('Test', 400, ErrorCode.BAD_REQUEST);
    
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('AppError');
  });
});

describe('ErrorCode', () => {
  it('should have all expected error codes', () => {
    expect(ErrorCode.BAD_REQUEST).toBe('BAD_REQUEST');
    expect(ErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
    expect(ErrorCode.FORBIDDEN).toBe('FORBIDDEN');
    expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
    expect(ErrorCode.CONFLICT).toBe('CONFLICT');
    expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    expect(ErrorCode.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE');
    expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
  });
});
