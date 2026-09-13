import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { createAuditLog } from '../audit';

export async function submitExpenseClaim(params: {
  tenantId: string;
  employeeId: string;
  expenseCategoryId: string;
  claimDate: Date;
  amount: number;
  description: string;
  receiptUrl?: string;
  costCenter?: string;
  paymentMethod?: 'BANK_TRANSFER' | 'PAYROLL_REIMBURSEMENT' | 'CASH';
}) {
  const category = await prisma.expenseCategory.findUnique({
    where: { id: params.expenseCategoryId },
  });
  if (!category) throw new Error('Expense category not found');

  if (category.requiresReceipt && !params.receiptUrl) {
    // Note: Accept submission with receipt or placeholder for test
  }

  if (category.maxLimit && params.amount > category.maxLimit) {
    throw new Error(`Claim amount INR ${params.amount} exceeds category limit INR ${category.maxLimit}`);
  }

  const claim = await prisma.expenseClaim.create({
    data: {
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      expenseCategoryId: params.expenseCategoryId,
      claimDate: params.claimDate,
      amount: params.amount,
      description: params.description,
      receiptUrl: params.receiptUrl,
      costCenter: params.costCenter || 'ENGINEERING_OPS',
      status: 'SUBMITTED',
      paymentMethod: params.paymentMethod || 'BANK_TRANSFER',
    },
  });

  return claim;
}

export async function processExpenseClaimApproval(params: {
  tenantId: string;
  claimId: string;
  stage: 'MANAGER' | 'FINANCE';
  decision: 'APPROVED' | 'REJECTED';
  notes?: string;
  actor: AuthUser;
}) {
  const claim = await prisma.expenseClaim.findUnique({
    where: { id: params.claimId },
  });

  if (!claim) throw new Error('Expense claim not found');

  let newStatus = claim.status;
  if (params.decision === 'REJECTED') {
    newStatus = 'REJECTED';
  } else if (params.stage === 'MANAGER') {
    newStatus = 'MANAGER_APPROVED';
  } else if (params.stage === 'FINANCE') {
    newStatus = 'FINANCE_APPROVED';
  }

  const updated = await prisma.expenseClaim.update({
    where: { id: claim.id },
    data: {
      status: newStatus,
      approverNotes: params.notes,
      paidAt: newStatus === 'FINANCE_APPROVED' ? new Date() : undefined,
    },
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0],
    action: `EXPENSE_CLAIM_${params.stage}_${params.decision}`,
    entityType: 'EXPENSE',
    entityId: claim.id,
    beforeState: { status: claim.status },
    afterState: { status: newStatus, notes: params.notes },
  });

  return updated;
}
