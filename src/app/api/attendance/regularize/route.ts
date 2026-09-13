import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { requestAttendanceRegularization, approveAttendanceRegularization } from '@/lib/attendance/engine';
import { prisma } from '@/lib/prisma';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';

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
      // Team / Manager view: either direct reports or pending approvals
      const isApprover = user.roles.some((r) => ['MANAGER', 'HR_ADMIN', 'COMPANY_ADMIN'].includes(r));
      if (!isApprover) {
        where.employeeId = user.employeeId;
      }
    }

    const requests = await prisma.attendanceRegularization.findMany({
      where,
      include: {
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
    const { requestedDate, proposedCheckIn, proposedCheckOut, reason, attachmentUrl } = body;

    if (!requestedDate || !proposedCheckIn || !proposedCheckOut || !reason) {
      return NextResponse.json({ error: 'Missing required regularization details' }, { status: 400 });
    }

    const regularization = await requestAttendanceRegularization({
      tenantId: user.tenantId,
      employeeId: user.employeeId,
      requestedDate: new Date(requestedDate),
      proposedCheckIn: new Date(proposedCheckIn),
      proposedCheckOut: new Date(proposedCheckOut),
      reason,
      attachmentUrl,
    });

    return NextResponse.json({ success: true, regularization }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { regularizationId, decision, notes } = body;

    if (!regularizationId || !['APPROVED', 'REJECTED'].includes(decision)) {
      return NextResponse.json({ error: 'regularizationId and decision (APPROVED/REJECTED) are required' }, { status: 400 });
    }

    const result = await approveAttendanceRegularization({
      tenantId: user.tenantId,
      regularizationId,
      actor: user,
      status: decision,
      notes,
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
