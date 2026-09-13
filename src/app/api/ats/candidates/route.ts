import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { applyCandidate } from '@/lib/ats/engine';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');

    const candidates = await prisma.candidate.findMany({
      where: {
        tenantId: user.tenantId,
        ...(jobId ? { jobRequisitionId: jobId } : {}),
      },
      include: {
        jobRequisition: true,
        interviews: true,
        offer: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ candidates });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const candidate = await applyCandidate({
      tenantId: user.tenantId,
      jobRequisitionId: body.jobRequisitionId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      currentCompany: body.currentCompany,
      currentCtc: body.currentCtc ? parseFloat(body.currentCtc) : undefined,
      expectedCtc: body.expectedCtc ? parseFloat(body.expectedCtc) : undefined,
      noticePeriodDays: body.noticePeriodDays ? parseInt(body.noticePeriodDays) : 30,
      resumeText: body.resumeText,
      skills: body.skills,
    });

    return NextResponse.json({ success: true, candidate }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
