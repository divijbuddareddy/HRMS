import { describe, it, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { calculateFnFSettlement, calculateGratuity } from '../src/lib/exit/engine';

const prisma = new PrismaClient();

describe('Exit Management & Full and Final (F&F) Settlement Engine', () => {
  let tenantId: string;
  let employeeId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: 'ai-automation-labs' } });
    tenantId = tenant!.id;
    const emp = await prisma.employee.findFirst({ where: { tenantId, employeeCode: 'EMP-2026-0006' } });
    employeeId = emp!.id;
  });

  it('should compute statutory gratuity accurately under Payment of Gratuity Act 1972', () => {
    const monthlyBasic = 50000;
    
    // Less than 5 continuous years -> 0
    expect(calculateGratuity(monthlyBasic, 3)).toBe(0);

    // 5 years -> (15 * 50000 * 5) / 26 = 144,230.76 -> 144,231
    const fiveYearGratuity = calculateGratuity(monthlyBasic, 5);
    expect(fiveYearGratuity).toBe(144231);

    // 10 years -> (15 * 50000 * 10) / 26 = 288,461.53 -> 288,462
    const tenYearGratuity = calculateGratuity(monthlyBasic, 10);
    expect(tenYearGratuity).toBe(288462);
  });

  it('should compute complete F&F statement with notice recovery and leave encashment', () => {
    const fnf = calculateFnFSettlement({
      monthlyGross: 100000,
      monthlyBasic: 50000,
      payableDays: 15,
      daysInMonth: 30,
      leaveBalanceDays: 12,
      noticePeriodRequiredDays: 60,
      noticePeriodServedDays: 30, // 30 days shortfall
      tenureYears: 2, // No gratuity
      approvedReimbursements: 5000,
    });

    // Earned salary: 100,000 * (15 / 30) = 50,000
    expect(fnf.earnedSalary).toBe(50000);

    // Leave encashment: (50,000 / 30) * 12 = 20,000
    expect(fnf.leaveEncashment).toBe(20000);

    // Notice recovery (shortfall 30 days): (100,000 / 30) * 30 = 100,000
    expect(fnf.noticeRecovery).toBe(100000);

    // Gratuity: 0
    expect(fnf.gratuity).toBe(0);

    // Total Payable = 50,000 + 20,000 + 5,000 - 100,000 = -25,000 (Shortfall exceeds earnings)
    expect(fnf.netSettlement).toBe(-25000);
  });

  it('should store and retrieve F&F settlement record in database', async () => {
    const exitRecord = await prisma.exitRequest.findFirst({
      where: { tenantId, employeeId },
      include: { settlement: true },
    });

    expect(exitRecord).toBeDefined();
    expect(exitRecord?.settlement).toBeDefined();
    expect(exitRecord?.itClearanceStatus).toBe('CLEARED');
  });
});
