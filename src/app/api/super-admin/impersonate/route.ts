import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isSuperAdmin = user.roles.includes('PLATFORM_SUPER_ADMIN') || user.roles.includes('COMPANY_ADMIN');
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { targetUserId, targetTenantId, reason } = body;

    const log = await prisma.supportImpersonationLog.create({
      data: {
        tenantId: targetTenantId || user.tenantId,
        supportUserId: user.userId,
        targetUserId: targetUserId || user.userId,
        reason: reason || 'Customer support investigation request',
        startedAt: new Date(),
      },
    });

    await createAuditLog({
      tenantId: targetTenantId || user.tenantId,
      actorId: user.userId,
      actorRole: 'PLATFORM_SUPER_ADMIN',
      action: 'SUPPORT_IMPERSONATION_START',
      entityType: 'TENANT',
      entityId: targetTenantId,
      afterState: { targetUserId, reason },
    });

    return NextResponse.json({ success: true, impersonationLog: log });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
