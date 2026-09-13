import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const employeeId = searchParams.get('employeeId') || user.employeeId;
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId required' }, { status: 400 });
    }

    const startDate = startOfMonth(new Date(year, month - 1, 1));
    const endDate = endOfMonth(new Date(year, month - 1, 1));

    const [records, regularizations, employee] = await Promise.all([
      prisma.dailyAttendanceRecord.findMany({
        where: {
          tenantId: user.tenantId,
          employeeId,
          date: { gte: startDate, lte: endDate },
        },
        include: { shift: true },
        orderBy: { date: 'asc' },
      }),
      prisma.attendanceRegularization.findMany({
        where: {
          tenantId: user.tenantId,
          employeeId,
          requestedDate: { gte: startDate, lte: endDate },
        },
        orderBy: { requestedDate: 'desc' },
      }),
      prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, firstName: true, lastName: true, employeeCode: true, department: true },
      }),
    ]);

    // Compute monthly summaries
    let presentCount = 0;
    let absentCount = 0;
    let halfDayCount = 0;
    let lateCount = 0;
    let totalWorkedMinutes = 0;

    for (const r of records) {
      if (r.status === 'PRESENT') presentCount += 1;
      else if (r.status === 'ABSENT') absentCount += 1;
      else if (r.status === 'HALF_DAY') halfDayCount += 1;
      if (r.isLate) lateCount += 1;
      totalWorkedMinutes += r.totalWorkedMinutes;
    }

    return NextResponse.json({
      employee,
      month,
      year,
      summary: {
        presentDays: presentCount,
        absentDays: absentCount,
        halfDays: halfDayCount,
        lateDays: lateCount,
        totalWorkedHours: (totalWorkedMinutes / 60).toFixed(1),
      },
      records,
      regularizations,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
