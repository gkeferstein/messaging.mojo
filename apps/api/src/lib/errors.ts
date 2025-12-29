/**
 * Custom Error Classes nach MOJO Coding Standards
 * Siehe: /root/projects/CODING_STANDARDS.md Section 5
 */

// ============================================
// BASE ERROR
// ============================================

export class AppError extends Error {
  constructor(
    public code: string,
    public override message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

// ============================================
// SPECIFIC ERRORS
// ============================================

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      'NOT_FOUND',
      id ? `${resource} mit ID ${id} nicht gefunden` : `${resource} nicht gefunden`,
      404
    );
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(fields: Record<string, string>) {
    super('VALIDATION_ERROR', 'Validierung fehlgeschlagen', 400, { fields });
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Nicht authentifiziert') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Keine Berechtigung') {
    super('FORBIDDEN', message, 403);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFLICT', message, 409, details);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.') {
    super('RATE_LIMITED', message, 429);
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service vorübergehend nicht verfügbar') {
    super('SERVICE_UNAVAILABLE', message, 503);
    this.name = 'ServiceUnavailableError';
  }
}

// ============================================
// MESSAGING-SPECIFIC ERRORS
// ============================================

export class PermissionDeniedError extends ForbiddenError {
  constructor(reason?: string) {
    super(reason || 'Kommunikation nicht erlaubt');
    this.name = 'PermissionDeniedError';
  }
}

export class NotParticipantError extends ForbiddenError {
  constructor(conversationId?: string) {
    super(
      conversationId
        ? `Sie sind kein Teilnehmer der Konversation ${conversationId}`
        : 'Sie sind kein Teilnehmer dieser Konversation'
    );
    this.name = 'NotParticipantError';
  }
}

export class ContactRequestRequiredError extends AppError {
  constructor(userId: string) {
    super(
      'CONTACT_REQUEST_REQUIRED',
      'Kontaktanfrage erforderlich',
      403,
      { targetUserId: userId }
    );
    this.name = 'ContactRequestRequiredError';
  }
}

export class ContactRequestPendingError extends ConflictError {
  constructor() {
    super('Kontaktanfrage bereits ausstehend');
    this.name = 'ContactRequestPendingError';
  }
}

export class BlockedUserError extends ForbiddenError {
  constructor() {
    super('Benutzer ist blockiert');
    this.name = 'BlockedUserError';
  }
}

