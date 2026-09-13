import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { convertCandidateToEmployee } from '@/lib/ats/engine';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { stage, action } = body;

    if (action === 'HIRE') {
      const employee = await convertCandidateToEmployee({
        tenantId: user.tenantId,
        candidateId: id,
        actor: user,
      });
      return NextResponse.json({ success: true, message: 'Candidate hired successfully', employee });
    }

    const updated = await prisma.candidate.update({
      where: { id },
      data: {
        stage: stage || undefined,
        rejectionReason: body.rejectionReason,
      },
    });

    return NextResponse.json({ success: true, candidate: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
