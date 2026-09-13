import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { DEFAULT_STATUTORY_CONFIG } from '@/lib/payroll/engine';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ruleSets = await prisma.statutoryRuleSet.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      orderBy: { ruleFamily: 'asc' },
    });

    return NextResponse.json({
      ruleSets,
      defaultConfig: DEFAULT_STATUTORY_CONFIG,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasPermission(user, PERMISSIONS.STATUTORY_MANAGE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { ruleFamily, jurisdiction, rulesConfig, version } = body;

    if (!ruleFamily || !jurisdiction || !rulesConfig) {
      return NextResponse.json({ error: 'Missing statutory rule parameters' }, { status: 400 });
    }

    const created = await prisma.statutoryRuleSet.create({
      data: {
        tenantId: user.tenantId,
        ruleFamily,
        jurisdiction,
        rulesConfig: typeof rulesConfig === 'string' ? rulesConfig : JSON.stringify(rulesConfig),
        version: version || 1,
        effectiveFrom: new Date(),
        isActive: true,
        approvedBy: user.userId,
        approvedAt: new Date(),
      },
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'UPDATE_STATUTORY_RULE',
      entityType: 'STATUTORY_RULE_SET',
      entityId: created.id,
      afterState: created,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
