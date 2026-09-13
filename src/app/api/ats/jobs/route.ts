import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createJobRequisition } from '@/lib/ats/engine';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const jobs = await prisma.jobRequisition.findMany({
      where: { tenantId: user.tenantId },
      include: {
        department: true,
        designation: true,
        branchLocation: true,
        candidates: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ jobs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const job = await createJobRequisition({
      tenantId: user.tenantId,
      title: body.title,
      code: body.code,
      departmentId: body.departmentId,
      designationId: body.designationId,
      branchLocationId: body.branchLocationId,
      legalEntityId: body.legalEntityId,
      headcount: body.headcount ? parseInt(body.headcount) : 1,
      experienceYears: body.experienceYears ? parseInt(body.experienceYears) : 2,
      minCtc: body.minCtc ? parseFloat(body.minCtc) : undefined,
      maxCtc: body.maxCtc ? parseFloat(body.maxCtc) : undefined,
      description: body.description,
      requirements: body.requirements,
      actor: user,
    });

    return NextResponse.json({ success: true, job }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
