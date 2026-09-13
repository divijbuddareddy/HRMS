import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { createAuditLog } from '../audit';
import { startOfMonth, endOfMonth, getDaysInMonth, startOfDay, endOfDay } from 'date-fns';

export interface IndianStatutoryConfig {
  epf: {
    employeeRate: number;
    employerEpfRate: number;
    employerEpsRate: number;
    wageCeiling: number;
    applyWageCeiling: boolean;
  };
  esi: {
    employeeRate: number;
    employerRate: number;
    grossLimit: number;
  };
  pt: {
    state: string;
    slabs: { minGross: number; maxGross: number; tax: number; febTax?: number }[];
  };
  tds: {
    standardDeductionNew: number;
    standardDeductionOld: number;
    cessRate: number;
  };
}

export const DEFAULT_STATUTORY_CONFIG: IndianStatutoryConfig = {
  epf: {
    employeeRate: 0.12,
    employerEpfRate: 0.0367,
    employerEpsRate: 0.0833,
    wageCeiling: 15000,
    applyWageCeiling: false, // Calculate on full basic or capped basic
  },
  esi: {
    employeeRate: 0.0075, // 0.75%
    employerRate: 0.0325, // 3.25%
    grossLimit: 21000,
  },
  pt: {
    state: 'KARNATAKA',
    slabs: [
      { minGross: 0, maxGross: 24999, tax: 0 },
      { minGross: 25000, maxGross: 9999999, tax: 200 },
    ],
  },
  tds: {
    standardDeductionNew: 75000,
    standardDeductionOld: 50000,
    cessRate: 0.04,
  },
};

// Calculate Indian Income Tax (Annual TDS)
export function calculateAnnualIncomeTax(
  annualGross: number,
  regime: 'NEW_REGIME' | 'OLD_REGIME',
  declarations?: { section80C?: number; section80D?: number; hraExemption?: number }
): number {
  if (regime === 'NEW_REGIME') {
    const stdDeduction = DEFAULT_STATUTORY_CONFIG.tds.standardDeductionNew;
    const taxableIncome = Math.max(0, annualGross - stdDeduction);

    // Section 87A rebate for new regime if income <= 7,00,000
    if (taxableIncome <= 700000) return 0;

    let tax = 0;
    // New Slabs: 0-3L: 0%, 3-7L: 5%, 7-10L: 10%, 10-12L: 15%, 12-15L: 20%, >15L: 30%
    if (taxableIncome > 1500000) tax += (taxableIncome - 1500000) * 0.3;
    if (taxableIncome > 1200000) tax += Math.min(taxableIncome - 1200000, 300000) * 0.2;
    if (taxableIncome > 1000000) tax += Math.min(taxableIncome - 1000000, 200000) * 0.15;
    if (taxableIncome > 700000) tax += Math.min(taxableIncome - 700000, 300000) * 0.1;
    if (taxableIncome > 300000) tax += Math.min(taxableIncome - 300000, 400000) * 0.05;

    // Add 4% Cess
    tax += tax * DEFAULT_STATUTORY_CONFIG.tds.cessRate;
    return Math.round(tax);
  } else {
    // OLD REGIME
    const stdDeduction = DEFAULT_STATUTORY_CONFIG.tds.standardDeductionOld;
    const sec80C = Math.min(150000, declarations?.section80C || 0);
    const sec80D = Math.min(50000, declarations?.section80D || 0);
    const hra = declarations?.hraExemption || 0;

    const totalDeductions = stdDeduction + sec80C + sec80D + hra;
    const taxableIncome = Math.max(0, annualGross - totalDeductions);

    if (taxableIncome <= 500000) return 0; // Rebate u/s 87A

    let tax = 0;
    // Old Slabs: 0-2.5L: 0%, 2.5-5L: 5%, 5-10L: 20%, >10L: 30%
    if (taxableIncome > 1000000) tax += (taxableIncome - 1000000) * 0.3;
    if (taxableIncome > 500000) tax += Math.min(taxableIncome - 500000, 500000) * 0.2;
    if (taxableIncome > 250000) tax += Math.min(taxableIncome - 250000, 250000) * 0.05;

    tax += tax * DEFAULT_STATUTORY_CONFIG.tds.cessRate;
    return Math.round(tax);
  }
}

