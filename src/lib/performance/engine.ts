import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { createAuditLog } from '../audit';

export function calculateWeightedPerformanceScore(
  goals: Array<{ weight: number; progressPercent: number }>
): number {
  return goals.reduce((acc, g) => acc + g.weight * (g.progressPercent / 100), 0);
}

export async function createPerformanceCycle(params: {
  tenantId: string;
  title: string;
  cycleType: 'ANNUAL' | 'HALF_YEARLY' | 'QUARTERLY';
  startDate: Date;
  endDate: Date;
  actor: AuthUser;
}) {
  const cycle = await prisma.performanceCycle.create({
    data: {
      tenantId: params.tenantId,
      title: params.title,
      cycleType: params.cycleType,
      startDate: params.startDate,
      endDate: params.endDate,
      status: 'ACTIVE',
    },
  });

  return cycle;
}

export async function createPerformanceGoal(params: {
  tenantId: string;
  performanceCycleId: string;
  employeeId: string;
  title: string;
  description?: string;
  category: 'OKR' | 'KRA' | 'KPI';
  weight?: number;
  targetValue?: string;
}) {
  const goal = await prisma.performanceGoal.create({
    data: {
      performanceCycleId: params.performanceCycleId,
      employeeId: params.employeeId,
      title: params.title,
      description: params.description,
      category: params.category,
      weight: params.weight || 25,
      targetValue: params.targetValue,
      progressPercent: 0,
    },
  });

  return goal;
}

export async function submitSelfAppraisal(params: {
  tenantId: string;
  cycleId: string;
  employeeId: string;
  selfRating: number;
  selfReviewNotes: string;
  actor: AuthUser;
}) {
  const employee = await prisma.employee.findUnique({
    where: { id: params.employeeId },
    include: { reportingManager: true },
  });
  if (!employee) throw new Error('Employee not found');

  const managerId = employee.reportingManagerId || employee.id;

  const appraisal = await prisma.performanceAppraisal.upsert({
    where: {
      performanceCycleId_employeeId: {
        performanceCycleId: params.cycleId,
        employeeId: params.employeeId,
      },
    },
    update: {
      selfRating: params.selfRating,
      selfReviewNotes: params.selfReviewNotes,
      status: 'MANAGER_REVIEW_PENDING',
    },
    create: {
      performanceCycleId: params.cycleId,
      employeeId: params.employeeId,
      managerId,
      selfRating: params.selfRating,
      selfReviewNotes: params.selfReviewNotes,
      status: 'MANAGER_REVIEW_PENDING',
    },
  });

  return appraisal;
}

export async function submitManagerAppraisal(params: {
  tenantId: string;
  cycleId: string;
  employeeId: string;
  managerRating: number;
  managerReviewNotes: string;
  finalRating?: number;
  promotionRecommend?: boolean;
  incrementPercent?: number;
  actor: AuthUser;
}) {
  const finalRating = params.finalRating || params.managerRating;

  const appraisal = await prisma.performanceAppraisal.update({
    where: {
      performanceCycleId_employeeId: {
        performanceCycleId: params.cycleId,
        employeeId: params.employeeId,
      },
    },
    data: {
      managerRating: params.managerRating,
      managerReviewNotes: params.managerReviewNotes,
      finalRating,
      promotionRecommend: params.promotionRecommend || false,
      incrementPercent: params.incrementPercent || 0,
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0] || 'MANAGER',
    action: 'COMPLETE_PERFORMANCE_APPRAISAL',
    entityType: 'PERFORMANCE',
    entityId: appraisal.id,
    afterState: {
      employeeId: params.employeeId,
      finalRating,
      incrementPercent: params.incrementPercent,
      promotionRecommend: params.promotionRecommend,
    },
  });

  return appraisal;
}
