import { Server as HttpServer } from 'http';
import { Redis } from 'ioredis';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { verifyToken } from '@clerk/backend';
import { presence, typing } from '../lib/redis.js';
import { env } from '../config/env.js';
import { messagingService } from '../services/messaging.js';
import { permissionService } from '../services/permissions.js';
import prisma from '../lib/prisma.js';

// ============================================
// TYPES
// ============================================

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    tenantId?: string;
    email?: string;
  };
}

interface SendMessageData {
  conversationId: string;
  content: string;
  type?: 'TEXT' | 'SYSTEM' | 'ATTACHMENT';
  replyToId?: string;
}

interface TypingData {
  conversationId: string;
}

interface MarkReadData {
  conversationId: string;
  lastReadAt?: string;
}

interface JoinConversationData {
  conversationId: string;
}

// ============================================
// SOCKET.IO SETUP
// ============================================

export async function setupSocketIO(httpServer: HttpServer): Promise<Server> {
  // Parse CORS origins
  const corsOrigins = env.corsOrigins === true 
    ? true 
    : env.corsOrigins;

  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Redis Adapter für Multi-Server Support - separate Instanzen
  try {
    const pubClient = new Redis(env.REDIS_URL);
    const subClient = new Redis(env.REDIS_URL);
    
    io.adapter(createAdapter(pubClient, subClient));
    console.log('🟢 Socket.io Redis adapter connected');
  } catch (error) {
    console.error('🔴 Failed to connect Redis adapter:', error);
    // Continue without Redis adapter (single server mode)
  }

  // Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const session = await verifyToken(token, {
        secretKey: env.CLERK_SECRET_KEY,
      });

      if (!session || !session.sub) {
        return next(new Error('Invalid token'));
      }

      const claims = session as Record<string, unknown>;
      
      socket.data.userId = session.sub;
      socket.data.tenantId = (claims.org_id as string) || (claims.tenant_id as string) || socket.handshake.auth.tenantId;
      socket.data.email = claims.email as string;

      next();
    } catch (error) {
      console.error('Socket auth error:', error);
      next(new Error('Authentication failed'));
    }
  });

  // Connection Handler
  io.on('connection', async (socket: AuthenticatedSocket) => {
    const { userId, tenantId } = socket.data;
    
    console.log(`🔌 User connected: ${userId} (tenant: ${tenantId || 'none'})`);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Join tenant room if applicable
    if (tenantId) {
      socket.join(`tenant:${tenantId}`);
    }

    // Set online status
    await presence.setOnline(userId, tenantId);

    // Broadcast online status to tenant
    if (tenantId) {
      socket.to(`tenant:${tenantId}`).emit('presence:online', {
        userId,
        tenantId,
        timestamp: new Date().toISOString(),
      });
    }

    // Join all user's conversations
    await joinUserConversations(socket);

    // ========================================
    // EVENT HANDLERS
    // ========================================

    // Send Message
    socket.on('message:send', async (data: SendMessageData) => {
      try {
        const message = await messagingService.sendMessage(
          { userId, tenantId },
          {
            conversationId: data.conversationId,
            content: data.content,
            type: data.type || 'TEXT',
            replyToId: data.replyToId,
          }
        );

        // Emit to conversation room
        io.to(`conversation:${data.conversationId}`).emit('message:new', {
          message,
          conversationId: data.conversationId,
        });

        // Also emit to all participants via user rooms (for reliability)
        const participants = await messagingService.getParticipants(data.conversationId);
        for (const p of participants) {
          if (p.userId !== userId) {
            io.to(`user:${p.userId}`).emit('message:new', {
              message,
              conversationId: data.conversationId,
            });
          }
        }

        // ACK to sender
        socket.emit('message:sent', {
          messageId: message.id,
          conversationId: data.conversationId,
          timestamp: message.createdAt,
        });

        // Clear typing indicator
        await typing.setTyping(data.conversationId, userId, false);
      } catch (error) {
        console.error('Failed to send message:', error);
        socket.emit('message:error', {
          error: error instanceof Error ? error.message : 'Failed to send message',
          conversationId: data.conversationId,
        });
      }
    });

    // Typing Start
    socket.on('typing:start', async (data: TypingData) => {
      try {
        const isParticipant = await permissionService.isParticipant(userId, data.conversationId);
        if (!isParticipant) return;

        await typing.setTyping(data.conversationId, userId, true);

        socket.to(`conversation:${data.conversationId}`).emit('typing:update', {
          userId,
          conversationId: data.conversationId,
          isTyping: true,
        });
      } catch (error) {
        console.error('Typing start error:', error);
      }
    });

    // Typing Stop
    socket.on('typing:stop', async (data: TypingData) => {
      try {
        await typing.setTyping(data.conversationId, userId, false);

        socket.to(`conversation:${data.conversationId}`).emit('typing:update', {
          userId,
          conversationId: data.conversationId,
          isTyping: false,
        });
      } catch (error) {
        console.error('Typing stop error:', error);
      }
    });

    // Mark as Read
    socket.on('messages:read', async (data: MarkReadData) => {
      try {
        await messagingService.markAsRead(userId, data.conversationId);

        // Notify other participants about read status
        socket.to(`conversation:${data.conversationId}`).emit('messages:read', {
          userId,
          conversationId: data.conversationId,
          readAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    // Join a specific conversation room
    socket.on('conversation:join', async (data: JoinConversationData) => {
      try {
        const isParticipant = await permissionService.isParticipant(userId, data.conversationId);
        if (!isParticipant) {
          socket.emit('conversation:error', {
            error: 'Not a participant',
            conversationId: data.conversationId,
          });
          return;
        }

        socket.join(`conversation:${data.conversationId}`);
        socket.emit('conversation:joined', { conversationId: data.conversationId });
      } catch (error) {
        console.error('Join conversation error:', error);
      }
    });

    // Leave a specific conversation room
    socket.on('conversation:leave', (data: JoinConversationData) => {
      socket.leave(`conversation:${data.conversationId}`);
      socket.emit('conversation:left', { conversationId: data.conversationId });
    });

    // Get online users in tenant
    socket.on('presence:get', async () => {
      try {
        const onlineUsers = await presence.getOnlineUsers(tenantId);
        socket.emit('presence:list', {
          tenantId,
          onlineUsers,
        });
      } catch (error) {
        console.error('Get presence error:', error);
      }
    });

    // Disconnect Handler
    socket.on('disconnect', async (reason) => {
      console.log(`🔌 User disconnected: ${userId} (reason: ${reason})`);

      // Set offline status
      await presence.setOffline(userId, tenantId);

      // Broadcast offline status to tenant
      if (tenantId) {
        socket.to(`tenant:${tenantId}`).emit('presence:offline', {
          userId,
          tenantId,
          lastSeen: new Date().toISOString(),
        });
      }
    });

    // Error Handler
    socket.on('error', (error) => {
      console.error(`Socket error for user ${userId}:`, error);
    });
  });

  return io;
}

// ============================================
// HELPERS
// ============================================

async function joinUserConversations(socket: AuthenticatedSocket): Promise<void> {
  const { userId } = socket.data;

  try {
    // Get all conversations the user is part of
    const participants = await prisma.participant.findMany({
      where: { userId },
      select: { conversationId: true },
    });

    // Join each conversation room
    for (const p of participants) {
      socket.join(`conversation:${p.conversationId}`);
    }

    console.log(`User ${userId} joined ${participants.length} conversation rooms`);
  } catch (error) {
    console.error(`Failed to join conversations for user ${userId}:`, error);
  }
}
