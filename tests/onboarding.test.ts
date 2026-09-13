import { describe, it, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Employee Onboarding Playbook & Task Verification Engine', () => {
  let tenantId: string;
  let employeeId: string;
  let templateId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: 'ai-automation-labs' } });
    tenantId = tenant!.id;
    const emp = await prisma.employee.findFirst({ where: { tenantId, employeeCode: 'EMP-2026-0005' } });
    employeeId = emp!.id;
    const tmpl = await prisma.onboardingTemplate.findFirst({ where: { tenantId } });
    templateId = tmpl!.id;
  });

  it('should verify onboarding templates and sequential task steps', async () => {
    const template = await prisma.onboardingTemplate.findUnique({
      where: { id: templateId },
      include: { tasks: true },
    });

    expect(template).toBeDefined();
    expect(template?.title).toBe('Engineering New Hire Playbook');
    expect(template?.tasks.length).toBeGreaterThanOrEqual(3);

    const docTask = template?.tasks.find((t) => t.category === 'DOCUMENT_SUBMISSION');
    expect(docTask?.taskTitle).toContain('Aadhaar');
  });

  it('should instantiate and track progress of an onboarding checklist for a new employee', async () => {
    const template = await prisma.onboardingTemplate.findUnique({
      where: { id: templateId },
      include: { tasks: true },
    });

    const instance = await prisma.onboardingInstance.create({
      data: {
        tenantId,
        employeeId,
        onboardingTemplateId: template!.id,
        status: 'IN_PROGRESS',
        totalTasksCount: template!.tasks.length,
        completedTasksCount: 0,
        items: {
          create: template!.tasks.map((task) => ({
            onboardingTaskId: task.id,
            status: 'PENDING',
          })),
        },
      },
      include: { items: true },
    });

    expect(instance.items.length).toBe(template!.tasks.length);
    expect(instance.status).toBe('IN_PROGRESS');

    // Complete first item
    const firstItem = instance.items[0];
    const updatedItem = await prisma.onboardingItem.update({
      where: { id: firstItem.id },
      data: { status: 'VERIFIED', completedAt: new Date() },
    });

    expect(updatedItem.status).toBe('VERIFIED');
  });
});
