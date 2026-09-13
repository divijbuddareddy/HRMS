import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { recordRawAttendancePunch } from '@/lib/attendance/engine';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!user.employeeId) {
      return NextResponse.json({ error: 'User is not linked to an employee profile' }, { status: 400 });
    }

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const [todayRecord, rawPunches, shift] = await Promise.all([
      prisma.dailyAttendanceRecord.findUnique({
        where: {
          tenantId_employeeId_date: {
            tenantId: user.tenantId,
            employeeId: user.employeeId,
            date: todayStart,
          },
        },
      }),
      prisma.rawAttendancePunch.findMany({
        where: {
          tenantId: user.tenantId,
          employeeId: user.employeeId,
          punchTimestamp: { gte: todayStart, lte: todayEnd },
        },
        orderBy: { punchTimestamp: 'asc' },
      }),
      prisma.shiftPolicy.findFirst({
        where: { tenantId: user.tenantId, isDefault: true },
      }),
    ]);

    const hasCheckedIn = rawPunches.some((p) => p.punchType === 'CHECK_IN');
    const hasCheckedOut = rawPunches.some((p) => p.punchType === 'CHECK_OUT');

    return NextResponse.json({
      todayRecord,
      rawPunches,
      shift,
      hasCheckedIn,
      hasCheckedOut,
      nextAction: !hasCheckedIn ? 'CHECK_IN' : !hasCheckedOut ? 'CHECK_OUT' : 'COMPLETED',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!user.employeeId) {
      return NextResponse.json({ error: 'User is not linked to an employee record' }, { status: 400 });
    }

    const body = await req.json();
    const { punchType, latitude, longitude, accuracy, selfieUrl, deviceType, employeeId: requestedEmployeeId } = body;

    const targetEmployeeId = requestedEmployeeId || user.employeeId;
    if (!targetEmployeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    if (!punchType || !['CHECK_IN', 'CHECK_OUT'].includes(punchType)) {
      return NextResponse.json({ error: 'punchType must be CHECK_IN or CHECK_OUT' }, { status: 400 });
    }

    const clientIp = req.headers.get('x-forwarded-for') || '192.168.1.140';

    const punch = await recordRawAttendancePunch({
      tenantId: user.tenantId,
      employeeId: targetEmployeeId,
      punchType,
      deviceType: deviceType || 'BIOMETRIC',
      latitude: latitude != null ? parseFloat(latitude) : 12.9716,
      longitude: longitude != null ? parseFloat(longitude) : 77.5946,
      accuracy: accuracy != null ? parseFloat(accuracy) : 5,
      selfieUrl,
      ipAddress: clientIp,
    });

    const emp = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: { firstName: true, lastName: true, employeeCode: true },
    });

    return NextResponse.json({
      success: true,
      punch,
      employee: emp,
      message: `${punchType === 'CHECK_IN' ? 'Check-in' : 'Check-out'} recorded successfully via ${deviceType || 'BIOMETRIC'}.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
