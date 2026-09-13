import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateAndApplyLeave } from '@/lib/leave/engine';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const view = searchParams.get('view'); // 'mine' or 'team'

    let where: any = { tenantId: user.tenantId };
    if (view === 'mine') {
      where.employeeId = user.employeeId;
    } else {
      const isManager = user.roles.some((r) => ['MANAGER', 'HR_ADMIN', 'COMPANY_ADMIN'].includes(r));
      if (!isManager) {
        where.employeeId = user.employeeId;
      }
    }

    const requests = await prisma.leaveRequest.findMany({
      where,
      include: {
        leaveType: true,
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true, department: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ requests });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!user.employeeId) {
      return NextResponse.json({ error: 'User is not linked to an employee profile' }, { status: 400 });
    }

    const body = await req.json();
    const { leaveTypeId, startDate, endDate, isHalfDay, halfDaySession, reason, attachmentUrl } = body;

    if (!leaveTypeId || !startDate || !endDate || !reason) {
      return NextResponse.json({ error: 'Missing required leave request fields' }, { status: 400 });
    }

    const leaveRequest = await validateAndApplyLeave({
      tenantId: user.tenantId,
      employeeId: user.employeeId,
      leaveTypeId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isHalfDay: Boolean(isHalfDay),
      halfDaySession,
      reason,
      attachmentUrl,
    });

    return NextResponse.json({ success: true, leaveRequest }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
