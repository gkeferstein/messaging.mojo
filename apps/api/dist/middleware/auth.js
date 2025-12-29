import { verifyToken } from '@clerk/backend';
import { env } from '../config/env.js';
import { sendUnauthorized } from '../lib/response.js';
// ============================================
// AUTH MIDDLEWARE (nach MOJO Coding Standards Section 3)
// ============================================
/**
 * Clerk JWT Authentication Middleware
 * Verwendet Standard Response Format (Section 4)
 */
export async function authenticate(request, reply) {
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
        const claims = session;
        const tenantId = claims.org_id || claims.tenant_id;
        const tenantRole = claims.org_role;
        request.user = {
            userId: session.sub,
            tenantId,
            tenantRole,
            email: claims.email,
            firstName: claims.first_name,
            lastName: claims.last_name,
        };
    }
    catch (error) {
        request.log.error({ error }, 'Authentication failed');
        return sendUnauthorized(reply, 'Token-Verifikation fehlgeschlagen');
    }
}
/**
 * Optional authentication - sets user if token present, but doesn't fail
 */
export async function optionalAuthenticate(request, _reply) {
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
            const claims = session;
            const tenantId = claims.org_id || claims.tenant_id;
            const tenantRole = claims.org_role;
            request.user = {
                userId: session.sub,
                tenantId,
                tenantRole,
                email: claims.email,
                firstName: claims.first_name,
                lastName: claims.last_name,
            };
        }
    }
    catch {
        // Ignore authentication errors for optional auth
    }
}
/**
 * Require specific tenant membership
 */
export async function requireTenant(request, reply) {
    if (!request.user?.tenantId) {
        return sendUnauthorized(reply, 'Tenant-Zugehörigkeit erforderlich');
    }
}
/**
 * Require specific tenant role
 */
export function requireTenantRole(...roles) {
    return async function (request, reply) {
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
//# sourceMappingURL=auth.js.map