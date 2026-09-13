import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { lockAndPublishPayrollRun } from '@/lib/payroll/engine';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body; // 'APPROVE' | 'LOCK' | 'PUBLISH'

    if (!['APPROVE', 'LOCK', 'PUBLISH'].includes(action)) {
      return NextResponse.json({ error: 'Action must be APPROVE, LOCK, or PUBLISH' }, { status: 400 });
    }

    if (action === 'APPROVE' && !hasPermission(user, PERMISSIONS.PAYROLL_APPROVE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (action === 'LOCK' && !hasPermission(user, PERMISSIONS.PAYROLL_LOCK)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (action === 'PUBLISH' && !hasPermission(user, PERMISSIONS.PAYROLL_PUBLISH)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await lockAndPublishPayrollRun({
      tenantId: user.tenantId,
      payrollRunId: id,
      actor: user,
      action,
    });

    return NextResponse.json({ success: true, run: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
