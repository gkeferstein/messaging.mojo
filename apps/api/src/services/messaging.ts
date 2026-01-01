import prisma from '../lib/prisma.js';
import { presence } from '../lib/redis.js';
import { permissionService, UserContext } from './permissions.js';
import { ConversationType, MessageType, ParticipantRole } from '@prisma/client';

// ============================================
// TYPES
// ============================================

export interface CreateConversationInput {
  type: ConversationType;
  name?: string;
  description?: string;
  participantIds: string[];
}

export interface SendMessageInput {
  conversationId: string;
  content: string;
  type?: MessageType;
  replyToId?: string;
  attachmentUrl?: string;
  attachmentType?: string;
  attachmentName?: string;
}

export interface ConversationWithDetails {
  id: string;
  type: ConversationType;
  name: string | null;
  description: string | null;
  avatarUrl: string | null;
  participants: ParticipantWithPresence[];
  lastMessage: MessageWithSender | null;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParticipantWithPresence {
  userId: string;
  tenantId: string | null;
  role: ParticipantRole;
  name?: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastSeenAt?: Date;
}

export interface MessageWithSender {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: MessageType;
  attachmentUrl: string | null;
  attachmentType: string | null;
  attachmentName: string | null;
  replyToId: string | null;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  sender?: {
    name: string;
    avatarUrl?: string;
  };
}

// ============================================
// MESSAGING SERVICE
// ============================================

export class MessagingService {
  /**
   * Erstellt eine neue Konversation
   */
  async createConversation(
    creator: UserContext,
    input: CreateConversationInput
  ): Promise<ConversationWithDetails> {
    // Permission Check
    const permResult = await permissionService.canCreateConversation(
      creator,
      input.participantIds,
      input.type as 'DIRECT' | 'GROUP' | 'SUPPORT'
    );

    if (!permResult.allowed) {
      throw new Error(`Permission denied: ${permResult.reason}`);
    }

    // Für DIRECT: Prüfe ob schon eine Konversation existiert
    if (input.type === 'DIRECT' && input.participantIds.length === 1) {
      const existing = await this.findDirectConversation(
        creator.userId,
        input.participantIds[0]
      );
      if (existing) {
        return this.getConversationWithDetails(existing.id, creator.userId);
      }
    }

    // Erstelle Konversation
    const conversation = await prisma.conversation.create({
      data: {
        type: input.type,
        name: input.name,
        description: input.description,
        participants: {
          create: [
            // Creator als Owner
            {
              userId: creator.userId,
              tenantId: creator.tenantId,
              role: 'OWNER',
            },
            // Andere Teilnehmer als Member
            ...input.participantIds.map((userId) => ({
              userId,
              role: 'MEMBER' as ParticipantRole,
            })),
          ],
        },
      },
      include: {
        participants: true,
      },
    });

    return this.getConversationWithDetails(conversation.id, creator.userId);
  }

  /**
   * Sendet eine Nachricht
   */
  async sendMessage(
    sender: UserContext,
    input: SendMessageInput
  ): Promise<MessageWithSender> {
    // Prüfe ob User Teilnehmer ist
    const isParticipant = await permissionService.isParticipant(
      sender.userId,
      input.conversationId
    );

    if (!isParticipant) {
      throw new Error('Not a participant of this conversation');
    }

    // Erstelle Nachricht
    const message = await prisma.message.create({
      data: {
        conversationId: input.conversationId,
        senderId: sender.userId,
        content: input.content,
        type: input.type || 'TEXT',
        replyToId: input.replyToId,
        attachmentUrl: input.attachmentUrl,
        attachmentType: input.attachmentType,
        attachmentName: input.attachmentName,
      },
    });

    // Update Conversation's updatedAt
    await prisma.conversation.update({
      where: { id: input.conversationId },
      data: { updatedAt: new Date() },
    });

    // Update sender's lastReadAt
    await prisma.participant.update({
      where: {
        conversationId_userId: {
          conversationId: input.conversationId,
          userId: sender.userId,
        },
      },
      data: { lastReadAt: new Date() },
    });

    return this.enrichMessage(message);
  }

