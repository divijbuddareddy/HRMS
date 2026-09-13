import { describe, it, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { processAIAssistantQuery } from '../src/lib/ai/gateway';

const prisma = new PrismaClient();

describe('AI Gateway & RBAC Policy Guard', () => {
  let tenantId: string;
  let employeeId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: 'ai-automation-labs' } });
    tenantId = tenant!.id;
    const emp = await prisma.employee.findFirst({ where: { tenantId, employeeCode: 'EMP-2026-0005' } });
    employeeId = emp!.id;
  });

  it('should answer leave policy and sandwich rule questions accurately', async () => {
    const res = await processAIAssistantQuery({
      tenantId,
      employeeId,
      role: 'EMPLOYEE',
      query: 'What is the sandwich leave policy?',
    });

    expect(res.response).toContain('Sandwich Rule');
    expect(res.response.toLowerCase()).toContain('leave');
  });

  it('should answer tax regime and statutory queries accurately', async () => {
    const res = await processAIAssistantQuery({
      tenantId,
      employeeId,
      role: 'EMPLOYEE',
      query: 'How does the New Tax Regime compare to Old Regime?',
    });

    expect(res.response).toContain('Tax Regime');
  });

  it('should protect sensitive tenant analytics from standard employee role', async () => {
    const res = await processAIAssistantQuery({
      tenantId,
      employeeId,
      role: 'EMPLOYEE',
      query: 'Show me total company payroll cost and all employee bank account details',
    });

    expect(res.response).toContain('Access Restricted');
  });
});
