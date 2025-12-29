import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import redis from '../lib/redis.js';
import { sendSuccess } from '../lib/response.js';

export default async function healthRoutes(fastify: FastifyInstance) {
  // Simple health check
  fastify.get('/health', async (_request, reply) => {
    return sendSuccess(reply, {
      status: 'ok',
      service: 'messaging-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Detailed health check with service status
  fastify.get('/health/detailed', async (_request, reply) => {
    const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

    // Check Database
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = {
        status: 'healthy',
        latency: Date.now() - dbStart,
      };
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check Redis
    const redisStart = Date.now();
    try {
      await redis.ping();
      checks.redis = {
        status: 'healthy',
        latency: Date.now() - redisStart,
      };
    } catch (error) {
      checks.redis = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Overall status
    const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');
    const status = allHealthy ? 'ok' : 'degraded';

    if (!allHealthy) {
      return reply.status(503).send({
        success: true,
        data: {
          status,
          service: 'messaging-api',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          checks,
        },
      });
    }

    return sendSuccess(reply, {
      status,
      service: 'messaging-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    });
  });

  // Kubernetes readiness probe
  fastify.get('/ready', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await redis.ping();
      return sendSuccess(reply, { ready: true });
    } catch {
      return reply.status(503).send({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service not ready',
        },
      });
    }
  });

  // Kubernetes liveness probe
  fastify.get('/live', async (_request, reply) => {
    return sendSuccess(reply, { live: true });
  });
}
