import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors.js';
import { sendSuccess, sendCreated } from '../lib/response.js';
import { authenticate } from '../middleware/auth.js';
import { messagingService } from '../services/messaging.js';

// ============================================
// SCHEMAS
// ============================================

const createConversationSchema = z.object({
  type: z.enum(['DIRECT', 'GROUP', 'SUPPORT']),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  participantIds: z.array(z.string()).min(1).max(50),
});

const getConversationsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

// ============================================
// ROUTES
// ============================================

export default async function conversationRoutes(fastify: FastifyInstance) {
  // Get all conversations for current user
  fastify.get(
    '/conversations',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const query = getConversationsQuerySchema.parse(request.query);

      const result = await messagingService.getConversations(
        user.userId,
        query.limit,
        query.cursor
      );

      // Also get total unread count
      const totalUnread = await messagingService.getUnreadCount(user.userId);

      return sendSuccess(reply, result.conversations, {
        totalUnread,
        nextCursor: result.nextCursor,
        hasMore: !!result.nextCursor,
      });
    }
  );

  // Create a new conversation
  fastify.post(
    '/conversations',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user!;

      const parseResult = createConversationSchema.safeParse(request.body);
      if (!parseResult.success) {
        const fields: Record<string, string> = {};
        for (const issue of parseResult.error.issues) {
          fields[issue.path.join('.')] = issue.message;
        }
        throw new ValidationError(fields);
      }

      const input = parseResult.data;

      try {
        const conversation = await messagingService.createConversation(
          { userId: user.userId, tenantId: user.tenantId },
          {
            type: input.type,
            name: input.name,
            description: input.description,
            participantIds: input.participantIds,
          }
        );

        return sendCreated(reply, conversation);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Permission denied')) {
          throw new ForbiddenError(error.message);
        }
        throw error;
      }
    }
  );

  // Get a specific conversation
  fastify.get<{ Params: { id: string } }>(
    '/conversations/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params;

      // Check if user is participant
      const conversations = await messagingService.getConversations(user.userId, 1000);
      const conversation = conversations.conversations.find((c) => c.id === id);

      if (!conversation) {
        throw new NotFoundError('Konversation', id);
      }

      return sendSuccess(reply, conversation);
    }
  );

  // Get participants of a conversation
  fastify.get<{ Params: { id: string } }>(
    '/conversations/:id/participants',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params;

      // Verify user is participant
      const isParticipant = await messagingService
        .getConversations(user.userId, 1000)
        .then((r) => r.conversations.some((c) => c.id === id));

      if (!isParticipant) {
        throw new ForbiddenError('Sie sind kein Teilnehmer dieser Konversation');
      }

      const participants = await messagingService.getParticipants(id);
      return sendSuccess(reply, participants);
    }
  );

  // Mark conversation as read
  fastify.post<{ Params: { id: string } }>(
    '/conversations/:id/read',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params;

      await messagingService.markAsRead(user.userId, id);
      return sendSuccess(reply, { marked: true });
    }
  );
}
