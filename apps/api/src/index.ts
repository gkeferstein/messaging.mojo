import Fastify, { FastifyError } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'crypto';
import { env } from './config/env.js';
import { setupSocketIO } from './websocket/server.js';
import redis from './lib/redis.js';
import prisma from './lib/prisma.js';
import { AppError } from './lib/errors.js';

// Import routes
import healthRoutes from './routes/health.js';
import conversationRoutes from './routes/conversations.js';
import messageRoutes from './routes/messages.js';
import contactRoutes from './routes/contacts.js';

// ============================================
// FASTIFY SETUP (nach MOJO Coding Standards)
// ============================================

const fastify = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    // Standard Log Format mit Service Name (Section 6.2)
    formatters: {
      level: (label) => ({ level: label }),
    },
    base: {
      service: 'messaging-api',
    },
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    transport: env.isDev
      ? {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  },
  // Generate request IDs
  genReqId: () => randomUUID(),
});

// ============================================
// REQUEST ID PROPAGATION (Section 6.4)
// ============================================

fastify.addHook('onRequest', async (request) => {
  // Use existing request ID from header or generate new one
  const existingId = request.headers['x-request-id'] as string;
  if (existingId) {
    request.id = existingId;
  }
});

fastify.addHook('onSend', async (request, reply) => {
  reply.header('x-request-id', request.id);
});

// ============================================
// PERFORMANCE LOGGING (Section 6.5)
// ============================================

fastify.addHook('onResponse', async (request, reply) => {
  const duration = reply.elapsedTime;
  
  request.log.info({
    method: request.method,
    url: request.url,
    statusCode: reply.statusCode,
    duration: Math.round(duration),
    requestId: request.id,
  }, `${request.method} ${request.url} ${reply.statusCode} - ${Math.round(duration)}ms`);
});

// ============================================
// PLUGINS
// ============================================

// CORS
await fastify.register(cors, {
  origin: env.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Request-ID'],
});

// Security Headers
await fastify.register(helmet, {
  contentSecurityPolicy: false, // Disable for API
});

// Rate Limiting
await fastify.register(rateLimit, {
  max: env.RATE_LIMIT_MAX,
  timeWindow: env.RATE_LIMIT_WINDOW_MS,
  errorResponseBuilder: () => ({
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.',
    },
  }),
});

// ============================================
// ROUTES
// ============================================

// Health routes
await fastify.register(healthRoutes, { prefix: '/api/v1' });

// API routes
await fastify.register(conversationRoutes, { prefix: '/api/v1' });
await fastify.register(messageRoutes, { prefix: '/api/v1' });
await fastify.register(contactRoutes, { prefix: '/api/v1' });

// Root route
fastify.get('/', async (_request, reply) => {
  return reply.send({
    success: true,
    data: {
      service: 'messaging.mojo',
      version: '1.0.0',
      status: 'online',
      docs: '/api/v1/docs',
      health: '/api/v1/health',
    },
  });
});

// ============================================
// ERROR HANDLER (Section 5.2)
// ============================================

fastify.setNotFoundHandler(async (_request, reply) => {
  return reply.status(404).send({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Die angeforderte Ressource wurde nicht gefunden',
    },
  });
});

fastify.setErrorHandler(async (error: FastifyError, request, reply) => {
  // AppError - strukturierte Fehler
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  // Zod Validation Errors
  if (error.name === 'ZodError' && 'issues' in error) {
    const zodError = error as unknown as { issues: Array<{ path: string[]; message: string }> };
    const fields: Record<string, string> = {};
    
    for (const issue of zodError.issues) {
      const path = issue.path.join('.');
      fields[path] = issue.message;
    }

    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validierung fehlgeschlagen',
        details: { fields },
      },
    });
  }

  // Fastify Validation Errors
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: { validation: error.validation },
      },
    });
  }

  // Rate Limit Errors
  if (error.statusCode === 429) {
    return reply.status(429).send({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.',
      },
    });
  }

  // Unknown errors - log and return generic message
  request.log.error({
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    requestId: request.id,
  }, 'Unhandled error');

  return reply.status(error.statusCode || 500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: env.isProd ? 'Ein interner Fehler ist aufgetreten' : error.message,
    },
  });
});

// ============================================
// STARTUP
// ============================================

async function start(): Promise<void> {
  try {
    // Connect to Redis
    await redis.connect();
    console.log('🟢 Redis connected');

    // Test database connection
    await prisma.$connect();
    console.log('🟢 Database connected');

    // Start HTTP server
    await fastify.listen({
      port: env.PORT,
      host: env.HOST,
    });

    console.log(`🚀 HTTP server running on http://${env.HOST}:${env.PORT}`);

    // Setup Socket.io on the same server
    const io = await setupSocketIO(fastify.server);
    console.log(`🔌 WebSocket server ready on ws://${env.HOST}:${env.PORT}`);

    console.log('');
    console.log('📡 MOJO Messaging API');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   REST API: http://${env.HOST}:${env.PORT}/api/v1`);
    console.log(`   WebSocket: ws://${env.HOST}:${env.PORT}`);
    console.log(`   Health: http://${env.HOST}:${env.PORT}/api/v1/health`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Failed to start server:', errorMessage);
    process.exit(1);
  }
}

// Graceful Shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`\n📴 Received ${signal}, shutting down gracefully...`);

  try {
    await fastify.close();
    await prisma.$disconnect();
    await redis.quit();
    console.log('✅ Server shut down successfully');
    process.exit(0);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Error during shutdown:', errorMessage);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start the server
start();
