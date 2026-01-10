// API Error Handling Utilities
// src/lib/api/errors.ts

import { NextResponse } from 'next/server';

// Standard error codes
export const ErrorCodes = {
  // Client errors
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface APIError {
  success: false;
  error: string;
  code?: ErrorCode;
  details?: string;
  field?: string;
  timestamp?: string;
}

export interface APISuccess<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

export type APIResponse<T = unknown> = APISuccess<T> | APIError;

/**
 * Create a standardized error response
 */
export function errorResponse(
  message: string,
  statusCode: number,
  options: {
    code?: ErrorCode;
    details?: string;
    field?: string;
  } = {}
): NextResponse<APIError> {
  const { code, details, field } = options;

  const errorBody: APIError = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  };

  if (code) errorBody.code = code;
  if (details) errorBody.details = details;
  if (field) errorBody.field = field;

  return NextResponse.json(errorBody, { status: statusCode });
}

/**
 * Create a standardized success response
 */
export function successResponse<T>(
  data?: T,
  options: {
    message?: string;
    statusCode?: number;
  } = {}
): NextResponse<APISuccess<T>> {
  const { message, statusCode = 200 } = options;

  const body: APISuccess<T> = {
    success: true,
  };

  if (data !== undefined) body.data = data;
  if (message) body.message = message;

  return NextResponse.json(body, { status: statusCode });
}

// Pre-built error responses
export const Errors = {
  // 400 Bad Request
  badRequest: (message = 'Bad request', details?: string) =>
    errorResponse(message, 400, { code: ErrorCodes.BAD_REQUEST, details }),

  validationError: (message: string, field?: string) =>
    errorResponse(message, 400, { code: ErrorCodes.VALIDATION_ERROR, field }),

  missingField: (field: string) =>
    errorResponse(`Missing required field: ${field}`, 400, {
      code: ErrorCodes.VALIDATION_ERROR,
      field,
    }),

  invalidFormat: (field: string, expected: string) =>
    errorResponse(`Invalid format for ${field}. Expected: ${expected}`, 400, {
      code: ErrorCodes.VALIDATION_ERROR,
      field,
    }),

  // 401 Unauthorized
  unauthorized: (message = 'Authentication required') =>
    errorResponse(message, 401, { code: ErrorCodes.UNAUTHORIZED }),

  invalidUserId: () =>
    errorResponse('Valid user ID required', 401, { code: ErrorCodes.UNAUTHORIZED }),

  // 403 Forbidden
  forbidden: (message = 'Access denied') =>
    errorResponse(message, 403, { code: ErrorCodes.FORBIDDEN }),

  // 404 Not Found
  notFound: (resource = 'Resource') =>
    errorResponse(`${resource} not found`, 404, { code: ErrorCodes.NOT_FOUND }),

  // 429 Rate Limited
  rateLimited: (retryAfter?: number) =>
    NextResponse.json(
      {
        success: false,
        error: 'Rate limit exceeded',
        code: ErrorCodes.RATE_LIMITED,
        retryAfter,
        timestamp: new Date().toISOString(),
      },
      {
        status: 429,
        headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined,
      }
    ),

  // 500 Internal Server Error
  internal: (message = 'Internal server error', details?: string) =>
    errorResponse(message, 500, { code: ErrorCodes.INTERNAL_ERROR, details }),

  databaseError: (details?: string) =>
    errorResponse('Database error', 500, { code: ErrorCodes.DATABASE_ERROR, details }),

  aiServiceError: (details?: string) =>
    errorResponse('AI service error', 500, { code: ErrorCodes.AI_SERVICE_ERROR, details }),

  externalServiceError: (service: string, details?: string) =>
    errorResponse(`External service error: ${service}`, 500, {
      code: ErrorCodes.EXTERNAL_SERVICE_ERROR,
      details,
    }),

  configurationError: (details?: string) =>
    errorResponse('Server configuration error', 500, {
      code: ErrorCodes.CONFIGURATION_ERROR,
      details,
    }),
};

/**
 * Handle errors in API routes with consistent logging
 */
export function handleApiError(
  error: unknown,
  context: string,
  options: {
    logError?: boolean;
    includeDetails?: boolean;
  } = {}
): NextResponse<APIError> {
  const { logError = true, includeDetails = process.env.NODE_ENV === 'development' } = options;

  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorStack = error instanceof Error ? error.stack : undefined;

  if (logError) {
    console.error(`[API Error] ${context}:`, {
      message: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString(),
    });
  }

  return errorResponse(
    'An error occurred',
    500,
    {
      code: ErrorCodes.INTERNAL_ERROR,
      details: includeDetails ? errorMessage : undefined,
    }
  );
}

/**
 * Wrapper for async API route handlers with error handling
 */
export function withErrorHandling<T>(
  handler: () => Promise<NextResponse<T>>,
  context: string
): Promise<NextResponse<T | APIError>> {
  return handler().catch((error) => handleApiError(error, context));
}

/**
 * Check if response is an error response
 */
export function isErrorResponse(response: APIResponse): response is APIError {
  return response.success === false;
}

/**
 * Check if response is a success response
 */
export function isSuccessResponse<T>(response: APIResponse<T>): response is APISuccess<T> {
  return response.success === true;
}
