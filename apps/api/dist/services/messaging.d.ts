import { ConversationType, MessageType, ParticipantRole } from '@prisma/client';
import { UserContext } from './permissions.js';
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
export declare class MessagingService {
    /**
     * Erstellt eine neue Konversation
     */
    createConversation(creator: UserContext, input: CreateConversationInput): Promise<ConversationWithDetails>;
    /**
     * Sendet eine Nachricht
     */
    sendMessage(sender: UserContext, input: SendMessageInput): Promise<MessageWithSender>;
    /**
     * Holt alle Konversationen eines Users
     */
    getConversations(userId: string, limit?: number, cursor?: string): Promise<{
        conversations: ConversationWithDetails[];
        nextCursor?: string;
    }>;
    /**
     * Holt Nachrichten einer Konversation
     */
    getMessages(userId: string, conversationId: string, limit?: number, cursor?: string): Promise<{
        messages: MessageWithSender[];
        nextCursor?: string;
    }>;
    /**
     * Markiert Nachrichten als gelesen
     */
    markAsRead(userId: string, conversationId: string): Promise<void>;
    /**
     * Zählt ungelesene Nachrichten
     */
    getUnreadCount(userId: string): Promise<number>;
    /**
     * Holt Teilnehmer einer Konversation
     */
    getParticipants(conversationId: string): Promise<ParticipantWithPresence[]>;
    private findDirectConversation;
    private getConversationWithDetails;
    private enrichMessage;
}
export declare const messagingService: MessagingService;
//# sourceMappingURL=messaging.d.ts.map