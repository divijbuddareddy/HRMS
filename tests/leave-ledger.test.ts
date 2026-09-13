import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { calculateEmployeeLeaveBalance, addLeaveLedgerTransaction } from '../src/lib/leave/engine';

const prisma = new PrismaClient();

describe('1D. Leave Management & Double-Entry Ledger', () => {
  let tenantId: string;
  let employeeId: string;
  let clLeaveTypeId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: 'ai-automation-labs' } });
    if (!tenant) throw new Error('AI Automation Labs tenant must exist');
    tenantId = tenant.id;

    const emp = await prisma.employee.findFirst({ where: { tenantId } });
    if (!emp) throw new Error('Employee must exist');
    employeeId = emp.id;

    const cl = await prisma.leaveType.findFirst({ where: { tenantId, code: 'CL' } });
    if (!cl) throw new Error('Casual leave type must exist');
    clLeaveTypeId = cl.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should derive current leave balance strictly from double-entry ledger transactions', async () => {
    const initialBalance = await calculateEmployeeLeaveBalance(tenantId, employeeId, clLeaveTypeId);

    // Add ACCRUAL (+2 days)
    await addLeaveLedgerTransaction({
      tenantId,
      employeeId,
      leaveTypeId: clLeaveTypeId,
      transactionType: 'ACCRUAL',
      days: 2,
      reason: 'Monthly accrual test',
    });

    const balanceAfterAccrual = await calculateEmployeeLeaveBalance(tenantId, employeeId, clLeaveTypeId);
    expect(balanceAfterAccrual).toBe(initialBalance + 2);

    // Add CONSUMPTION (-1 day)
    await addLeaveLedgerTransaction({
      tenantId,
      employeeId,
      leaveTypeId: clLeaveTypeId,
      transactionType: 'CONSUMPTION',
      days: -1,
      reason: 'Leave taken test',
    });

    const balanceAfterConsumption = await calculateEmployeeLeaveBalance(tenantId, employeeId, clLeaveTypeId);
    expect(balanceAfterConsumption).toBe(initialBalance + 1);
  });
});
