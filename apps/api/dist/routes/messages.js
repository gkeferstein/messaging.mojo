import { z } from 'zod';
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors.js';
import { sendSuccess, sendCreated } from '../lib/response.js';
import { authenticate } from '../middleware/auth.js';
import { messagingService } from '../services/messaging.js';
import { permissionService } from '../services/permissions.js';
// ============================================
// SCHEMAS
// ============================================
const sendMessageSchema = z.object({
    content: z.string().min(1).max(10000),
    type: z.enum(['TEXT', 'SYSTEM', 'ATTACHMENT']).default('TEXT'),
    replyToId: z.string().uuid().optional(),
    attachmentUrl: z.string().url().optional(),
    attachmentType: z.string().max(100).optional(),
    attachmentName: z.string().max(255).optional(),
});
const getMessagesQuerySchema = z.object({
    limit: z.coerce.number().min(1).max(100).default(50),
    cursor: z.string().optional(),
});
// ============================================
// ROUTES
// ============================================
export default async function messageRoutes(fastify) {
    // Get messages in a conversation
    fastify.get('/conversations/:conversationId/messages', { preHandler: [authenticate] }, async (request, reply) => {
        const user = request.user;
        const { conversationId } = request.params;
        const query = getMessagesQuerySchema.parse(request.query);
        try {
            const result = await messagingService.getMessages(user.userId, conversationId, query.limit, query.cursor);
            return sendSuccess(reply, result.messages, {
                hasMore: !!result.nextCursor,
                nextCursor: result.nextCursor,
            });
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Not a participant')) {
                throw new ForbiddenError('Sie sind kein Teilnehmer dieser Konversation');
            }
            throw error;
        }
    });
    // Send a message to a conversation
    fastify.post('/conversations/:conversationId/messages', { preHandler: [authenticate] }, async (request, reply) => {
        const user = request.user;
        const { conversationId } = request.params;
        const parseResult = sendMessageSchema.safeParse(request.body);
        if (!parseResult.success) {
            const fields = {};
            for (const issue of parseResult.error.issues) {
                fields[issue.path.join('.')] = issue.message;
            }
            throw new ValidationError(fields);
        }
        const input = parseResult.data;
        try {
            const message = await messagingService.sendMessage({ userId: user.userId, tenantId: user.tenantId }, {
                conversationId,
                content: input.content,
                type: input.type,
                replyToId: input.replyToId,
                attachmentUrl: input.attachmentUrl,
                attachmentType: input.attachmentType,
                attachmentName: input.attachmentName,
            });
            return sendCreated(reply, message);
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Not a participant')) {
                throw new ForbiddenError('Sie sind kein Teilnehmer dieser Konversation');
            }
            throw error;
        }
    });
    // Get a specific message
    fastify.get('/conversations/:conversationId/messages/:messageId', { preHandler: [authenticate] }, async (request, reply) => {
        const user = request.user;
        const { conversationId, messageId } = request.params;
        // Verify participant
        const isParticipant = await permissionService.isParticipant(user.userId, conversationId);
        if (!isParticipant) {
            throw new ForbiddenError('Sie sind kein Teilnehmer dieser Konversation');
        }
        const result = await messagingService.getMessages(user.userId, conversationId, 1000);
        const message = result.messages.find((m) => m.id === messageId);
        if (!message) {
            throw new NotFoundError('Nachricht', messageId);
        }
        return sendSuccess(reply, message);
    });
    // Get unread count
    fastify.get('/messages/unread', { preHandler: [authenticate] }, async (request, reply) => {
        const user = request.user;
        const unreadCount = await messagingService.getUnreadCount(user.userId);
        return sendSuccess(reply, { unreadCount });
    });
}
//# sourceMappingURL=messages.js.map