import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { createAuditLog } from '../audit';
import { differenceInDays, getDaysInMonth, getDate } from 'date-fns';
import { calculateEmployeeLeaveBalance } from '../leave/engine';

export function calculateGratuity(monthlyBasic: number, tenureYears: number): number {
  if (tenureYears < 5) return 0;
  return Math.round((15 * monthlyBasic * Math.floor(tenureYears)) / 26);
}

export function calculateFnFSettlement(params: {
  monthlyGross: number;
  monthlyBasic: number;
  payableDays: number;
  daysInMonth?: number;
  leaveBalanceDays?: number;
  noticePeriodRequiredDays?: number;
  noticePeriodServedDays?: number;
  tenureYears?: number;
  approvedReimbursements?: number;
}) {
  const daysInMonth = params.daysInMonth || 30;
  const earnedSalary = Math.round((params.monthlyGross / daysInMonth) * params.payableDays);
  const perDayBasic = params.monthlyBasic / 30;
  const leaveEncashment = Math.round((params.leaveBalanceDays || 0) * perDayBasic);
  const noticeShortfall = Math.max(
    0,
    (params.noticePeriodRequiredDays || 30) - (params.noticePeriodServedDays || 30)
  );
  const noticeRecovery = Math.round((params.monthlyGross / 30) * noticeShortfall);
  const gratuity = calculateGratuity(params.monthlyBasic, params.tenureYears || 0);
  const netSettlement =
    earnedSalary + leaveEncashment + gratuity + (params.approvedReimbursements || 0) - noticeRecovery;

  return {
    earnedSalary,
    leaveEncashment,
    noticeRecovery,
    gratuity,
    netSettlement,
  };
}

export async function submitExitRequest(params: {
  tenantId: string;
  employeeId: string;
  requestedLwd: Date;
  reason: string;
  reasonCategory?: string;
}) {
  const employee = await prisma.employee.findUnique({
    where: { id: params.employeeId },
  });
  if (!employee) throw new Error('Employee not found');

  const exitReq = await prisma.exitRequest.create({
    data: {
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      resignationDate: new Date(),
      requestedLwd: params.requestedLwd,
      approvedLwd: params.requestedLwd,
      reason: params.reason,
      reasonCategory: params.reasonCategory || 'BETTER_OPPORTUNITY',
      status: 'INITIATED',
    },
  });

  // Update employee status to NOTICE
  await prisma.employee.update({
    where: { id: params.employeeId },
    data: { status: 'NOTICE' },
  });

  return exitReq;
}

export async function calculateFullAndFinalSettlement(params: {
  tenantId: string;
  exitRequestId: string;
  actor: AuthUser;
}) {
  const exitReq = await prisma.exitRequest.findUnique({
    where: { id: params.exitRequestId },
    include: {
      employee: {
        include: {
          salaryAssignments: { where: { isCurrent: true } },
          assetAssignments: { where: { returnedDate: null } },
        },
      },
    },
  });

  if (!exitReq) throw new Error('Exit request not found');

  const employee = exitReq.employee;
  const salaryAssignment = employee.salaryAssignments[0];
  const monthlyCtc = (salaryAssignment?.ctc || 1200000) / 12;
  const monthlyBasic = 0.5 * monthlyCtc;

  // 1. Final month payable days & earned salary
  const lwd = new Date(exitReq.approvedLwd);
  const daysInFinalMonth = getDaysInMonth(lwd);
  const payableDays = getDate(lwd);
  const earnedSalaryAmount = Math.round((monthlyCtc / daysInFinalMonth) * payableDays);

  // 2. Leave Encashment (Earned Leave)
  const elType = await prisma.leaveType.findFirst({
    where: { tenantId: params.tenantId, code: 'EL' },
  });

  let elBalance = 0;
  if (elType) {
    elBalance = Math.max(0, await calculateEmployeeLeaveBalance(params.tenantId, employee.id, elType.id));
  }
  const perDayBasic = monthlyBasic / 30;
  const leaveEncashmentAmount = Math.round(elBalance * perDayBasic);

  // 3. Notice Period Shortfall Recovery
  const standardNoticeDays = employee.noticePeriodDays || 30;
  const servedNoticeDays = Math.max(0, differenceInDays(lwd, new Date(exitReq.resignationDate)));
  let noticeShortfallDays = 0;
  let noticeRecoveryAmount = 0;

  if (servedNoticeDays < standardNoticeDays) {
    noticeShortfallDays = standardNoticeDays - servedNoticeDays;
    noticeRecoveryAmount = Math.round((monthlyCtc / 30) * noticeShortfallDays);
  }

  // 4. Gratuity Calculation (tenure >= 5 years: 15 * Basic * years / 26)
  const tenureYears = differenceInDays(lwd, new Date(employee.joiningDate)) / 365.25;
  let gratuityAmount = 0;
  if (tenureYears >= 5) {
    gratuityAmount = Math.round((15 * monthlyBasic * Math.floor(tenureYears)) / 26);
  }

  // 5. Net Settlement
  const finalSettlementAmount = Math.max(
    0,
    earnedSalaryAmount + leaveEncashmentAmount + gratuityAmount - noticeRecoveryAmount
  );

  const settlement = await prisma.fullAndFinalSettlement.upsert({
    where: { exitRequestId: exitReq.id },
    update: {
      payableDays,
      earnedSalaryAmount,
      leaveEncashmentDays: elBalance,
      leaveEncashmentAmount,
      noticePayShortfallDays: noticeShortfallDays,
      noticeRecoveryAmount,
      gratuityAmount,
      finalSettlementAmount,
      status: 'CALCULATED',
    },
    create: {
      exitRequestId: exitReq.id,
      payableDays,
      earnedSalaryAmount,
      leaveEncashmentDays: elBalance,
      leaveEncashmentAmount,
      noticePayShortfallDays: noticeShortfallDays,
      noticeRecoveryAmount,
      gratuityAmount,
      finalSettlementAmount,
      status: 'CALCULATED',
    },
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0],
    action: 'CALCULATE_FNF_SETTLEMENT',
    entityType: 'EXIT',
    entityId: exitReq.id,
    afterState: { settlementId: settlement.id, finalSettlementAmount },
  });

  return settlement;
}

export async function approveAndSettleExit(params: {
  tenantId: string;
  exitRequestId: string;
  actor: AuthUser;
}) {
  const exitReq = await prisma.exitRequest.findUnique({
    where: { id: params.exitRequestId },
    include: { settlement: true },
  });

  if (!exitReq) throw new Error('Exit request not found');

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update settlement to SETTLED
    if (exitReq.settlement) {
      await tx.fullAndFinalSettlement.update({
        where: { id: exitReq.settlement.id },
        data: { status: 'PAID', settledAt: new Date() },
      });
    }

    // 2. Update exit request
    const updatedExit = await tx.exitRequest.update({
      where: { id: exitReq.id },
      data: {
        status: 'SETTLED',
        itClearanceStatus: 'CLEARED',
        adminClearanceStatus: 'CLEARED',
        financeClearanceStatus: 'CLEARED',
      },
    });

    // 3. Mark Employee status as EXITED
    await tx.employee.update({
      where: { id: exitReq.employeeId },
      data: { status: 'EXITED' },
    });

    return updatedExit;
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0],
    action: 'SETTLE_AND_EXIT_EMPLOYEE',
    entityType: 'EXIT',
    entityId: exitReq.id,
    afterState: { employeeId: exitReq.employeeId, status: 'EXITED' },
  });

  return result;
}
