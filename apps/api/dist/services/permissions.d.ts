import { MessagingRule } from '@prisma/client';
export type TenantRole = 'owner' | 'admin' | 'member' | 'billing_admin' | 'support_readonly';
export type PlatformRole = 'platform_admin' | 'platform_support' | 'platform_finance' | 'platform_content_admin';
export interface UserContext {
    userId: string;
    tenantId?: string;
    tenantRole?: TenantRole;
    platformRole?: PlatformRole;
}
export interface PermissionResult {
    allowed: boolean;
    rule?: MessagingRule;
    requiresApproval?: boolean;
    reason?: string;
}
export declare const DEFAULT_RULES: ({
    id: string;
    name: string;
    description: string;
    sourceScope: string;
    sourceRoles: string[];
    targetScope: string;
    targetRoles: string[];
    requireApproval: boolean;
    maxMessagesPerDay: null;
    isActive: boolean;
    priority: number;
} | {
    id: string;
    name: string;
    description: string;
    sourceScope: string;
    sourceRoles: string[];
    targetScope: string;
    targetRoles: string[];
    requireApproval: boolean;
    maxMessagesPerDay: number;
    isActive: boolean;
    priority: number;
})[];
export declare class PermissionService {
    /**
     * Prüft ob ein User einem anderen User eine Nachricht senden darf
     */
    canSendMessage(sender: UserContext, recipient: UserContext): Promise<PermissionResult>;
    /**
     * Prüft ob ein User eine Konversation erstellen darf
     */
    canCreateConversation(creator: UserContext, participantIds: string[], type: 'DIRECT' | 'GROUP' | 'SUPPORT'): Promise<PermissionResult>;
    /**
     * Prüft ob User in einer Konversation ist
     */
    isParticipant(userId: string, conversationId: string): Promise<boolean>;
    /**
     * Prüft ob User Admin/Owner einer Konversation ist
     */
    isConversationAdmin(userId: string, conversationId: string): Promise<boolean>;
    private isBlocked;
    private hasApprovedContact;
    private getPendingRequest;
    private getActiveRules;
    private matchesRule;
    private getMessageCountToday;
}
export declare const permissionService: PermissionService;
//# sourceMappingURL=permissions.d.ts.map