// Calculate State Professional Tax
export function calculateProfessionalTax(monthlyGross: number, stateName: string, month: number): number {
  const normalizedState = (stateName || 'KARNATAKA').toUpperCase();
  if (normalizedState === 'MAHARASHTRA') {
    if (monthlyGross <= 7500) return 0;
    if (monthlyGross <= 10000) return 175;
    return month === 2 ? 300 : 200; // Rs 300 in Feb
  }
  if (normalizedState === 'KARNATAKA') {
    return monthlyGross >= 25000 ? 200 : 0;
  }
  if (normalizedState === 'TAMIL_NADU' || normalizedState === 'TAMIL NADU') {
    if (monthlyGross > 75000) return 208;
    if (monthlyGross > 50000) return 171;
    if (monthlyGross > 30000) return 100;
    return 0;
  }
  if (normalizedState === 'DELHI') {
    return 0; // No PT in Delhi
  }
  return monthlyGross >= 25000 ? 200 : 0;
}

export function calculateSalaryForEmployee(params: {
  annualCtc: number;
  monthlyCtc: number;
  state: string;
  taxRegime: 'NEW' | 'OLD';
  statutoryConfig?: IndianStatutoryConfig;
  lopDays?: number;
  totalWorkingDaysInMonth?: number;
}) {
  const basic = 0.5 * params.monthlyCtc;
  const hra = 0.4 * basic;
  const specialAllowance = params.monthlyCtc - (basic + hra);
  const grossEarnings = basic + hra + specialAllowance;

  const lopDays = params.lopDays || 0;
  const totalDays = params.totalWorkingDaysInMonth || 30;
  const lopDeduction = Math.round((grossEarnings / totalDays) * lopDays);

  const epfEmployee = 1800; // statutory standard capped
  const professionalTax = calculateProfessionalTax(grossEarnings, params.state, 5);
  const annualTds = calculateAnnualIncomeTax(
    params.annualCtc,
    params.taxRegime === 'NEW' ? 'NEW_REGIME' : 'OLD_REGIME'
  );
  const monthlyTds = Math.round(annualTds / 12);

  const totalDeductions = epfEmployee + professionalTax + monthlyTds + lopDeduction;
  const netPay = grossEarnings - totalDeductions;

  return {
    basic,
    hra,
    specialAllowance,
    grossEarnings,
    epfEmployee,
    professionalTax,
    monthlyTds,
    lopDeduction,
    totalDeductions,
    netPay,
  };
}

export interface CalculateEmployeePayrollParams {
  tenantId: string;
  employeeId: string;
  month: number;
  year: number;
  totalCalendarDays: number;
}

