import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { createAuditLog } from '../audit';
import { differenceInDays, isWeekend, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';

export interface LeaveBalanceSummary {
  leaveTypeId: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  color: string;
  isPaid: boolean;
  totalAccrued: number;
  totalConsumed: number;
  currentBalance: number;
  annualQuota: number;
  maxCarryForward: number;
}

export async function calculateEmployeeLeaveBalance(
  tenantId: string,
  employeeId: string,
  leaveTypeId: string
): Promise<number> {
  const transactions = await prisma.leaveLedger.findMany({
    where: {
      tenantId,
      employeeId,
      leaveTypeId,
    },
    orderBy: { transactionDate: 'asc' },
  });

  return transactions.reduce((acc, tx) => acc + tx.days, 0);
}

export async function getEmployeeAllLeaveBalances(
  tenantId: string,
  employeeId: string
): Promise<LeaveBalanceSummary[]> {
  const leaveTypes = await prisma.leaveType.findMany({
    where: { tenantId },
    include: { policy: true },
  });

  const balances: LeaveBalanceSummary[] = [];

  for (const lt of leaveTypes) {
    const transactions = await prisma.leaveLedger.findMany({
      where: {
        tenantId,
        employeeId,
        leaveTypeId: lt.id,
      },
    });

    let totalAccrued = 0;
    let totalConsumed = 0;
    let currentBalance = 0;

    for (const tx of transactions) {
      currentBalance += tx.days;
      if (['OPENING', 'ACCRUAL', 'ADJUSTMENT'].includes(tx.transactionType) && tx.days > 0) {
        totalAccrued += tx.days;
      } else if (tx.transactionType === 'CONSUMPTION') {
        totalConsumed += Math.abs(tx.days);
      }
    }

    balances.push({
      leaveTypeId: lt.id,
      leaveTypeCode: lt.code,
      leaveTypeName: lt.name,
      color: lt.color,
      isPaid: lt.isPaid,
      totalAccrued,
      totalConsumed,
      currentBalance,
      annualQuota: lt.policy?.annualQuota || 18,
      maxCarryForward: lt.policy?.maxCarryForward || 45,
    });
  }

  return balances;
}

export interface ValidateAndApplyLeaveParams {
  tenantId: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: Date;
  endDate: Date;
  isHalfDay?: boolean;
  halfDaySession?: 'FIRST_HALF' | 'SECOND_HALF';
  reason: string;
  attachmentUrl?: string;
  approverId?: string;
  backupApproverId?: string;
}

export async function validateAndApplyLeave(params: ValidateAndApplyLeaveParams) {
  const employee = await prisma.employee.findUnique({
    where: { id: params.employeeId },
    include: { reportingManager: true },
  });
  if (!employee) throw new Error('Employee not found');

  const leaveType = await prisma.leaveType.findUnique({
    where: { id: params.leaveTypeId },
    include: { policy: true },
  });
  if (!leaveType) throw new Error('Leave type not found');

  const policy = leaveType.policy;
  const daysInterval = eachDayOfInterval({ start: params.startDate, end: params.endDate });

  // Calculate requested days
  let requestedDays = 0;
  if (params.isHalfDay) {
    if (!policy?.allowHalfDay) {
      throw new Error('Half-day leaves are not allowed for this leave type');
    }
    requestedDays = 0.5;
  } else {
    // Check sandwich rule
    if (policy?.isSandwichRuleEnabled) {
      requestedDays = daysInterval.length; // counts weekends/holidays in between
    } else {
      // Exclude weekends if sandwich rule disabled
      requestedDays = daysInterval.filter((d) => !isWeekend(d)).length;
    }
  }

  if (requestedDays <= 0) {
    throw new Error('Invalid leave duration');
  }

  // Consecutive days check
  if (policy?.maxConsecutiveDays && requestedDays > policy.maxConsecutiveDays) {
    throw new Error(`Maximum consecutive days allowed is ${policy.maxConsecutiveDays}`);
  }

  // Check current balance
  const currentBalance = await calculateEmployeeLeaveBalance(
    params.tenantId,
    params.employeeId,
    params.leaveTypeId
  );

  const maxNeg = policy?.maxNegativeBalance || 0;
  if (currentBalance - requestedDays < -maxNeg) {
    throw new Error(
      `Insufficient leave balance. Current: ${currentBalance}, Requested: ${requestedDays}, Negative limit: ${maxNeg}`
    );
  }

  // Check overlapping requests
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      status: { in: ['PENDING', 'APPROVED'] },
      OR: [
        { startDate: { lte: params.endDate }, endDate: { gte: params.startDate } },
      ],
    },
  });

  if (overlapping) {
    throw new Error('You already have a pending or approved leave request during these dates');
  }

  // Determine primary & backup approvers
  const approverId = params.approverId || employee.reportingManagerId || undefined;
  const backupApproverId = params.backupApproverId || undefined;

  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      leaveTypeId: params.leaveTypeId,
      startDate: params.startDate,
      endDate: params.endDate,
      totalDays: requestedDays,
      isHalfDay: params.isHalfDay || false,
      halfDaySession: params.halfDaySession,
      reason: params.reason,
      attachmentUrl: params.attachmentUrl,
      status: 'PENDING',
      approverId,
      backupApproverId,
    },
  });

  return leaveRequest;
}

