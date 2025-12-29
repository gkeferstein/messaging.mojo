import { Redis } from 'ioredis';
export declare const redis: Redis;
export declare const pubClient: Redis;
export declare const subClient: Redis;
export declare const presence: {
    /** User als online markieren */
    setOnline(userId: string, tenantId?: string): Promise<void>;
    /** User als offline markieren */
    setOffline(userId: string, tenantId?: string): Promise<void>;
    /** Prüfen ob User online ist */
    isOnline(userId: string, tenantId?: string): Promise<boolean>;
    /** Alle Online-User eines Tenants */
    getOnlineUsers(tenantId?: string): Promise<string[]>;
    /** LastSeen eines Users */
    getLastSeen(userId: string): Promise<Date | null>;
};
export declare const typing: {
    /** Typing-Indicator setzen (mit TTL) */
    setTyping(conversationId: string, userId: string, isTyping: boolean): Promise<void>;
    /** Alle tippenden User in einer Konversation */
    getTypingUsers(conversationId: string): Promise<string[]>;
};
export default redis;
//# sourceMappingURL=redis.d.ts.map