export async function computeEmployeePayrollItem(params: CalculateEmployeePayrollParams) {
  const { tenantId, employeeId, month, year, totalCalendarDays } = params;

  // 1. Fetch current salary assignment
  const assignment = await prisma.employeeSalaryAssignment.findFirst({
    where: {
      tenantId,
      employeeId,
      isCurrent: true,
    },
    include: {
      structure: {
        include: { components: { orderBy: { sortOrder: 'asc' } } },
      },
      employee: {
        include: {
          branchLocation: true,
          identity: true,
          bank: true,
        },
      },
    },
  });

  if (!assignment) {
    throw new Error(`No salary structure assigned to employee ${employeeId}`);
  }

  // 2. Query attendance & LOP for month
  const startDate = startOfMonth(new Date(year, month - 1, 1));
  const endDate = endOfMonth(new Date(year, month - 1, 1));

  const attendanceRecords = await prisma.dailyAttendanceRecord.findMany({
    where: {
      tenantId,
      employeeId,
      date: { gte: startDate, lte: endDate },
    },
  });

  // Calculate LOP & worked days
  let lopDays = 0;
  let workedDays = 0;
  let paidLeaveDays = 0;

  for (const rec of attendanceRecords) {
    if (rec.status === 'LOP' || (rec.status === 'ABSENT' && !rec.isRegularized)) {
      lopDays += 1;
    } else if (rec.status === 'HALF_DAY') {
      workedDays += 0.5;
      lopDays += 0.5;
    } else if (rec.status === 'PRESENT') {
      workedDays += 1;
    }
  }

  // Fetch approved paid leaves in month
  const paidLeaves = await prisma.leaveRequest.findMany({
    where: {
      tenantId,
      employeeId,
      status: 'APPROVED',
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      leaveType: { isPaid: true },
    },
  });
  paidLeaveDays = paidLeaves.reduce((acc, l) => acc + l.totalDays, 0);

  const payableDays = Math.max(0, totalCalendarDays - lopDays);
  const payFactor = payableDays / totalCalendarDays;

  // 3. Compute Base Monthly CTC and Components
  const monthlyCtc = assignment.ctc / 12;
  const components = assignment.structure.components;

  const earningsBreakdown: Record<string, number> = {};
  const deductionsBreakdown: Record<string, number> = {};
  const employerBreakdown: Record<string, number> = {};

  // Standard salary component splits based on structure
  let basicNominal = 0;
  let hraNominal = 0;
  let specialAllowanceNominal = 0;

  // Evaluate structure formulas
  const basicComp = components.find((c) => c.code === 'BASIC');
  if (basicComp) {
    basicNominal = 0.5 * monthlyCtc; // 50% of CTC
  } else {
    basicNominal = 0.5 * monthlyCtc;
  }

  const hraComp = components.find((c) => c.code === 'HRA');
  if (hraComp) {
    hraNominal = 0.4 * basicNominal; // 40% of Basic
  } else {
    hraNominal = 0.4 * basicNominal;
  }

  specialAllowanceNominal = Math.max(0, monthlyCtc - basicNominal - hraNominal);

  // Pro-rate based on payable days
  const basicEarned = Math.round(basicNominal * payFactor);
  const hraEarned = Math.round(hraNominal * payFactor);
  const specialAllowanceEarned = Math.round(specialAllowanceNominal * payFactor);

  earningsBreakdown['BASIC'] = basicEarned;
  earningsBreakdown['HRA'] = hraEarned;
  earningsBreakdown['SPECIAL_ALLOWANCE'] = specialAllowanceEarned;

  const grossEarnings = basicEarned + hraEarned + specialAllowanceEarned;

  // 4. Compute Deductions & Statutory Compliance
  // EPF: 12% of Basic
  const epfBase = DEFAULT_STATUTORY_CONFIG.epf.applyWageCeiling
    ? Math.min(basicEarned, DEFAULT_STATUTORY_CONFIG.epf.wageCeiling)
    : basicEarned;
  const pfEmployee = Math.round(epfBase * DEFAULT_STATUTORY_CONFIG.epf.employeeRate);
  const pfEmployerEps = Math.round(Math.min(epfBase, 15000) * DEFAULT_STATUTORY_CONFIG.epf.employerEpsRate);
  const pfEmployerEpf = Math.round(epfBase * DEFAULT_STATUTORY_CONFIG.epf.employeeRate - pfEmployerEps);

  deductionsBreakdown['PF_EE'] = pfEmployee;
  employerBreakdown['PF_ER_EPF'] = pfEmployerEpf;
  employerBreakdown['PF_ER_EPS'] = pfEmployerEps;

  // ESI: if monthly gross <= 21000
  let esiEmployee = 0;
  let esiEmployer = 0;
  if (grossEarnings <= DEFAULT_STATUTORY_CONFIG.esi.grossLimit) {
    esiEmployee = Math.round(grossEarnings * DEFAULT_STATUTORY_CONFIG.esi.employeeRate);
    esiEmployer = Math.round(grossEarnings * DEFAULT_STATUTORY_CONFIG.esi.employerRate);
  }
  deductionsBreakdown['ESI_EE'] = esiEmployee;
  employerBreakdown['ESI_ER'] = esiEmployer;

  // Professional Tax
  const employeeState = assignment.employee.branchLocation?.state || 'KARNATAKA';
  const pt = calculateProfessionalTax(grossEarnings, employeeState, month);
  deductionsBreakdown['PT'] = pt;

  // Gratuity Employer Provision (4.81% of Basic)
  const gratuityEmployer = Math.round(basicEarned * 0.0481);
  employerBreakdown['GRATUITY_PROVISION'] = gratuityEmployer;

  // Tax Declarations & TDS calculation
  const taxDecl = await prisma.taxDeclaration.findFirst({
    where: {
      tenantId,
      employeeId,
      fiscalYear: `${year}-${year + 1}`,
    },
  });

  const regime = (assignment.taxRegime || taxDecl?.regime || 'NEW_REGIME') as 'NEW_REGIME' | 'OLD_REGIME';
  const annualGrossProjected = grossEarnings * 12;
  const annualTax = calculateAnnualIncomeTax(annualGrossProjected, regime, {
    section80C: taxDecl?.section80C,
    section80D: taxDecl?.section80D,
    hraExemption: taxDecl?.hraRentPaid ? Math.min(taxDecl.hraRentPaid, hraNominal * 12) : 0,
  });
  const monthlyTds = Math.round(annualTax / 12);
  deductionsBreakdown['TDS'] = monthlyTds;

  // Total deductions & Net salary
  const totalDeductions = pfEmployee + esiEmployee + pt + monthlyTds;
  const netSalary = Math.max(0, grossEarnings - totalDeductions);
  const totalEmployerCost = grossEarnings + pfEmployerEpf + pfEmployerEps + esiEmployer + gratuityEmployer;

  return {
    employeeId,
    ctc: assignment.ctc,
    payableDays,
    workedDays,
    paidLeaveDays,
    unpaidLopDays: lopDays,
    grossEarnings,
    totalDeductions,
    netSalary,
    employerCost: totalEmployerCost,
    earningsBreakdown,
    deductionsBreakdown,
    employerBreakdown,
    taxRegime: regime,
    incomeTaxMonthly: monthlyTds,
  };
}

