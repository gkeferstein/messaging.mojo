import { Redis } from 'ioredis';
import { env } from '../config/env.js';

// Haupt-Redis-Client für allgemeine Operationen
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: true,
});

// Event Handler
redis.on('connect', () => {
  console.log('🟢 Redis connected');
});

redis.on('error', (err: Error) => {
  console.error('🔴 Redis error:', err.message);
});

// Online-Status Helpers
const ONLINE_SET_PREFIX = 'online:';
const LAST_SEEN_PREFIX = 'user:lastSeen:';
const TYPING_PREFIX = 'typing:';

export const presence = {
  /** User als online markieren */
  async setOnline(userId: string, tenantId?: string): Promise<void> {
    const key = tenantId ? `${ONLINE_SET_PREFIX}${tenantId}` : `${ONLINE_SET_PREFIX}global`;
    await redis.sadd(key, userId);
    await redis.set(`${LAST_SEEN_PREFIX}${userId}`, Date.now().toString());
  },

  /** User als offline markieren */
  async setOffline(userId: string, tenantId?: string): Promise<void> {
    const key = tenantId ? `${ONLINE_SET_PREFIX}${tenantId}` : `${ONLINE_SET_PREFIX}global`;
    await redis.srem(key, userId);
    await redis.set(`${LAST_SEEN_PREFIX}${userId}`, Date.now().toString());
  },

  /** Prüfen ob User online ist */
  async isOnline(userId: string, tenantId?: string): Promise<boolean> {
    const key = tenantId ? `${ONLINE_SET_PREFIX}${tenantId}` : `${ONLINE_SET_PREFIX}global`;
    return (await redis.sismember(key, userId)) === 1;
  },

  /** Alle Online-User eines Tenants */
  async getOnlineUsers(tenantId?: string): Promise<string[]> {
    const key = tenantId ? `${ONLINE_SET_PREFIX}${tenantId}` : `${ONLINE_SET_PREFIX}global`;
    return redis.smembers(key);
  },

  /** LastSeen eines Users */
  async getLastSeen(userId: string): Promise<Date | null> {
    const timestamp = await redis.get(`${LAST_SEEN_PREFIX}${userId}`);
    return timestamp ? new Date(parseInt(timestamp, 10)) : null;
  },
};

export const typing = {
  /** Typing-Indicator setzen (mit TTL) */
  async setTyping(conversationId: string, userId: string, isTyping: boolean): Promise<void> {
    const key = `${TYPING_PREFIX}${conversationId}`;
    if (isTyping) {
      await redis.hset(key, userId, Date.now().toString());
      await redis.expire(key, 10); // 10 Sekunden TTL
    } else {
      await redis.hdel(key, userId);
    }
  },

  /** Alle tippenden User in einer Konversation */
  async getTypingUsers(conversationId: string): Promise<string[]> {
    const key = `${TYPING_PREFIX}${conversationId}`;
    const typingData = await redis.hgetall(key);
    const now = Date.now();
    const activeUsers: string[] = [];

    for (const [usrId, timestamp] of Object.entries(typingData)) {
      // Nur User die in den letzten 5 Sekunden getippt haben
      if (now - parseInt(timestamp, 10) < 5000) {
        activeUsers.push(usrId);
      }
    }

    return activeUsers;
  },
};

export default redis;
