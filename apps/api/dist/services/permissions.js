import prisma from '../lib/prisma.js';
// ============================================
// DEFAULT RULES (Falls keine in DB)
// ============================================
export const DEFAULT_RULES = [
    {
        id: 'team-internal',
        name: 'Team-interne Kommunikation',
        description: 'Mitglieder der gleichen Organisation können frei kommunizieren',
        sourceScope: 'tenant',
        sourceRoles: ['owner', 'admin', 'member'],
        targetScope: 'tenant',
        targetRoles: ['owner', 'admin', 'member'],
        requireApproval: false,
        maxMessagesPerDay: null,
        isActive: true,
        priority: 100,
    },
    {
        id: 'cross-org-managers',
        name: 'Organisation-übergreifend (Manager)',
        description: 'Owner und Admins können andere Owner/Admins über Organisationen hinweg kontaktieren',
        sourceScope: 'platform',
        sourceRoles: ['owner', 'admin'],
        targetScope: 'platform',
        targetRoles: ['owner', 'admin'],
        requireApproval: true,
        maxMessagesPerDay: 10,
        isActive: true,
        priority: 50,
    },
    {
        id: 'support-channel',
        name: 'Support-Kanal',
        description: 'Alle User können den MOJO Support kontaktieren',
        sourceScope: 'platform',
        sourceRoles: ['owner', 'admin', 'member'],
        targetScope: 'platform',
        targetRoles: ['platform_support'],
        requireApproval: false,
        maxMessagesPerDay: null,
        isActive: true,
        priority: 90,
    },
    {
        id: 'platform-announcements',
        name: 'Plattform-Ankündigungen',
        description: 'Plattform-Admins können Ankündigungen an alle senden',
        sourceScope: 'platform',
        sourceRoles: ['platform_admin'],
        targetScope: 'platform',
        targetRoles: ['owner', 'admin', 'member'],
        requireApproval: false,
        maxMessagesPerDay: null,
        isActive: true,
        priority: 80,
    },
];
// ============================================
// PERMISSION SERVICE
// ============================================
export class PermissionService {
    /**
     * Prüft ob ein User einem anderen User eine Nachricht senden darf
     */
    async canSendMessage(sender, recipient) {
        // 1. Selbst-Nachrichten erlauben (für Notizen etc.)
        if (sender.userId === recipient.userId) {
            return { allowed: true, reason: 'Self-messaging allowed' };
        }
        // 2. Prüfe ob blockiert
        const isBlocked = await this.isBlocked(sender.userId, recipient.userId);
        if (isBlocked) {
            return { allowed: false, reason: 'User is blocked' };
        }
        // 3. Gleicher Tenant = immer erlaubt (wenn beide einen haben)
        if (sender.tenantId && sender.tenantId === recipient.tenantId) {
            return { allowed: true, reason: 'Same tenant' };
        }
        // 4. Prüfe existierende akzeptierte Kontaktanfrage
        const hasApprovedContact = await this.hasApprovedContact(sender.userId, recipient.userId);
        if (hasApprovedContact) {
            return { allowed: true, reason: 'Approved contact' };
        }
        // 5. Prüfe Messaging Rules
        const rules = await this.getActiveRules();
        for (const rule of rules) {
            const matches = this.matchesRule(rule, sender, recipient);
            if (matches) {
                if (rule.requireApproval) {
                    // Prüfe ob bereits eine Anfrage existiert
                    const pendingRequest = await this.getPendingRequest(sender.userId, recipient.userId);
                    if (pendingRequest) {
                        return {
                            allowed: false,
                            rule,
                            requiresApproval: true,
                            reason: 'Contact request pending',
                        };
                    }
                    return {
                        allowed: false,
                        rule,
                        requiresApproval: true,
                        reason: 'Contact request required',
                    };
                }
                // Prüfe Rate-Limit
                if (rule.maxMessagesPerDay) {
                    const messageCount = await this.getMessageCountToday(sender.userId, recipient.userId);
                    if (messageCount >= rule.maxMessagesPerDay) {
                        return {
                            allowed: false,
                            rule,
                            reason: `Rate limit exceeded (${rule.maxMessagesPerDay}/day)`,
                        };
                    }
                }
                return { allowed: true, rule };
            }
        }
        // Keine passende Regel gefunden
        return { allowed: false, reason: 'No matching permission rule' };
    }
    /**
     * Prüft ob ein User eine Konversation erstellen darf
     */
    async canCreateConversation(creator, participantIds, type) {
        // Support-Konversationen sind immer erlaubt
        if (type === 'SUPPORT') {
            return { allowed: true, reason: 'Support conversations always allowed' };
        }
        // Für DIRECT: Prüfe Berechtigung zum ersten Teilnehmer
        if (type === 'DIRECT' && participantIds.length === 1) {
            return this.canSendMessage(creator, { userId: participantIds[0] });
        }
        // Für GROUP: Prüfe Berechtigung zu allen Teilnehmern
        if (type === 'GROUP') {
            for (const participantId of participantIds) {
                const result = await this.canSendMessage(creator, { userId: participantId });
                if (!result.allowed) {
                    return {
                        allowed: false,
                        reason: `Cannot add user ${participantId}: ${result.reason}`,
                    };
                }
            }
            return { allowed: true, reason: 'All participants allowed' };
        }
        return { allowed: false, reason: 'Unknown conversation type' };
    }
    /**
     * Prüft ob User in einer Konversation ist
     */
    async isParticipant(userId, conversationId) {
        const participant = await prisma.participant.findUnique({
            where: {
                conversationId_userId: { conversationId, userId },
            },
        });
        return !!participant;
    }
    /**
     * Prüft ob User Admin/Owner einer Konversation ist
     */
    async isConversationAdmin(userId, conversationId) {
        const participant = await prisma.participant.findUnique({
            where: {
                conversationId_userId: { conversationId, userId },
            },
        });
        return participant?.role === 'OWNER' || participant?.role === 'ADMIN';
    }
    // ============================================
    // PRIVATE HELPERS
    // ============================================
    async isBlocked(userId, targetUserId) {
        const blocked = await prisma.blockedUser.findFirst({
            where: {
                OR: [
                    { userId, blockedUserId: targetUserId },
                    { userId: targetUserId, blockedUserId: userId },
                ],
            },
        });
        return !!blocked;
    }
    async hasApprovedContact(userId1, userId2) {
        const contact = await prisma.contactRequest.findFirst({
            where: {
                OR: [
                    { fromUserId: userId1, toUserId: userId2, status: 'ACCEPTED' },
                    { fromUserId: userId2, toUserId: userId1, status: 'ACCEPTED' },
                ],
            },
        });
        return !!contact;
    }
    async getPendingRequest(fromUserId, toUserId) {
        return prisma.contactRequest.findFirst({
            where: {
                fromUserId,
                toUserId,
                status: 'PENDING',
                expiresAt: { gt: new Date() },
            },
        });
    }
    async getActiveRules() {
        const dbRules = await prisma.messagingRule.findMany({
            where: { isActive: true },
            orderBy: { priority: 'desc' },
        });
        // Falls keine DB-Regeln, nutze Defaults
        if (dbRules.length === 0) {
            return DEFAULT_RULES;
        }
        return dbRules;
    }
    matchesRule(rule, sender, recipient) {
        const sourceRoles = rule.sourceRoles;
        const targetRoles = rule.targetRoles;
        // Prüfe Source-Scope
        if (rule.sourceScope === 'tenant') {
            // Sender muss Tenant haben und passende Rolle
            if (!sender.tenantId || !sender.tenantRole) {
                return false;
            }
            if (!sourceRoles.includes(sender.tenantRole)) {
                return false;
            }
        }
        else if (rule.sourceScope === 'platform') {
            // Sender braucht entweder Tenant-Rolle oder Platform-Rolle
            const hasRole = (sender.tenantRole && sourceRoles.includes(sender.tenantRole)) ||
                (sender.platformRole && sourceRoles.includes(sender.platformRole));
            if (!hasRole) {
                return false;
            }
        }
        // Prüfe Target-Scope
        if (rule.targetScope === 'tenant') {
            // Gleicher Tenant erforderlich
            if (sender.tenantId !== recipient.tenantId) {
                return false;
            }
            if (!recipient.tenantRole) {
                return false;
            }
            if (!targetRoles.includes(recipient.tenantRole)) {
                return false;
            }
        }
        else if (rule.targetScope === 'platform') {
            // Recipient braucht passende Rolle
            const hasRole = (recipient.tenantRole && targetRoles.includes(recipient.tenantRole)) ||
                (recipient.platformRole && targetRoles.includes(recipient.platformRole));
            if (!hasRole) {
                return false;
            }
        }
        return true;
    }
    async getMessageCountToday(senderId, recipientId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Finde Direktkonversation zwischen den beiden
        const conversation = await prisma.conversation.findFirst({
            where: {
                type: 'DIRECT',
                participants: {
                    every: {
                        userId: { in: [senderId, recipientId] },
                    },
                },
            },
        });
        if (!conversation) {
            return 0;
        }
        // Zähle Nachrichten von heute
        const count = await prisma.message.count({
            where: {
                conversationId: conversation.id,
                senderId,
                createdAt: { gte: today },
            },
        });
        return count;
    }
}
// Singleton Export
export const permissionService = new PermissionService();
//# sourceMappingURL=permissions.js.map