export async function executePayrollCycleRun(params: {
  tenantId: string;
  month: number;
  year: number;
  actor: AuthUser;
}) {
  const { tenantId, month, year, actor } = params;
  const daysInMonth = getDaysInMonth(new Date(year, month - 1, 1));
  const startDate = startOfMonth(new Date(year, month - 1, 1));
  const endDate = endOfMonth(new Date(year, month - 1, 1));

  // 1. Get or create payroll cycle
  let cycle = await prisma.payrollCycle.findUnique({
    where: {
      tenantId_month_year: { tenantId, month, year },
    },
  });

  if (!cycle) {
    cycle = await prisma.payrollCycle.create({
      data: {
        tenantId,
        month,
        year,
        startDate,
        endDate,
        totalCalendarDays: daysInMonth,
      },
    });
  }

  // 2. Check existing run
  let run = await prisma.payrollRun.findFirst({
    where: { tenantId, cycleId: cycle.id },
  });

  if (run && ['LOCKED', 'PUBLISHED'].includes(run.status)) {
    throw new Error(`Cannot recalculate payroll run in status ${run.status}`);
  }

  if (!run) {
    run = await prisma.payrollRun.create({
      data: {
        tenantId,
        cycleId: cycle.id,
        runNumber: 1,
        status: 'DRAFT',
      },
    });
  }

  // 3. Fetch all active employees assigned with a salary structure
  const activeEmployees = await prisma.employee.findMany({
    where: {
      tenantId,
      status: { in: ['ACTIVE', 'PROBATION', 'CONFIRMED', 'NOTICE'] },
      salaryAssignments: { some: { isCurrent: true } },
    },
    include: {
      salaryAssignments: { where: { isCurrent: true } },
    },
  });

  if (activeEmployees.length === 0) {
    throw new Error('No active employees with assigned salary structures found');
  }

  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;
  let totalEmployerCost = 0;

  // Process all employees transactionally / deterministically
  for (const emp of activeEmployees) {
    const calculated = await computeEmployeePayrollItem({
      tenantId,
      employeeId: emp.id,
      month,
      year,
      totalCalendarDays: daysInMonth,
    });

    totalGross += calculated.grossEarnings;
    totalDeductions += calculated.totalDeductions;
    totalNet += calculated.netSalary;
    totalEmployerCost += calculated.employerCost;

    await prisma.payrollItem.upsert({
      where: {
        payrollRunId_employeeId: {
          payrollRunId: run.id,
          employeeId: emp.id,
        },
      },
      update: {
        ctc: calculated.ctc,
        payableDays: calculated.payableDays,
        workedDays: calculated.workedDays,
        paidLeaveDays: calculated.paidLeaveDays,
        unpaidLopDays: calculated.unpaidLopDays,
        grossEarnings: calculated.grossEarnings,
        totalDeductions: calculated.totalDeductions,
        netSalary: calculated.netSalary,
        employerCost: calculated.employerCost,
        earningsBreakdown: JSON.stringify(calculated.earningsBreakdown),
        deductionsBreakdown: JSON.stringify(calculated.deductionsBreakdown),
        employerBreakdown: JSON.stringify(calculated.employerBreakdown),
        taxRegime: calculated.taxRegime,
        incomeTaxMonthly: calculated.incomeTaxMonthly,
      },
      create: {
        payrollRunId: run.id,
        employeeId: emp.id,
        ctc: calculated.ctc,
        payableDays: calculated.payableDays,
        workedDays: calculated.workedDays,
        paidLeaveDays: calculated.paidLeaveDays,
        unpaidLopDays: calculated.unpaidLopDays,
        grossEarnings: calculated.grossEarnings,
        totalDeductions: calculated.totalDeductions,
        netSalary: calculated.netSalary,
        employerCost: calculated.employerCost,
        earningsBreakdown: JSON.stringify(calculated.earningsBreakdown),
        deductionsBreakdown: JSON.stringify(calculated.deductionsBreakdown),
        employerBreakdown: JSON.stringify(calculated.employerBreakdown),
        taxRegime: calculated.taxRegime,
        incomeTaxMonthly: calculated.incomeTaxMonthly,
      },
    });
  }

  // Update run summary
  const updatedRun = await prisma.payrollRun.update({
    where: { id: run.id },
    data: {
      status: 'CALCULATED',
      totalEmployees: activeEmployees.length,
      totalGrossPay: totalGross,
      totalDeductions,
      totalNetPay: totalNet,
      totalEmployerCost,
      calculatedAt: new Date(),
    },
    include: { items: true },
  });

  await createAuditLog({
    tenantId,
    actorId: actor.userId,
    actorRole: actor.roles[0] || 'FINANCE',
    action: 'PAYROLL_CALCULATED',
    entityType: 'PAYROLL_RUN',
    entityId: run.id,
    afterState: {
      month,
      year,
      totalEmployees: activeEmployees.length,
      totalGross,
      totalNet,
    },
  });

  return updatedRun;
}

