import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { executePayrollCycleRun } from '@/lib/payroll/engine';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const runs = await prisma.payrollRun.findMany({
      where: { tenantId: user.tenantId },
      include: {
        cycle: true,
        items: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
                department: true,
                designation: true,
              },
            },
            adjustments: true,
            payslip: true,
          },
        },
      },
      orderBy: [{ cycle: { year: 'desc' } }, { cycle: { month: 'desc' } }],
    });

    return NextResponse.json({ runs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasPermission(user, PERMISSIONS.PAYROLL_RUN)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { month, year } = body;

    if (!month || !year) {
      return NextResponse.json({ error: 'Month and year are required' }, { status: 400 });
    }

    const run = await executePayrollCycleRun({
      tenantId: user.tenantId,
      month: parseInt(month),
      year: parseInt(year),
      actor: user,
    });

    return NextResponse.json({ success: true, run }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
