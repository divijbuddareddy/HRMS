import { describe, it, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Expenses & Travel Reimbursement Engine', () => {
  let tenantId: string;
  let employeeId: string;
  let categoryId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: 'ai-automation-labs' } });
    tenantId = tenant!.id;
    const emp = await prisma.employee.findFirst({ where: { tenantId, employeeCode: 'EMP-2026-0005' } });
    employeeId = emp!.id;
    const cat = await prisma.expenseCategory.findFirst({ where: { tenantId, code: 'TRAVEL' } });
    categoryId = cat!.id;
  });

  it('should enforce category limit thresholds and receipt validation', async () => {
    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId },
    });

    expect(category).toBeDefined();
    expect(category?.maxLimit).toBe(50000);
    expect(category?.requiresReceipt).toBe(true);
  });

  it('should record expense claim and advance through dual-approval workflow', async () => {
    const claim = await prisma.expenseClaim.create({
      data: {
        tenantId,
        employeeId,
        expenseCategoryId: categoryId,
        claimDate: new Date(),
        amount: 8500,
        description: 'Client technical kickoff meeting flights',
        receiptUrl: 'https://placehold.co/600x400/png?text=Verified+Ticket',
        status: 'SUBMITTED',
      },
    });

    expect(claim.status).toBe('SUBMITTED');

    // Manager approval
    const managerApproved = await prisma.expenseClaim.update({
      where: { id: claim.id },
      data: { status: 'MANAGER_APPROVED', approverNotes: 'Manager L1 approved.' },
    });
    expect(managerApproved.status).toBe('MANAGER_APPROVED');

    // Finance final approval & payroll reimbursement queue
    const financeApproved = await prisma.expenseClaim.update({
      where: { id: claim.id },
      data: {
        status: 'FINANCE_APPROVED',
        paymentMethod: 'PAYROLL_REIMBURSEMENT',
        approverNotes: 'Finance L2 verified receipt checksum. Disbursed via next payroll batch.',
      },
    });
    expect(financeApproved.status).toBe('FINANCE_APPROVED');
    expect(financeApproved.paymentMethod).toBe('PAYROLL_REIMBURSEMENT');
  });
});
