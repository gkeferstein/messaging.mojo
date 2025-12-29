import { FastifyRequest, FastifyReply } from 'fastify';
export interface AuthUser {
    userId: string;
    tenantId?: string;
    tenantRole?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
}
declare module 'fastify' {
    interface FastifyRequest {
        user?: AuthUser;
    }
}
/**
 * Clerk JWT Authentication Middleware
 * Verwendet Standard Response Format (Section 4)
 */
export declare function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
/**
 * Optional authentication - sets user if token present, but doesn't fail
 */
export declare function optionalAuthenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void>;
/**
 * Require specific tenant membership
 */
export declare function requireTenant(request: FastifyRequest, reply: FastifyReply): Promise<void>;
/**
 * Require specific tenant role
 */
export declare function requireTenantRole(...roles: string[]): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map