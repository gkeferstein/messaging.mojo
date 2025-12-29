import { verifyToken } from '@clerk/backend';
import { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../lib/errors.js';
import { sendUnauthorized } from '../lib/response.js';

// ============================================
// TYPES (nach MOJO Coding Standards Section 3)
// ============================================

export interface AuthUser {
  userId: string;
  tenantId?: string;
  tenantRole?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

// Extend FastifyRequest type
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

// ============================================
// AUTH MIDDLEWARE (nach MOJO Coding Standards Section 3)
// ============================================

/**
 * Clerk JWT Authentication Middleware
 * Verwendet Standard Response Format (Section 4)
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return sendUnauthorized(reply, 'Kein oder ungültiger Authorization Header');
    }

    const token = authHeader.slice(7);

    const session = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });

    if (!session || !session.sub) {
      return sendUnauthorized(reply, 'Ungültiger Token');
    }

    // Extract tenant info from custom claims (Clerk Organizations)
    const claims = session as Record<string, unknown>;
    const tenantId = (claims.org_id as string) || (claims.tenant_id as string);
    const tenantRole = claims.org_role as string | undefined;

    request.user = {
      userId: session.sub,
      tenantId,
      tenantRole,
      email: claims.email as string | undefined,
      firstName: claims.first_name as string | undefined,
      lastName: claims.last_name as string | undefined,
    };
  } catch (error) {
    request.log.error({ error }, 'Authentication failed');
    return sendUnauthorized(reply, 'Token-Verifikation fehlgeschlagen');
  }
}

/**
 * Optional authentication - sets user if token present, but doesn't fail
 */
export async function optionalAuthenticate(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return;
    }

    const token = authHeader.slice(7);

    const session = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });

    if (session?.sub) {
      const claims = session as Record<string, unknown>;
      const tenantId = (claims.org_id as string) || (claims.tenant_id as string);
      const tenantRole = claims.org_role as string | undefined;

      request.user = {
        userId: session.sub,
        tenantId,
        tenantRole,
        email: claims.email as string | undefined,
        firstName: claims.first_name as string | undefined,
        lastName: claims.last_name as string | undefined,
      };
    }
  } catch {
    // Ignore authentication errors for optional auth
  }
}

/**
 * Require specific tenant membership
 */
export async function requireTenant(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user?.tenantId) {
    return sendUnauthorized(reply, 'Tenant-Zugehörigkeit erforderlich');
  }
}

/**
 * Require specific tenant role
 */
export function requireTenantRole(...roles: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user?.tenantRole) {
      return sendUnauthorized(reply, 'Tenant-Rolle erforderlich');
    }
    if (!roles.includes(request.user.tenantRole)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Erforderliche Rolle: ${roles.join(' oder ')}`,
        },
      });
    }
  };
}
