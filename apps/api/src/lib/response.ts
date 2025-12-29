/**
 * Standard API Response Helpers nach MOJO Coding Standards
 * Siehe: /root/projects/CODING_STANDARDS.md Section 4
 */

import { FastifyReply } from 'fastify';

// ============================================
// TYPES
// ============================================

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta | Record<string, unknown>;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginationMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  nextCursor?: string;
  hasMore?: boolean;
}

// ============================================
// RESPONSE HELPERS
// ============================================

/**
 * Send a successful response
 */
export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  meta?: PaginationMeta | Record<string, unknown>,
  statusCode: number = 200
): FastifyReply {
  const response: SuccessResponse<T> = {
    success: true,
    data,
  };

  if (meta && Object.keys(meta).length > 0) {
    response.meta = meta;
  }

  return reply.status(statusCode).send(response);
}

/**
 * Send a created response (201)
 */
export function sendCreated<T>(
  reply: FastifyReply,
  data: T,
  meta?: Record<string, unknown>
): FastifyReply {
  return sendSuccess(reply, data, meta, 201);
}

/**
 * Send an error response
 */
export function sendError(
  reply: FastifyReply,
  code: string,
  message: string,
  statusCode: number = 500,
  details?: Record<string, unknown>
): FastifyReply {
  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details) {
    response.error.details = details;
  }

  return reply.status(statusCode).send(response);
}

/**
 * Send a not found error
 */
export function sendNotFound(
  reply: FastifyReply,
  resource: string,
  id?: string
): FastifyReply {
  return sendError(
    reply,
    'NOT_FOUND',
    id ? `${resource} mit ID ${id} nicht gefunden` : `${resource} nicht gefunden`,
    404
  );
}

/**
 * Send a validation error
 */
export function sendValidationError(
  reply: FastifyReply,
  fields: Record<string, string>
): FastifyReply {
  return sendError(
    reply,
    'VALIDATION_ERROR',
    'Validierung fehlgeschlagen',
    400,
    { fields }
  );
}

/**
 * Send an unauthorized error
 */
export function sendUnauthorized(
  reply: FastifyReply,
  message: string = 'Nicht authentifiziert'
): FastifyReply {
  return sendError(reply, 'UNAUTHORIZED', message, 401);
}

/**
 * Send a forbidden error
 */
export function sendForbidden(
  reply: FastifyReply,
  message: string = 'Keine Berechtigung'
): FastifyReply {
  return sendError(reply, 'FORBIDDEN', message, 403);
}

/**
 * Send a conflict error
 */
export function sendConflict(
  reply: FastifyReply,
  message: string,
  details?: Record<string, unknown>
): FastifyReply {
  return sendError(reply, 'CONFLICT', message, 409, details);
}

/**
 * Send a rate limit error
 */
export function sendRateLimited(
  reply: FastifyReply,
  message: string = 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.'
): FastifyReply {
  return sendError(reply, 'RATE_LIMITED', message, 429);
}

/**
 * Send an internal error
 */
export function sendInternalError(
  reply: FastifyReply,
  message: string = 'Ein interner Fehler ist aufgetreten'
): FastifyReply {
  return sendError(reply, 'INTERNAL_ERROR', message, 500);
}

