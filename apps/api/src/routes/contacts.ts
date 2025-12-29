import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  ContactRequestRequiredError,
  ContactRequestPendingError,
} from '../lib/errors.js';
import prisma from '../lib/prisma.js';
import { sendSuccess, sendCreated } from '../lib/response.js';
import { authenticate } from '../middleware/auth.js';
import { permissionService } from '../services/permissions.js';

// ============================================
// SCHEMAS
// ============================================

const sendContactRequestSchema = z.object({
  toUserId: z.string(),
  message: z.string().max(500).optional(),
});

const respondToRequestSchema = z.object({
  action: z.enum(['accept', 'decline']),
});

const blockUserSchema = z.object({
  userId: z.string(),
  reason: z.string().max(500).optional(),
});

// ============================================
// ROUTES
// ============================================

export default async function contactRoutes(fastify: FastifyInstance) {
  // Get pending contact requests (received)
  fastify.get('/contacts/requests', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user!;

    const requests = await prisma.contactRequest.findMany({
      where: {
        toUserId: user.userId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with user info
    const enriched = await Promise.all(
      requests.map(async (req) => {
        const fromUser = await prisma.userCache.findUnique({
          where: { id: req.fromUserId },
        });
        return {
          ...req,
          fromUser: fromUser
            ? {
                id: fromUser.id,
                name: `${fromUser.firstName || ''} ${fromUser.lastName || ''}`.trim(),
                email: fromUser.email,
                avatarUrl: fromUser.avatarUrl,
              }
            : null,
        };
      })
    );

    return sendSuccess(reply, enriched);
  });

  // Get sent contact requests
  fastify.get('/contacts/requests/sent', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user!;

    const requests = await prisma.contactRequest.findMany({
      where: {
        fromUserId: user.userId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    return sendSuccess(reply, requests);
  });

  // Send a contact request
  fastify.post('/contacts/requests', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user!;

    const parseResult = sendContactRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      const fields: Record<string, string> = {};
      for (const issue of parseResult.error.issues) {
        fields[issue.path.join('.')] = issue.message;
      }
      throw new ValidationError(fields);
    }

    const { toUserId, message } = parseResult.data;

    // Check permission
    const permResult = await permissionService.canSendMessage(
      { userId: user.userId, tenantId: user.tenantId },
      { userId: toUserId }
    );

    // If already allowed, no request needed
    if (permResult.allowed) {
      throw new ConflictError(
        'Kontaktanfrage nicht erforderlich - Sie können diesen Benutzer bereits kontaktieren'
      );
    }

    // If approval required, create request
    if (permResult.requiresApproval) {
      // Check if request already exists
      const existing = await prisma.contactRequest.findFirst({
        where: {
          fromUserId: user.userId,
          toUserId,
          status: 'PENDING',
        },
      });

      if (existing) {
        throw new ContactRequestPendingError();
      }

      const contactRequest = await prisma.contactRequest.create({
        data: {
          fromUserId: user.userId,
          fromTenantId: user.tenantId,
          toUserId,
          ruleId: permResult.rule?.id || 'unknown',
          message,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      return sendCreated(reply, contactRequest);
    }

    // Permission denied without approval option
    throw new ContactRequestRequiredError(toUserId);
  });

  // Respond to a contact request
  fastify.post<{ Params: { id: string } }>(
    '/contacts/requests/:id/respond',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params;

      const parseResult = respondToRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        const fields: Record<string, string> = {};
        for (const issue of parseResult.error.issues) {
          fields[issue.path.join('.')] = issue.message;
        }
        throw new ValidationError(fields);
      }

      const { action } = parseResult.data;

      // Find the request
      const contactRequest = await prisma.contactRequest.findUnique({
        where: { id },
      });

      if (!contactRequest) {
        throw new NotFoundError('Kontaktanfrage', id);
      }

      // Verify it's for this user
      if (contactRequest.toUserId !== user.userId) {
        throw new ForbiddenError('Diese Anfrage ist nicht für Sie bestimmt');
      }

      // Verify it's still pending
      if (contactRequest.status !== 'PENDING') {
        throw new ConflictError('Anfrage wurde bereits beantwortet');
      }

      // Update the request
      const updated = await prisma.contactRequest.update({
        where: { id },
        data: {
          status: action === 'accept' ? 'ACCEPTED' : 'DECLINED',
          respondedAt: new Date(),
        },
      });

      return sendSuccess(reply, updated);
    }
  );

  // Block a user
  fastify.post('/contacts/block', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user!;

    const parseResult = blockUserSchema.safeParse(request.body);
    if (!parseResult.success) {
      const fields: Record<string, string> = {};
      for (const issue of parseResult.error.issues) {
        fields[issue.path.join('.')] = issue.message;
      }
      throw new ValidationError(fields);
    }

    const { userId: blockedUserId, reason } = parseResult.data;

    // Can't block yourself
    if (blockedUserId === user.userId) {
      throw new ConflictError('Sie können sich nicht selbst blockieren');
    }

    // Create or update block
    const blocked = await prisma.blockedUser.upsert({
      where: {
        userId_blockedUserId: {
          userId: user.userId,
          blockedUserId,
        },
      },
      update: { reason },
      create: {
        userId: user.userId,
        blockedUserId,
        reason,
      },
    });

    return sendSuccess(reply, blocked);
  });

  // Unblock a user
  fastify.delete<{ Params: { userId: string } }>(
    '/contacts/block/:userId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const { userId: blockedUserId } = request.params;

      await prisma.blockedUser.deleteMany({
        where: {
          userId: user.userId,
          blockedUserId,
        },
      });

      return sendSuccess(reply, { unblocked: true });
    }
  );

  // Get blocked users
  fastify.get('/contacts/blocked', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user!;

    const blocked = await prisma.blockedUser.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
    });

    return sendSuccess(reply, blocked);
  });

  // Check if can message a user
  fastify.get<{ Params: { userId: string } }>(
    '/contacts/can-message/:userId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const { userId: targetUserId } = request.params;

      const result = await permissionService.canSendMessage(
        { userId: user.userId, tenantId: user.tenantId },
        { userId: targetUserId }
      );

      return sendSuccess(reply, {
        canMessage: result.allowed,
        requiresApproval: result.requiresApproval || false,
        reason: result.reason,
      });
    }
  );
}
