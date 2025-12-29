/**
 * Custom Error Classes nach MOJO Coding Standards
 * Siehe: /root/projects/CODING_STANDARDS.md Section 5
 */
export declare class AppError extends Error {
    code: string;
    message: string;
    statusCode: number;
    details?: Record<string, unknown> | undefined;
    constructor(code: string, message: string, statusCode?: number, details?: Record<string, unknown> | undefined);
    toJSON(): {
        code: string;
        message: string;
        details: Record<string, unknown> | undefined;
    };
}
export declare class NotFoundError extends AppError {
    constructor(resource: string, id?: string);
}
export declare class ValidationError extends AppError {
    constructor(fields: Record<string, string>);
}
export declare class UnauthorizedError extends AppError {
    constructor(message?: string);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string);
}
export declare class ConflictError extends AppError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class RateLimitError extends AppError {
    constructor(message?: string);
}
export declare class ServiceUnavailableError extends AppError {
    constructor(message?: string);
}
export declare class PermissionDeniedError extends ForbiddenError {
    constructor(reason?: string);
}
export declare class NotParticipantError extends ForbiddenError {
    constructor(conversationId?: string);
}
export declare class ContactRequestRequiredError extends AppError {
    constructor(userId: string);
}
export declare class ContactRequestPendingError extends ConflictError {
    constructor();
}
export declare class BlockedUserError extends ForbiddenError {
    constructor();
}
//# sourceMappingURL=errors.d.ts.map