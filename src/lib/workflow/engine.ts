import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { createAuditLog } from '../audit';

export interface CreateWorkflowInstanceParams {
  tenantId: string;
  workflowType: 'LEAVE_APPROVAL' | 'ATTENDANCE_REGULARIZATION' | 'PAYROLL_APPROVAL';
  entityType: 'LEAVE_REQUEST' | 'ATTENDANCE_REGULARIZATION' | 'PAYROLL_RUN';
  entityId: string;
  initiatorId: string;
  primaryApproverId?: string;
  backupApproverId?: string;
}

export async function initializeWorkflowInstance(params: CreateWorkflowInstanceParams) {
  // Check if definition exists or create default definition
  let definition = await prisma.workflowDefinition.findUnique({
    where: {
      tenantId_workflowType: {
        tenantId: params.tenantId,
        workflowType: params.workflowType,
      },
    },
  });

  if (!definition) {
    definition = await prisma.workflowDefinition.create({
      data: {
        tenantId: params.tenantId,
        workflowType: params.workflowType,
        stepsConfig: JSON.stringify([
          {
            stepNumber: 1,
            name: 'Manager / Backup Approval',
            requireBackup: true,
          },
        ]),
      },
    });
  }

  const instance = await prisma.workflowInstance.create({
    data: {
      tenantId: params.tenantId,
      workflowDefinitionId: definition.id,
      entityType: params.entityType,
      entityId: params.entityId,
      currentStep: 1,
      status: 'IN_PROGRESS',
      initiatorId: params.initiatorId,
      steps: {
        create: {
          stepNumber: 1,
          approverId: params.primaryApproverId,
          backupApproverId: params.backupApproverId,
          action: 'PENDING',
        },
      },
    },
    include: {
      steps: true,
    },
  });

  return instance;
}

export async function processWorkflowStepAction(params: {
  tenantId: string;
  workflowInstanceId: string;
  actor: AuthUser;
  action: 'APPROVED' | 'REJECTED';
  comments?: string;
}) {
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: params.workflowInstanceId },
    include: {
      steps: {
        where: { action: 'PENDING' },
        orderBy: { stepNumber: 'asc' },
      },
    },
  });

  if (!instance) {
    throw new Error('Workflow instance not found');
  }

  if (instance.status !== 'IN_PROGRESS') {
    throw new Error(`Workflow is already ${instance.status}`);
  }

  const currentStep = instance.steps[0];
  if (!currentStep) {
    throw new Error('No pending workflow step found');
  }

  // Verify actor authorization: primary approver, backup approver, or HR/Company Admin
  const isPrimaryApprover = currentStep.approverId === params.actor.employeeId || currentStep.approverId === params.actor.userId;
  const isBackupApprover = currentStep.backupApproverId === params.actor.employeeId || currentStep.backupApproverId === params.actor.userId;
  const isAdmin = params.actor.roles.some((r) =>
    ['COMPANY_ADMIN', 'HR_ADMIN', 'PLATFORM_SUPER_ADMIN'].includes(r)
  );

  if (!isPrimaryApprover && !isBackupApprover && !isAdmin) {
    throw new Error('You are not authorized to act on this approval step');
  }

  // Update step
  const updatedStep = await prisma.workflowStep.update({
    where: { id: currentStep.id },
    data: {
      action: params.action,
      actionTakenBy: params.actor.userId,
      comments: params.comments,
      completedAt: new Date(),
    },
  });

  // Update instance status
  const finalStatus = params.action === 'REJECTED' ? 'REJECTED' : 'APPROVED';
  const updatedInstance = await prisma.workflowInstance.update({
    where: { id: instance.id },
    data: {
      status: finalStatus,
    },
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0] || 'APPROVER',
    action: `WORKFLOW_${params.action}`,
    entityType: instance.entityType,
    entityId: instance.entityId,
    beforeState: { status: instance.status, stepId: currentStep.id },
    afterState: { status: finalStatus, actionTakenBy: params.actor.userId, comments: params.comments },
  });

  return { instance: updatedInstance, step: updatedStep };
}
