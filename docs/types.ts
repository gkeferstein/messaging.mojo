// ============================================
// MOJO Messaging Types v1.0.0
// API: https://messaging.mojo-institut.de/api/v1
// 
// COPY THIS FILE INTO YOUR PROJECT!
// Path: src/types/messaging.ts
// ============================================

// ============================================
// CORE TYPES
// ============================================

export type ConversationType = 'DIRECT' | 'GROUP' | 'SUPPORT' | 'ANNOUNCEMENT';
export type MessageType = 'TEXT' | 'SYSTEM' | 'ATTACHMENT';
export type ParticipantRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  description: string | null;
  avatarUrl: string | null;
  participants: Participant[];
  lastMessage: Message | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: MessageType;
  attachmentUrl: string | null;
  attachmentType: string | null;
  attachmentName: string | null;
  replyToId: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender?: {
    name: string;
    avatarUrl?: string;
  };
}

export interface Participant {
  userId: string;
  tenantId: string | null;
  role: ParticipantRole;
  name?: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastSeenAt?: string;
}

// ============================================
// API REQUEST TYPES
// ============================================

export interface CreateConversationRequest {
  type: ConversationType;
  name?: string;
  description?: string;
  participantIds: string[];
}

export interface SendMessageRequest {
  content: string;
  type?: MessageType;
  replyToId?: string;
  attachmentUrl?: string;
  attachmentType?: string;
  attachmentName?: string;
}

export interface SendContactRequestRequest {
  toUserId: string;
  message?: string;
}

export interface RespondToContactRequest {
  action: 'accept' | 'decline';
}

export interface BlockUserRequest {
  userId: string;
  reason?: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ConversationsResponse {
  conversations: Conversation[];
  totalUnread: number;
  nextCursor?: string;
}

export interface ConversationResponse {
  conversation: Conversation;
}

export interface MessagesResponse {
  messages: Message[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface MessageResponse {
  message: Message;
}

export interface UnreadResponse {
  unreadCount: number;
}

export interface ParticipantsResponse {
  participants: Participant[];
}

export interface ContactRequest {
  id: string;
  fromUserId: string;
  fromTenantId: string | null;
  toUserId: string;
  toTenantId: string | null;
  ruleId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
  expiresAt: string;
  fromUser?: {
    id: string;
    name: string;
    email: string | null;
    avatarUrl: string | null;
  };
}

export interface ContactRequestsResponse {
  requests: ContactRequest[];
}

export interface CanMessageResponse {
  canMessage: boolean;
  requiresApproval: boolean;
  reason?: string;
}

export interface BlockedUser {
  id: string;
  userId: string;
  blockedUserId: string;
  reason: string | null;
  createdAt: string;
}

export interface BlockedUsersResponse {
  blocked: BlockedUser[];
}

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  timestamp: string;
  service: string;
  checks?: Record<string, {
    status: string;
    latency?: number;
    error?: string;
  }>;
}

// ============================================
// WEBSOCKET EVENT TYPES
// ============================================

// Client → Server Events
export interface ClientToServerEvents {
  'message:send': (data: {
    conversationId: string;
    content: string;
    type?: MessageType;
    replyToId?: string;
  }) => void;
  
  'typing:start': (data: {
    conversationId: string;
  }) => void;
  
  'typing:stop': (data: {
    conversationId: string;
  }) => void;
  
  'messages:read': (data: {
    conversationId: string;
    lastReadAt?: string;
  }) => void;
  
  'conversation:join': (data: {
    conversationId: string;
  }) => void;
  
  'conversation:leave': (data: {
    conversationId: string;
  }) => void;
  
  'presence:get': () => void;
}

// Server → Client Events
export interface ServerToClientEvents {
  'message:new': (data: {
    message: Message;
    conversationId: string;
  }) => void;
  
  'message:sent': (data: {
    messageId: string;
    conversationId: string;
    timestamp: string;
  }) => void;
  
  'message:error': (data: {
    error: string;
    conversationId: string;
  }) => void;
  
  'typing:update': (data: {
    userId: string;
    conversationId: string;
    isTyping: boolean;
  }) => void;
  
  'messages:read': (data: {
    userId: string;
    conversationId: string;
    readAt: string;
  }) => void;
  
  'presence:online': (data: {
    userId: string;
    tenantId?: string;
    timestamp: string;
  }) => void;
  
  'presence:offline': (data: {
    userId: string;
    tenantId?: string;
    lastSeen: string;
  }) => void;
  
  'presence:list': (data: {
    tenantId?: string;
    onlineUsers: string[];
  }) => void;
  
  'conversation:joined': (data: {
    conversationId: string;
  }) => void;
  
  'conversation:left': (data: {
    conversationId: string;
  }) => void;
  
  'conversation:error': (data: {
    error: string;
    conversationId: string;
  }) => void;
}

// ============================================
// SOCKET.IO TYPED SOCKET
// ============================================

import type { Socket } from 'socket.io-client';

export type MessagingSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ============================================
// UTILITY TYPES
// ============================================

export interface MessagingConfig {
  apiUrl: string;
  wsUrl: string;
}

export interface MessagingAuthOptions {
  token: string;
  tenantId?: string;
}

// ============================================
// HELPER FUNCTIONS (optional)
// ============================================

/**
 * Format a date as relative time string (German)
 */
export function formatTimeAgo(date?: string | Date): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  
  if (seconds < 60) return 'gerade';
  if (seconds < 3600) return `vor ${Math.floor(seconds / 60)} Min`;
  if (seconds < 86400) return `vor ${Math.floor(seconds / 3600)} Std`;
  if (seconds < 604800) return `vor ${Math.floor(seconds / 86400)} Tagen`;
  
  return d.toLocaleDateString('de-DE');
}

/**
 * Get initials from a name
 */
export function getInitials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format unread count for display
 */
export function formatUnreadCount(count: number): string {
  if (count <= 0) return '';
  if (count > 99) return '99+';
  return count.toString();
}


