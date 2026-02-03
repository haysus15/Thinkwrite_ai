// API Validation Utilities
// src/lib/api/validation.ts

import { NextResponse } from 'next/server';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate that a string is a valid UUID
 */
export function isValidUUID(value: string | null | undefined): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * Validate and return user ID or error response
 */
export function validateUserId(userId: string | null | undefined): {
  valid: boolean;
  userId?: string;
  error?: NextResponse;
} {
  if (!userId) {
    return {
      valid: false,
      error: NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 401 }
      ),
    };
  }

  if (!isValidUUID(userId)) {
    return {
      valid: false,
      error: NextResponse.json(
        { success: false, error: 'Invalid user ID format' },
        { status: 400 }
      ),
    };
  }

  return { valid: true, userId };
}

/**
 * Validate required fields in a request body
 */
export function validateRequiredFields<T extends Record<string, unknown>>(
  body: T,
  requiredFields: (keyof T)[]
): { valid: boolean; missing: string[]; error?: NextResponse } {
  const missing: string[] = [];

  for (const field of requiredFields) {
    const value = body[field];
    if (value === undefined || value === null || value === '') {
      missing.push(String(field));
    }
  }

  if (missing.length > 0) {
    return {
      valid: false,
      missing,
      error: NextResponse.json(
        {
          success: false,
          error: `Missing required fields: ${missing.join(', ')}`,
        },
        { status: 400 }
      ),
    };
  }

  return { valid: true, missing: [] };
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize string input (basic XSS prevention)
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

/**
 * Validate pagination parameters
 */
export function validatePagination(
  page: string | null,
  limit: string | null,
  maxLimit = 100
): { page: number; limit: number; offset: number } {
  const parsedPage = Math.max(1, parseInt(page || '1', 10) || 1);
  const parsedLimit = Math.min(maxLimit, Math.max(1, parseInt(limit || '20', 10) || 20));
  const offset = (parsedPage - 1) * parsedLimit;

  return { page: parsedPage, limit: parsedLimit, offset };
}

/**
 * Validate sort parameters
 */
export function validateSort(
  sortBy: string | null,
  sortOrder: string | null,
  allowedFields: string[]
): { sortBy: string; sortOrder: 'asc' | 'desc' } {
  const validSortBy = sortBy && allowedFields.includes(sortBy) ? sortBy : allowedFields[0];
  const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

  return { sortBy: validSortBy, sortOrder: validSortOrder };
}

/**
 * Validate file upload
 */
export function validateFileUpload(
  file: File | null,
  options: {
    maxSize?: number; // in bytes
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}
): { valid: boolean; error?: string } {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = [],
    allowedExtensions = [],
  } = options;

  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${Math.round(maxSize / 1024 / 1024)}MB`,
    };
  }

  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}`,
    };
  }

  if (allowedExtensions.length > 0) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate and parse JSON body safely
 */
export async function parseJsonBody<T = Record<string, unknown>>(
  request: Request
): Promise<{ success: true; data: T } | { success: false; error: NextResponse }> {
  try {
    const data = await request.json();
    return { success: true, data: data as T };
  } catch {
    return {
      success: false,
      error: NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      ),
    };
  }
}

/**
 * Rate limiting check (basic implementation)
 * For production, use Redis or similar
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetIn: windowMs };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetTime - now,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetIn: entry.resetTime - now,
  };
}

/**
 * Create rate limit error response
 */
export function rateLimitResponse(resetIn: number): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil(resetIn / 1000),
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil(resetIn / 1000)),
      },
    }
  );
}