export async function overridePayrollComponent(params: {
  tenantId: string;
  payrollItemId: string;
  componentCode: string;
  newAmount: number;
  reason: string;
  actor: AuthUser;
}) {
  const item = await prisma.payrollItem.findUnique({
    where: { id: params.payrollItemId },
    include: { payrollRun: true },
  });

  if (!item) throw new Error('Payroll item not found');
  if (['LOCKED', 'PUBLISHED'].includes(item.payrollRun.status)) {
    throw new Error('Cannot override components in a locked or published payroll run');
  }

  const earnings = JSON.parse(item.earningsBreakdown || '{}');
  const deductions = JSON.parse(item.deductionsBreakdown || '{}');

  let prevAmount = 0;
  if (componentCodeIn(params.componentCode, earnings)) {
    prevAmount = earnings[params.componentCode] || 0;
    earnings[params.componentCode] = params.newAmount;
  } else if (componentCodeIn(params.componentCode, deductions)) {
    prevAmount = deductions[params.componentCode] || 0;
    deductions[params.componentCode] = params.newAmount;
  } else {
    earnings[params.componentCode] = params.newAmount;
  }

  // Recalculate totals
  const newGross = Object.values(earnings).reduce((a: number, b: any) => a + Number(b), 0);
  const newDeductions = Object.values(deductions).reduce((a: number, b: any) => a + Number(b), 0);
  const newNet = Math.max(0, newGross - newDeductions);

  const originalCalculation = item.originalCalculation || JSON.stringify({
    grossEarnings: item.grossEarnings,
    totalDeductions: item.totalDeductions,
    netSalary: item.netSalary,
    earningsBreakdown: item.earningsBreakdown,
    deductionsBreakdown: item.deductionsBreakdown,
  });

  const updatedItem = await prisma.$transaction(async (tx) => {
    await tx.payrollAdjustment.create({
      data: {
        payrollItemId: item.id,
        componentCode: params.componentCode,
        previousAmount: prevAmount,
        newAmount: params.newAmount,
        reason: params.reason,
        authorizedBy: params.actor.userId,
      },
    });

    return tx.payrollItem.update({
      where: { id: item.id },
      data: {
        grossEarnings: newGross,
        totalDeductions: newDeductions,
        netSalary: newNet,
        earningsBreakdown: JSON.stringify(earnings),
        deductionsBreakdown: JSON.stringify(deductions),
        isOverridden: true,
        originalCalculation,
      },
    });
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0] || 'FINANCE',
    action: 'PAYROLL_COMPONENT_OVERRIDDEN',
    entityType: 'PAYROLL_ITEM',
    entityId: item.id,
    beforeState: { component: params.componentCode, amount: prevAmount },
    afterState: { component: params.componentCode, amount: params.newAmount, reason: params.reason },
  });

  return updatedItem;
}

