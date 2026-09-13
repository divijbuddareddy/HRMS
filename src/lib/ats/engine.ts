import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { createAuditLog } from '../audit';

// AI Match score calculation between Job requirements & Candidate skills
export function calculateJobMatchScore(jobRequirements: string, candidateSkills?: string | null): number {
  if (!candidateSkills) return 65; // baseline
  try {
    const skillsList = JSON.parse(candidateSkills);
    if (!Array.isArray(skillsList) || skillsList.length === 0) return 65;

    const lowerReq = jobRequirements.toLowerCase();
    let matches = 0;
    for (const skill of skillsList) {
      if (lowerReq.includes(String(skill).toLowerCase())) {
        matches += 1;
      }
    }
    const score = Math.min(98, Math.max(50, Math.round((matches / skillsList.length) * 50 + 45)));
    return score;
  } catch {
    return 75;
  }
}

export function calculateCandidateMatchScore(skills: string[], requirements: string): number {
  return calculateJobMatchScore(requirements, JSON.stringify(skills));
}

export async function createJobRequisition(params: {
  tenantId: string;
  title: string;
  code: string;
  departmentId: string;
  designationId: string;
  branchLocationId: string;
  legalEntityId: string;
  headcount?: number;
  experienceYears?: number;
  minCtc?: number;
  maxCtc?: number;
  description: string;
  requirements: string;
  actor: AuthUser;
}) {
  const job = await prisma.jobRequisition.create({
    data: {
      tenantId: params.tenantId,
      title: params.title,
      code: params.code,
      departmentId: params.departmentId,
      designationId: params.designationId,
      branchLocationId: params.branchLocationId,
      legalEntityId: params.legalEntityId,
      headcount: params.headcount || 1,
      experienceYears: params.experienceYears || 2,
      minCtc: params.minCtc,
      maxCtc: params.maxCtc,
      description: params.description,
      requirements: params.requirements,
      status: 'PUBLISHED',
    },
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0],
    action: 'CREATE_JOB_REQUISITION',
    entityType: 'ATS',
    entityId: job.id,
    afterState: job,
  });

  return job;
}

export async function applyCandidate(params: {
  tenantId: string;
  jobRequisitionId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  currentCompany?: string;
  currentCtc?: number;
  expectedCtc?: number;
  noticePeriodDays?: number;
  resumeText?: string;
  skills?: string[]; // Array of skills
}) {
  const job = await prisma.jobRequisition.findUnique({ where: { id: params.jobRequisitionId } });
  if (!job) throw new Error('Job requisition not found');

  const skillsJson = params.skills ? JSON.stringify(params.skills) : JSON.stringify(['TypeScript', 'React', 'Node.js']);
  const aiScore = calculateJobMatchScore(job.requirements + ' ' + job.description, skillsJson);

  const candidate = await prisma.candidate.create({
    data: {
      tenantId: params.tenantId,
      jobRequisitionId: params.jobRequisitionId,
      firstName: params.firstName,
      lastName: params.lastName,
      email: params.email.toLowerCase().trim(),
      phone: params.phone,
      currentCompany: params.currentCompany,
      currentCtc: params.currentCtc,
      expectedCtc: params.expectedCtc,
      noticePeriodDays: params.noticePeriodDays || 30,
      resumeText: params.resumeText,
      skills: skillsJson,
      aiMatchScore: aiScore,
      stage: 'APPLIED',
    },
  });

  return candidate;
}

export async function convertCandidateToEmployee(params: {
  tenantId: string;
  candidateId: string;
  actor: AuthUser;
}) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.candidateId },
    include: { jobRequisition: true, offer: true },
  });

  if (!candidate) throw new Error('Candidate not found');
  if (candidate.hiredEmployeeId) throw new Error('Candidate already hired as employee');

  const count = await prisma.employee.count({ where: { tenantId: params.tenantId } });
  const employeeCode = `EMP-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

  const ctc = candidate.offer?.offeredCtc || candidate.expectedCtc || 1200000;

  // Get default salary structure
  const structure = await prisma.salaryStructure.findFirst({
    where: { tenantId: params.tenantId, isDefault: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Employee
    const employee = await tx.employee.create({
      data: {
        tenantId: params.tenantId,
        employeeCode,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        displayName: `${candidate.firstName} ${candidate.lastName}`,
        workEmail: candidate.email,
        mobilePhone: candidate.phone,
        joiningDate: candidate.offer?.joiningDate || new Date(),
        legalEntityId: candidate.jobRequisition.legalEntityId,
        branchLocationId: candidate.jobRequisition.branchLocationId,
        departmentId: candidate.jobRequisition.departmentId,
        designationId: candidate.jobRequisition.designationId,
        status: 'ACTIVE',
      },
    });

    // 2. Assign Salary
    if (structure) {
      await tx.employeeSalaryAssignment.create({
        data: {
          tenantId: params.tenantId,
          employeeId: employee.id,
          structureId: structure.id,
          ctc,
          grossSalary: ctc / 12,
          netSalary: (ctc / 12) * 0.85,
          effectiveFrom: new Date(),
          isCurrent: true,
        },
      });
    }

    // 3. Update Candidate status
    await tx.candidate.update({
      where: { id: candidate.id },
      data: {
        stage: 'HIRED',
        hiredEmployeeId: employee.id,
      },
    });

    return employee;
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0],
    action: 'HIRE_CANDIDATE_TO_EMPLOYEE',
    entityType: 'ATS',
    entityId: candidate.id,
    afterState: { employeeId: result.id, employeeCode: result.employeeCode },
  });

  return result;
}
