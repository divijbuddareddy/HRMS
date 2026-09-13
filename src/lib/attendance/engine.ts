import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { createAuditLog } from '../audit';
import { startOfDay, endOfDay, differenceInMinutes, parse, format } from 'date-fns';

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

// Calculate distance between two coordinates in meters (Haversine formula)
export function calculateHaversineDistance(coord1: GeoCoordinate, coord2: GeoCoordinate): number {
  const R = 6371e3; // Earth's radius in meters
  const lat1 = (coord1.latitude * Math.PI) / 180;
  const lat2 = (coord2.latitude * Math.PI) / 180;
  const deltaLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const deltaLng = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export interface RecordPunchParams {
  tenantId: string;
  employeeId: string;
  punchType: 'CHECK_IN' | 'CHECK_OUT';
  deviceType?: 'WEB' | 'MOBILE_GPS' | 'QR' | 'BIOMETRIC';
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  selfieUrl?: string;
  ipAddress?: string;
  timestamp?: Date;
}

export async function recordRawAttendancePunch(params: RecordPunchParams) {
  const employee = await prisma.employee.findUnique({
    where: { id: params.employeeId },
    include: { branchLocation: true },
  });

  if (!employee) {
    throw new Error('Employee not found');
  }

  let isGeofenced = true;
  if (
    params.latitude != null &&
    params.longitude != null &&
    employee.branchLocation?.latitude != null &&
    employee.branchLocation?.longitude != null
  ) {
    const dist = calculateHaversineDistance(
      { latitude: params.latitude, longitude: params.longitude },
      { latitude: employee.branchLocation.latitude, longitude: employee.branchLocation.longitude }
    );
    const maxRadius = employee.branchLocation.geofenceRadiusMeters || 200;
    isGeofenced = dist <= maxRadius;
  }

  const punchTimestamp = params.timestamp || new Date();

  // 1. IMMUTABLE Raw punch creation
  const punch = await prisma.rawAttendancePunch.create({
    data: {
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      punchTimestamp,
      punchType: params.punchType,
      deviceType: params.deviceType || 'WEB',
      latitude: params.latitude,
      longitude: params.longitude,
      accuracy: params.accuracy,
      isGeofenced,
      selfieUrl: params.selfieUrl,
      ipAddress: params.ipAddress,
      verificationStatus: isGeofenced ? 'VERIFIED' : 'GEOFENCE_WARNING',
    },
  });

  // 2. Trigger daily attendance derivation for this date
  await processDailyAttendanceRecord(params.tenantId, params.employeeId, punchTimestamp);

  return punch;
}

export async function processDailyAttendanceRecord(
  tenantId: string,
  employeeId: string,
  targetDate: Date
) {
  const dayStart = startOfDay(targetDate);
  const dayEnd = endOfDay(targetDate);

  // Fetch employee with shift & branch
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { branchLocation: true },
  });
  if (!employee) return null;

  // Fetch shift policy (or default shift: 09:30 - 18:30)
  let shift = await prisma.shiftPolicy.findFirst({
    where: { tenantId, isDefault: true },
  });
  if (!shift) {
    shift = await prisma.shiftPolicy.create({
      data: {
        tenantId,
        name: 'Standard General Shift',
        code: 'GEN_0930_1830',
        startTime: '09:30',
        endTime: '18:30',
        graceMinutes: 15,
        halfDayMinutes: 240,
        fullDayMinutes: 480,
        isDefault: true,
      },
    });
  }

  // Check if holiday
  const holiday = await prisma.holiday.findFirst({
    where: {
      tenantId,
      date: { gte: dayStart, lte: dayEnd },
    },
  });

  // Check if approved leave exists
  const approvedLeave = await prisma.leaveRequest.findFirst({
    where: {
      tenantId,
      employeeId,
      status: 'APPROVED',
      startDate: { lte: dayEnd },
      endDate: { gte: dayStart },
    },
    include: { leaveType: true },
  });

  // Check week-off (Saturday/Sunday for standard policy)
  const dayOfWeek = dayStart.getDay(); // 0 is Sunday, 6 is Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Fetch all raw punches for this day
  const rawPunches = await prisma.rawAttendancePunch.findMany({
    where: {
      tenantId,
      employeeId,
      punchTimestamp: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { punchTimestamp: 'asc' },
  });

  let firstCheckIn: Date | null = null;
  let lastCheckOut: Date | null = null;

  for (const p of rawPunches) {
    if (p.punchType === 'CHECK_IN' && !firstCheckIn) {
      firstCheckIn = p.punchTimestamp;
    }
    if (p.punchType === 'CHECK_OUT') {
      lastCheckOut = p.punchTimestamp;
    }
  }

  let totalWorkedMinutes = 0;
  if (firstCheckIn && lastCheckOut && lastCheckOut > firstCheckIn) {
    totalWorkedMinutes = differenceInMinutes(lastCheckOut, firstCheckIn);
  } else if (firstCheckIn && !lastCheckOut) {
    // Single punch logged so far
    totalWorkedMinutes = 0;
  }

  // Calculate Late / Early Departure
  let isLate = false;
  let lateMinutes = 0;
  let isEarlyDeparture = false;
  let earlyDepartureMinutes = 0;
  let overtimeMinutes = 0;

  if (firstCheckIn) {
    const shiftStartToday = parse(
      `${format(targetDate, 'yyyy-MM-dd')} ${shift.startTime}`,
      'yyyy-MM-dd HH:mm',
      new Date()
    );
    const lateThreshold = new Date(shiftStartToday.getTime() + shift.graceMinutes * 60000);
    if (firstCheckIn > lateThreshold) {
      isLate = true;
      lateMinutes = Math.max(0, differenceInMinutes(firstCheckIn, shiftStartToday));
    }
  }

  if (lastCheckOut) {
    const shiftEndToday = parse(
      `${format(targetDate, 'yyyy-MM-dd')} ${shift.endTime}`,
      'yyyy-MM-dd HH:mm',
      new Date()
    );
    if (lastCheckOut < shiftEndToday) {
      isEarlyDeparture = true;
      earlyDepartureMinutes = Math.max(0, differenceInMinutes(shiftEndToday, lastCheckOut));
    } else if (differenceInMinutes(lastCheckOut, shiftEndToday) > 30) {
      overtimeMinutes = differenceInMinutes(lastCheckOut, shiftEndToday);
    }
  }

  // Determine Attendance Status
  let status = 'ABSENT';
  if (holiday) {
    status = 'HOLIDAY';
  } else if (approvedLeave) {
    status = approvedLeave.isHalfDay ? 'HALF_DAY' : (approvedLeave.leaveType.isPaid ? 'PRESENT' : 'LOP');
  } else if (isWeekend) {
    status = 'WEEK_OFF';
  } else if (totalWorkedMinutes >= shift.fullDayMinutes) {
    status = 'PRESENT';
  } else if (totalWorkedMinutes >= shift.halfDayMinutes) {
    status = 'HALF_DAY';
  } else if (firstCheckIn && !lastCheckOut) {
    status = 'PRESENT'; // in-progress work day
  }

  // Upsert Daily Attendance Record
  const existingRecord = await prisma.dailyAttendanceRecord.findUnique({
    where: {
      tenantId_employeeId_date: {
        tenantId,
        employeeId,
        date: dayStart,
      },
    },
  });

  if (existingRecord?.isRegularized) {
    // Preserve regularized state
    return existingRecord;
  }

  const record = await prisma.dailyAttendanceRecord.upsert({
    where: {
      tenantId_employeeId_date: {
        tenantId,
        employeeId,
        date: dayStart,
      },
    },
    update: {
      firstCheckIn,
      lastCheckOut,
      totalWorkedMinutes,
      status,
      isLate,
      isEarlyDeparture,
      lateMinutes,
      earlyDepartureMinutes,
      overtimeMinutes,
      shiftId: shift.id,
    },
    create: {
      tenantId,
      employeeId,
      date: dayStart,
      firstCheckIn,
      lastCheckOut,
      totalWorkedMinutes,
      status,
      isLate,
      isEarlyDeparture,
      lateMinutes,
      earlyDepartureMinutes,
      overtimeMinutes,
      shiftId: shift.id,
    },
  });

  return record;
}

