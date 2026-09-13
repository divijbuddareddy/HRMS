import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { executePayrollCycleRun } from '@/lib/payroll/engine';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasPermission(user, PERMISSIONS.PAYROLL_RUN)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const run = await prisma.payrollRun.findUnique({
      where: { id },
      include: { cycle: true },
    });

    if (!run || run.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    if (['LOCKED', 'PUBLISHED'].includes(run.status)) {
      return NextResponse.json({ error: `Cannot recalculate a ${run.status.toLowerCase()} payroll run` }, { status: 400 });
    }

    const updated = await executePayrollCycleRun({
      tenantId: user.tenantId,
      month: run.cycle.month,
      year: run.cycle.year,
      actor: user,
    });

    return NextResponse.json({ success: true, run: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
