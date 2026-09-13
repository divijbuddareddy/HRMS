import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { submitSelfAppraisal, submitManagerAppraisal } from '@/lib/performance/engine';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const cycleId = searchParams.get('cycleId');

    const appraisals = await prisma.performanceAppraisal.findMany({
      where: {
        ...(cycleId ? { performanceCycleId: cycleId } : {}),
      },
      include: {
        employee: true,
        manager: true,
        cycle: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ appraisals });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, cycleId, employeeId, selfRating, selfReviewNotes, managerRating, managerReviewNotes, promotionRecommend, incrementPercent } = body;

    let result: any;
    if (action === 'SELF_REVIEW') {
      result = await submitSelfAppraisal({
        tenantId: user.tenantId,
        cycleId,
        employeeId: employeeId || user.employeeId,
        selfRating: parseFloat(selfRating),
        selfReviewNotes,
        actor: user,
      });
    } else if (action === 'MANAGER_REVIEW') {
      result = await submitManagerAppraisal({
        tenantId: user.tenantId,
        cycleId,
        employeeId,
        managerRating: parseFloat(managerRating),
        managerReviewNotes,
        promotionRecommend,
        incrementPercent: incrementPercent ? parseFloat(incrementPercent) : 0,
        actor: user,
      });
    } else {
      return NextResponse.json({ error: 'Invalid appraisal action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, appraisal: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
