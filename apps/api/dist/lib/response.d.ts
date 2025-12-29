/**
 * Standard API Response Helpers nach MOJO Coding Standards
 * Siehe: /root/projects/CODING_STANDARDS.md Section 4
 */
import { FastifyReply } from 'fastify';
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
/**
 * Send a successful response
 */
export declare function sendSuccess<T>(reply: FastifyReply, data: T, meta?: PaginationMeta | Record<string, unknown>, statusCode?: number): FastifyReply;
/**
 * Send a created response (201)
 */
export declare function sendCreated<T>(reply: FastifyReply, data: T, meta?: Record<string, unknown>): FastifyReply;
/**
 * Send an error response
 */
export declare function sendError(reply: FastifyReply, code: string, message: string, statusCode?: number, details?: Record<string, unknown>): FastifyReply;
/**
 * Send a not found error
 */
export declare function sendNotFound(reply: FastifyReply, resource: string, id?: string): FastifyReply;
/**
 * Send a validation error
 */
export declare function sendValidationError(reply: FastifyReply, fields: Record<string, string>): FastifyReply;
/**
 * Send an unauthorized error
 */
export declare function sendUnauthorized(reply: FastifyReply, message?: string): FastifyReply;
/**
 * Send a forbidden error
 */
export declare function sendForbidden(reply: FastifyReply, message?: string): FastifyReply;
/**
 * Send a conflict error
 */
export declare function sendConflict(reply: FastifyReply, message: string, details?: Record<string, unknown>): FastifyReply;
/**
 * Send a rate limit error
 */
export declare function sendRateLimited(reply: FastifyReply, message?: string): FastifyReply;
/**
 * Send an internal error
 */
export declare function sendInternalError(reply: FastifyReply, message?: string): FastifyReply;
//# sourceMappingURL=response.d.ts.map