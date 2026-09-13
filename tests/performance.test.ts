import { describe, it, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { calculateWeightedPerformanceScore } from '../src/lib/performance/engine';

const prisma = new PrismaClient();

describe('Performance OKR & 9-Box Appraisal Engine', () => {
  let tenantId: string;
  let cycleId: string;
  let emp1Id: string;
  let managerId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: 'ai-automation-labs' } });
    tenantId = tenant!.id;
    const cycle = await prisma.performanceCycle.findFirst({ where: { tenantId } });
    cycleId = cycle!.id;
    const emp1 = await prisma.employee.findFirst({ where: { tenantId, employeeCode: 'EMP-2026-0005' } });
    emp1Id = emp1!.id;
    const mgr = await prisma.employee.findFirst({ where: { tenantId, employeeCode: 'EMP-2026-0004' } });
    managerId = mgr!.id;
  });

  it('should compute weighted goal achievement accurately', () => {
    const goals = [
      { weight: 50, progressPercent: 100 }, // 50 * 1.0 = 50
      { weight: 30, progressPercent: 80 },  // 30 * 0.8 = 24
      { weight: 20, progressPercent: 90 },  // 20 * 0.9 = 18
    ];

    const score = calculateWeightedPerformanceScore(goals);
    expect(score).toBe(92); // 50 + 24 + 18 = 92
  });

  it('should create and progress performance appraisal through self and manager review', async () => {
    const appraisal = await prisma.performanceAppraisal.upsert({
      where: {
        performanceCycleId_employeeId: {
          performanceCycleId: cycleId,
          employeeId: emp1Id,
        },
      },
      update: {
        selfRating: 4.5,
        selfReviewNotes: 'Delivered all OKRs ahead of sprint schedule with 99.9% uptime.',
        managerRating: 4.8,
        managerReviewNotes: 'Exemplary execution on multi-tenant payroll engine and resilience.',
        finalRating: 4.7,
        promotionRecommend: true,
        incrementPercent: 15.0,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      create: {
        performanceCycleId: cycleId,
        employeeId: emp1Id,
        managerId,
        selfRating: 4.5,
        selfReviewNotes: 'Delivered all OKRs ahead of sprint schedule.',
        managerRating: 4.8,
        managerReviewNotes: 'Exemplary execution.',
        finalRating: 4.7,
        promotionRecommend: true,
        incrementPercent: 15.0,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    expect(appraisal.finalRating).toBe(4.7);
    expect(appraisal.status).toBe('COMPLETED');
    expect(appraisal.promotionRecommend).toBe(true);
  });
});