function componentCodeIn(code: string, obj: Record<string, any>): boolean {
  return Object.prototype.hasOwnProperty.call(obj, code);
}

export async function lockAndPublishPayrollRun(params: {
  tenantId: string;
  payrollRunId: string;
  actor: AuthUser;
  action: 'APPROVE' | 'LOCK' | 'PUBLISH';
}) {
  const run = await prisma.payrollRun.findUnique({
    where: { id: params.payrollRunId },
    include: {
      cycle: true,
      items: {
        include: {
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
      },
    },
  });

  if (!run) throw new Error('Payroll run not found');

  if (params.action === 'APPROVE') {
    return prisma.payrollRun.update({
      where: { id: run.id },
      data: {
        status: 'APPROVED',
        approvedBy: params.actor.userId,
        approvedAt: new Date(),
      },
    });
  }

  if (params.action === 'LOCK' || params.action === 'PUBLISH') {
    const finalStatus = params.action === 'PUBLISH' ? 'PUBLISHED' : 'LOCKED';

    const result = await prisma.$transaction(async (tx) => {
      const updatedRun = await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          status: finalStatus,
          lockedBy: params.actor.userId,
          lockedAt: new Date(),
          publishedAt: params.action === 'PUBLISH' ? new Date() : undefined,
        },
      });

      // Generate Payslips for each employee
      for (const item of run.items) {
        const payslipNumber = `PS-${run.cycle.year}${String(run.cycle.month).padStart(2, '0')}-${item.employee.employeeCode}`;

        await tx.payslip.upsert({
          where: {
            tenantId_employeeId_month_year: {
              tenantId: params.tenantId,
              employeeId: item.employeeId,
              month: run.cycle.month,
              year: run.cycle.year,
            },
          },
          update: {
            payrollItemId: item.id,
            payableDays: item.payableDays,
            grossEarnings: item.grossEarnings,
            totalDeductions: item.totalDeductions,
            netSalary: item.netSalary,
          },
          create: {
            tenantId: params.tenantId,
            payrollItemId: item.id,
            employeeId: item.employeeId,
            payslipNumber,
            month: run.cycle.month,
            year: run.cycle.year,
            payableDays: item.payableDays,
            grossEarnings: item.grossEarnings,
            totalDeductions: item.totalDeductions,
            netSalary: item.netSalary,
          },
        });
      }

      return updatedRun;
    });

    await createAuditLog({
      tenantId: params.tenantId,
      actorId: params.actor.userId,
      actorRole: params.actor.roles[0] || 'FINANCE',
      action: `PAYROLL_${params.action}ED`,
      entityType: 'PAYROLL_RUN',
      entityId: run.id,
      afterState: { status: finalStatus, totalEmployees: run.items.length },
    });

    return result;
  }
}
