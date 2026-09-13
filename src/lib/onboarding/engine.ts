import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { createAuditLog } from '../audit';

export async function createOnboardingTemplate(params: {
  tenantId: string;
  title: string;
  description?: string;
  department?: string;
  tasks: { taskTitle: string; category: string; dueDays: number; isRequired: boolean }[];
}) {
  const template = await prisma.onboardingTemplate.create({
    data: {
      tenantId: params.tenantId,
      title: params.title,
      description: params.description,
      department: params.department,
      tasks: {
        create: params.tasks.map((t, idx) => ({
          taskTitle: t.taskTitle,
          category: t.category,
          dueDaysFromJoining: t.dueDays,
          isRequired: t.isRequired,
          sortOrder: idx + 1,
        })),
      },
    },
    include: { tasks: true },
  });

  return template;
}

export async function initializeEmployeeOnboarding(params: {
  tenantId: string;
  employeeId: string;
  templateId?: string;
}) {
  let template: any;
  if (params.templateId) {
    template = await prisma.onboardingTemplate.findUnique({
      where: { id: params.templateId },
      include: { tasks: true },
    });
  } else {
    template = await prisma.onboardingTemplate.findFirst({
      where: { tenantId: params.tenantId },
      include: { tasks: true },
    });
  }

  if (!template) {
    // Create default engineering checklist template
    template = await createOnboardingTemplate({
      tenantId: params.tenantId,
      title: 'Standard Enterprise Engineering Onboarding',
      description: 'Default onboarding workflow covering document submission, IT setup and manager induction',
      tasks: [
        { taskTitle: 'Submit Identity & Bank Details (PAN, Aadhaar, Cancelled Cheque)', category: 'DOCUMENT_SUBMISSION', dueDays: 2, isRequired: true },
        { taskTitle: 'Sign Company Code of Conduct & NDA', category: 'POLICY_SIGNING', dueDays: 1, isRequired: true },
        { taskTitle: 'IT Email & Slack Workspace Provisioning', category: 'IT_SETUP', dueDays: 1, isRequired: true },
        { taskTitle: 'Hardware Asset Handover (MacBook / Laptop)', category: 'ASSET_ASSIGNMENT', dueDays: 2, isRequired: true },
        { taskTitle: 'Manager 1-on-1 Induction & Goal Setting', category: 'MANAGER_INDUCTION', dueDays: 5, isRequired: true },
      ],
    });
  }

  const instance = await prisma.onboardingInstance.create({
    data: {
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      onboardingTemplateId: template.id,
      status: 'IN_PROGRESS',
      totalTasksCount: template.tasks.length,
      completedTasksCount: 0,
      items: {
        create: template.tasks.map((t: any) => ({
          onboardingTaskId: t.id,
          status: 'PENDING',
        })),
      },
    },
    include: { items: { include: { task: true } } },
  });

  return instance;
}

export async function updateOnboardingItemStatus(params: {
  tenantId: string;
  itemId: string;
  status: 'PENDING' | 'SUBMITTED' | 'COMPLETED' | 'VERIFIED';
  evidenceUrl?: string;
  notes?: string;
  actor: AuthUser;
}) {
  const item = await prisma.onboardingItem.findUnique({
    where: { id: params.itemId },
    include: { instance: true },
  });

  if (!item) throw new Error('Onboarding item not found');

  const updatedItem = await prisma.onboardingItem.update({
    where: { id: item.id },
    data: {
      status: params.status,
      evidenceUrl: params.evidenceUrl,
      notes: params.notes,
      completedAt: ['COMPLETED', 'VERIFIED'].includes(params.status) ? new Date() : null,
    },
  });

  // Recalculate instance completion
  const allItems = await prisma.onboardingItem.findMany({
    where: { onboardingInstanceId: item.onboardingInstanceId },
  });

  const completedCount = allItems.filter((i) => ['COMPLETED', 'VERIFIED'].includes(i.status)).length;
  const isAllComplete = completedCount === allItems.length;

  const updatedInstance = await prisma.onboardingInstance.update({
    where: { id: item.onboardingInstanceId },
    data: {
      completedTasksCount: completedCount,
      status: isAllComplete ? 'COMPLETED' : 'IN_PROGRESS',
      completedAt: isAllComplete ? new Date() : null,
    },
  });

  // If completed, update employee status to ACTIVE / CONFIRMED
  if (isAllComplete) {
    await prisma.employee.update({
      where: { id: item.instance.employeeId },
      data: { status: 'ACTIVE' },
    });
  }

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0],
    action: 'UPDATE_ONBOARDING_TASK',
    entityType: 'ONBOARDING',
    entityId: item.id,
    afterState: { status: params.status, completedCount, isAllComplete },
  });

  return { item: updatedItem, instance: updatedInstance };
}
