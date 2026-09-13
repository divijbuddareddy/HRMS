import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createPerformanceGoal } from '@/lib/performance/engine';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const employeeId = searchParams.get('employeeId') || user.employeeId;
    const cycleId = searchParams.get('cycleId');

    const goals = await prisma.performanceGoal.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        ...(cycleId ? { performanceCycleId: cycleId } : {}),
      },
      include: { cycle: true },
    });

    return NextResponse.json({ goals });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const goal = await createPerformanceGoal({
      tenantId: user.tenantId,
      performanceCycleId: body.performanceCycleId,
      employeeId: body.employeeId || user.employeeId,
      title: body.title,
      description: body.description,
      category: body.category || 'OKR',
      weight: body.weight ? parseFloat(body.weight) : 25,
      targetValue: body.targetValue,
    });

    return NextResponse.json({ success: true, goal }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