export async function processLeaveApproval(params: {
  tenantId: string;
  leaveRequestId: string;
  actor: AuthUser;
  decision: 'APPROVED' | 'REJECTED';
  notes?: string;
}) {
  const req = await prisma.leaveRequest.findUnique({
    where: { id: params.leaveRequestId },
    include: { leaveType: true, employee: true },
  });

  if (!req) throw new Error('Leave request not found');
  if (req.status !== 'PENDING') throw new Error(`Leave request is already ${req.status}`);

  if (params.decision === 'REJECTED') {
    const updated = await prisma.leaveRequest.update({
      where: { id: req.id },
      data: {
        status: 'REJECTED',
        approvedAt: new Date(),
        approverNotes: params.notes,
      },
    });

    await createAuditLog({
      tenantId: params.tenantId,
      actorId: params.actor.userId,
      actorRole: params.actor.roles[0] || 'APPROVER',
      action: 'LEAVE_REJECTED',
      entityType: 'LEAVE_REQUEST',
      entityId: req.id,
      beforeState: { status: req.status },
      afterState: { status: 'REJECTED', notes: params.notes },
    });

    return updated;
  }

  // If APPROVED:
  // 1. Transactionally update leave request & create CONSUMPTION in LeaveLedger
  const currentBalance = await calculateEmployeeLeaveBalance(params.tenantId, req.employeeId, req.leaveTypeId);
  const newBalance = currentBalance - req.totalDays;

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.leaveRequest.update({
      where: { id: req.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approverNotes: params.notes,
      },
    });

    await tx.leaveLedger.create({
      data: {
        tenantId: params.tenantId,
        employeeId: req.employeeId,
        leaveTypeId: req.leaveTypeId,
        transactionType: 'CONSUMPTION',
        days: -req.totalDays,
        balanceAfter: newBalance,
        referenceType: 'LEAVE_REQUEST',
        referenceId: req.id,
        reason: `Leave approved: ${req.reason}`,
        transactionDate: new Date(),
      },
    });

    // 2. Mark daily attendance records for interval
    const daysInterval = eachDayOfInterval({ start: req.startDate, end: req.endDate });
    for (const d of daysInterval) {
      const dayStart = startOfDay(d);
      const isPaid = req.leaveType.isPaid;
      await tx.dailyAttendanceRecord.upsert({
        where: {
          tenantId_employeeId_date: {
            tenantId: params.tenantId,
            employeeId: req.employeeId,
            date: dayStart,
          },
        },
        update: {
          status: req.isHalfDay ? 'HALF_DAY' : (isPaid ? 'PRESENT' : 'LOP'),
          notes: `Leave (${req.leaveType.code}) Approved`,
        },
        create: {
          tenantId: params.tenantId,
          employeeId: req.employeeId,
          date: dayStart,
          status: req.isHalfDay ? 'HALF_DAY' : (isPaid ? 'PRESENT' : 'LOP'),
          notes: `Leave (${req.leaveType.code}) Approved`,
        },
      });
    }

    return updated;
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0] || 'APPROVER',
    action: 'LEAVE_APPROVED',
    entityType: 'LEAVE_REQUEST',
    entityId: req.id,
    beforeState: { status: req.status, balanceBefore: currentBalance },
    afterState: { status: 'APPROVED', daysDebited: req.totalDays, balanceAfter: newBalance },
  });

  return result;
}

export async function addLeaveLedgerTransaction(params: {
  tenantId: string;
  employeeId: string;
  leaveTypeId: string;
  transactionType: 'OPENING' | 'ACCRUAL' | 'CONSUMPTION' | 'REVERSAL' | 'ADJUSTMENT' | 'EXPIRY' | 'ENCASHMENT';
  days: number;
  reason?: string;
  referenceType?: string;
  referenceId?: string;
}) {
  const currentBalance = await calculateEmployeeLeaveBalance(
    params.tenantId,
    params.employeeId,
    params.leaveTypeId
  );

  const balanceAfter = currentBalance + params.days;

  return prisma.leaveLedger.create({
    data: {
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      leaveTypeId: params.leaveTypeId,
      transactionType: params.transactionType,
      days: params.days,
      balanceAfter,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      reason: params.reason,
      transactionDate: new Date(),
    },
  });
}
