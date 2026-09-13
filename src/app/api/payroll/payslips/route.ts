import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const employeeId = searchParams.get('employeeId') || user.employeeId;
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;

    // Check permissions if requesting other employee's payslip
    if (employeeId !== user.employeeId && !hasPermission(user, PERMISSIONS.PAYROLL_READ)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId required' }, { status: 400 });
    }

    const payslips = await prisma.payslip.findMany({
      where: {
        tenantId: user.tenantId,
        employeeId,
        ...(month ? { month } : {}),
        ...(year ? { year } : {}),
      },
      include: {
        payrollItem: true,
        employee: {
          include: {
            legalEntity: true,
            branchLocation: true,
            department: true,
            designation: true,
            bank: true,
            identity: true,
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return NextResponse.json({ payslips });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