  /**
   * Holt alle Konversationen eines Users
   */
  async getConversations(
    userId: string,
    limit = 50,
    cursor?: string
  ): Promise<{ conversations: ConversationWithDetails[]; nextCursor?: string }> {
    const whereClause = {
      participants: {
        some: { userId },
      },
      ...(cursor && {
        updatedAt: { lt: new Date(cursor) },
      }),
    };

    const conversations = await prisma.conversation.findMany({
      where: whereClause,
      orderBy: { updatedAt: 'desc' },
      take: limit + 1,
      include: {
        participants: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const hasMore = conversations.length > limit;
    const items = hasMore ? conversations.slice(0, -1) : conversations;
    const nextCursor = hasMore
      ? items[items.length - 1].updatedAt.toISOString()
      : undefined;

    const enriched = await Promise.all(
      items.map((conv) => this.getConversationWithDetails(conv.id, userId))
    );

    return { conversations: enriched, nextCursor };
  }

  /**
   * Holt Nachrichten einer Konversation
   */
  async getMessages(
    userId: string,
    conversationId: string,
    limit = 50,
    cursor?: string
  ): Promise<{ messages: MessageWithSender[]; nextCursor?: string }> {
    // Permission Check
    const isParticipant = await permissionService.isParticipant(
      userId,
      conversationId
    );

    if (!isParticipant) {
      throw new Error('Not a participant of this conversation');
    }

    const whereClause = {
      conversationId,
      deletedAt: null,
      ...(cursor && {
        createdAt: { lt: new Date(cursor) },
      }),
    };

    const messages = await prisma.message.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, -1) : messages;
    const nextCursor = hasMore
      ? items[items.length - 1].createdAt.toISOString()
      : undefined;

    const enriched = await Promise.all(items.map((m) => this.enrichMessage(m)));

    return { messages: enriched, nextCursor };
  }

  /**
   * Markiert Nachrichten als gelesen
   */
  async markAsRead(userId: string, conversationId: string): Promise<void> {
    await prisma.participant.update({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      data: { lastReadAt: new Date() },
    });
  }

  /**
   * Zählt ungelesene Nachrichten
   */
  async getUnreadCount(userId: string): Promise<number> {
    const participants = await prisma.participant.findMany({
      where: { userId },
      select: {
        conversationId: true,
        lastReadAt: true,
      },
    });

    let totalUnread = 0;

    for (const p of participants) {
      const count = await prisma.message.count({
        where: {
          conversationId: p.conversationId,
          senderId: { not: userId },
          createdAt: p.lastReadAt ? { gt: p.lastReadAt } : undefined,
          deletedAt: null,
        },
      });
      totalUnread += count;
    }

    return totalUnread;
  }

  /**
   * Holt Teilnehmer einer Konversation
   */
  async getParticipants(conversationId: string): Promise<ParticipantWithPresence[]> {
    const participants = await prisma.participant.findMany({
      where: { conversationId },
    });

    return Promise.all(
      participants.map(async (p) => {
        const isOnline = await presence.isOnline(p.userId, p.tenantId || undefined);
        const lastSeen = await presence.getLastSeen(p.userId);
        const userCache = await prisma.userCache.findUnique({
          where: { id: p.userId },
        });

        return {
          userId: p.userId,
          tenantId: p.tenantId,
          role: p.role,
          name: userCache
            ? `${userCache.firstName || ''} ${userCache.lastName || ''}`.trim() || userCache.email || undefined
            : undefined,
          avatarUrl: userCache?.avatarUrl || undefined,
          isOnline,
          lastSeenAt: lastSeen || undefined,
        };
      })
    );
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async findDirectConversation(
    userId1: string,
    userId2: string
  ): Promise<{ id: string } | null> {
    return prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        participants: {
          every: {
            userId: { in: [userId1, userId2] },
          },
        },
      },
      select: { id: true },
    });
  }

  private async getConversationWithDetails(
    conversationId: string,
    currentUserId: string
  ): Promise<ConversationWithDetails> {
    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: {
        participants: true,
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Get participant info with presence
    const participants = await this.getParticipants(conversationId);

    // Calculate unread count
    const currentParticipant = conversation.participants.find(
      (p) => p.userId === currentUserId
    );
    const unreadCount = currentParticipant?.lastReadAt
      ? await prisma.message.count({
          where: {
            conversationId,
            senderId: { not: currentUserId },
            createdAt: { gt: currentParticipant.lastReadAt },
            deletedAt: null,
          },
        })
      : await prisma.message.count({
          where: {
            conversationId,
            senderId: { not: currentUserId },
            deletedAt: null,
          },
        });

    // Enrich last message
    const lastMessage = conversation.messages[0]
      ? await this.enrichMessage(conversation.messages[0])
      : null;

    return {
      id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      description: conversation.description,
      avatarUrl: conversation.avatarUrl,
      participants,
      lastMessage,
      unreadCount,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  private async enrichMessage(message: {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    type: MessageType;
    attachmentUrl: string | null;
    attachmentType: string | null;
    attachmentName: string | null;
    replyToId: string | null;
    createdAt: Date;
    editedAt: Date | null;
    deletedAt: Date | null;
  }): Promise<MessageWithSender> {
    const userCache = await prisma.userCache.findUnique({
      where: { id: message.senderId },
    });

    return {
      ...message,
      sender: userCache
        ? {
            name:
              `${userCache.firstName || ''} ${userCache.lastName || ''}`.trim() ||
              userCache.email ||
              'Unknown',
            avatarUrl: userCache.avatarUrl || undefined,
          }
        : undefined,
    };
  }
}

// Singleton Export
export const messagingService = new MessagingService();