export async function requestAttendanceRegularization(params: {
  tenantId: string;
  employeeId: string;
  requestedDate: Date;
  proposedCheckIn: Date;
  proposedCheckOut: Date;
  reason: string;
  attachmentUrl?: string;
  approverId?: string;
  backupApproverId?: string;
}) {
  const dayStart = startOfDay(params.requestedDate);

  // Ensure daily attendance record exists
  let record = await prisma.dailyAttendanceRecord.findUnique({
    where: {
      tenantId_employeeId_date: {
        tenantId: params.tenantId,
        employeeId: params.employeeId,
        date: dayStart,
      },
    },
  });

  if (!record) {
    record = await prisma.dailyAttendanceRecord.create({
      data: {
        tenantId: params.tenantId,
        employeeId: params.employeeId,
        date: dayStart,
        status: 'ABSENT',
      },
    });
  }

  const regularization = await prisma.attendanceRegularization.create({
    data: {
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      attendanceRecordId: record.id,
      requestedDate: dayStart,
      proposedCheckIn: params.proposedCheckIn,
      proposedCheckOut: params.proposedCheckOut,
      reason: params.reason,
      attachmentUrl: params.attachmentUrl,
      approverId: params.approverId,
      backupApproverId: params.backupApproverId,
      status: 'PENDING',
    },
  });

  return regularization;
}

export async function approveAttendanceRegularization(params: {
  tenantId: string;
  regularizationId: string;
  actor: AuthUser;
  status: 'APPROVED' | 'REJECTED';
  notes?: string;
}) {
  const reg = await prisma.attendanceRegularization.findUnique({
    where: { id: params.regularizationId },
    include: { attendanceRecord: true },
  });

  if (!reg) throw new Error('Regularization request not found');
  if (reg.status !== 'PENDING') throw new Error('Regularization already processed');

  const updatedReg = await prisma.attendanceRegularization.update({
    where: { id: params.regularizationId },
    data: {
      status: params.status,
      approvedAt: new Date(),
      approverNotes: params.notes,
    },
  });

  if (params.status === 'APPROVED') {
    const workedMinutes = differenceInMinutes(reg.proposedCheckOut, reg.proposedCheckIn);
    await prisma.dailyAttendanceRecord.update({
      where: { id: reg.attendanceRecordId },
      data: {
        firstCheckIn: reg.proposedCheckIn,
        lastCheckOut: reg.proposedCheckOut,
        totalWorkedMinutes: workedMinutes,
        status: workedMinutes >= 240 ? 'PRESENT' : 'HALF_DAY',
        isRegularized: true,
        notes: `Regularized by ${params.actor.userId}: ${params.notes || 'Approved'}`,
      },
    });
  }

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0] || 'APPROVER',
    action: `ATTENDANCE_REGULARIZATION_${params.status}`,
    entityType: 'ATTENDANCE_REGULARIZATION',
    entityId: reg.id,
    beforeState: { status: reg.status },
    afterState: { status: params.status, notes: params.notes },
  });

  return updatedReg;
}
