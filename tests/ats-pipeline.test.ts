import { describe, it, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { calculateCandidateMatchScore } from '../src/lib/ats/engine';

const prisma = new PrismaClient();

describe('ATS Recruitment Pipeline Engine', () => {
  let tenantId: string;
  let jobReqId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: 'ai-automation-labs' } });
    tenantId = tenant!.id;
    const job = await prisma.jobRequisition.findFirst({ where: { tenantId, code: 'JOB-ENG-001' } });
    jobReqId = job!.id;
  });

  it('should calculate accurate AI match score based on candidate skills vs job requirements', () => {
    const candidateSkills = ['TypeScript', 'Node.js', 'PyTorch', 'Distributed Systems', 'PostgreSQL'];
    const jobRequirements = 'TypeScript, Node.js, PyTorch, Distributed Systems, PostgreSQL, Docker';

    const matchScore = calculateCandidateMatchScore(candidateSkills, jobRequirements);
    expect(matchScore).toBeGreaterThanOrEqual(80);
    expect(matchScore).toBeLessThanOrEqual(100);
  });

  it('should query candidate pipeline in stage progression', async () => {
    const candidates = await prisma.candidate.findMany({
      where: { tenantId, jobRequisitionId: jobReqId },
      include: { jobRequisition: true },
    });

    expect(candidates.length).toBeGreaterThan(0);
    const offeredCandidate = candidates.find((c) => c.stage === 'OFFERED');
    expect(offeredCandidate).toBeDefined();
    expect(offeredCandidate?.firstName).toBe('Kavita');
    expect(offeredCandidate?.aiMatchScore).toBe(94);
  });

  it('should enforce unique candidate email constraint per job requisition within tenant', async () => {
    await expect(
      prisma.candidate.create({
        data: {
          tenantId,
          jobRequisitionId: jobReqId,
          firstName: 'Duplicate',
          lastName: 'Candidate',
          email: 'kavita.k@example.com',
          stage: 'APPLIED',
        },
      })
    ).rejects.toThrow();
  });
});
