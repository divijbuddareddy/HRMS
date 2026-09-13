import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { overridePayrollComponent } from '@/lib/payroll/engine';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasPermission(user, PERMISSIONS.PAYROLL_OVERRIDE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { payrollItemId, componentCode, newAmount, reason } = body;

    if (!payrollItemId || !componentCode || newAmount == null || !reason) {
      return NextResponse.json({ error: 'payrollItemId, componentCode, newAmount and reason are required' }, { status: 400 });
    }

    const updatedItem = await overridePayrollComponent({
      tenantId: user.tenantId,
      payrollItemId,
      componentCode,
      newAmount: parseFloat(newAmount),
      reason,
      actor: user,
    });

    return NextResponse.json({ success: true, item: updatedItem });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
