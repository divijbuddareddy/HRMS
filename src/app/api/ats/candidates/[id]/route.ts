import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { convertCandidateToEmployee } from '@/lib/ats/engine';
import { isAdmin } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only administrators can edit or hire candidates
    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators have permission to edit candidate status or trigger hiring.' },
        { status: 403 }
      );
    }

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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only administrators can delete candidates
    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators have permission to delete candidate records.' },
        { status: 403 }
      );
    }

    const existing = await prisma.candidate.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    await prisma.candidate.delete({ where: { id } });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'DELETE_CANDIDATE',
      entityType: 'ATS',
      entityId: id,
      beforeState: existing,
    });

    return NextResponse.json({
      success: true,
      message: `Candidate ${existing.firstName} ${existing.lastName} deleted successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
