import { prisma } from './prisma';
import { AuthUser } from './types';

export interface AuditLogParams {
  tenantId: string;
  actorId: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  beforeState?: Record<string, any> | null;
  afterState?: Record<string, any> | null;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export async function createAuditLog(params: AuditLogParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        actorId: params.actorId,
        actorRole: params.actorRole,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        beforeState: params.beforeState ? JSON.stringify(params.beforeState) : null,
        afterState: params.afterState ? JSON.stringify(params.afterState) : null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: params.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    return null;
  }
}

export async function auditUserAction(
  user: AuthUser,
  action: string,
  entityType: string,
  entityId?: string,
  beforeState?: Record<string, any> | null,
  afterState?: Record<string, any> | null,
  ipAddress?: string,
  requestId?: string
) {
  return createAuditLog({
    tenantId: user.tenantId,
    actorId: user.userId,
    actorRole: user.roles[0] || 'EMPLOYEE',
    action,
    entityType,
    entityId,
    beforeState,
    afterState,
    ipAddress,
    requestId,
  });
}
