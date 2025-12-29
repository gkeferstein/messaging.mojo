/**
 * Standard API Response Helpers nach MOJO Coding Standards
 * Siehe: /root/projects/CODING_STANDARDS.md Section 4
 */
// ============================================
// RESPONSE HELPERS
// ============================================
/**
 * Send a successful response
 */
export function sendSuccess(reply, data, meta, statusCode = 200) {
    const response = {
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
export function sendCreated(reply, data, meta) {
    return sendSuccess(reply, data, meta, 201);
}
/**
 * Send an error response
 */
export function sendError(reply, code, message, statusCode = 500, details) {
    const response = {
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
export function sendNotFound(reply, resource, id) {
    return sendError(reply, 'NOT_FOUND', id ? `${resource} mit ID ${id} nicht gefunden` : `${resource} nicht gefunden`, 404);
}
/**
 * Send a validation error
 */
export function sendValidationError(reply, fields) {
    return sendError(reply, 'VALIDATION_ERROR', 'Validierung fehlgeschlagen', 400, { fields });
}
/**
 * Send an unauthorized error
 */
export function sendUnauthorized(reply, message = 'Nicht authentifiziert') {
    return sendError(reply, 'UNAUTHORIZED', message, 401);
}
/**
 * Send a forbidden error
 */
export function sendForbidden(reply, message = 'Keine Berechtigung') {
    return sendError(reply, 'FORBIDDEN', message, 403);
}
/**
 * Send a conflict error
 */
export function sendConflict(reply, message, details) {
    return sendError(reply, 'CONFLICT', message, 409, details);
}
/**
 * Send a rate limit error
 */
export function sendRateLimited(reply, message = 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.') {
    return sendError(reply, 'RATE_LIMITED', message, 429);
}
/**
 * Send an internal error
 */
export function sendInternalError(reply, message = 'Ein interner Fehler ist aufgetreten') {
    return sendError(reply, 'INTERNAL_ERROR', message, 500);
}
//# sourceMappingURL=response.js.map