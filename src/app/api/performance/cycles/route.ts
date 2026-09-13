import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createPerformanceCycle } from '@/lib/performance/engine';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const cycles = await prisma.performanceCycle.findMany({
      where: { tenantId: user.tenantId },
      include: {
        goals: true,
        appraisals: {
          include: { employee: true, manager: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ cycles });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const cycle = await createPerformanceCycle({
      tenantId: user.tenantId,
      title: body.title,
      cycleType: body.cycleType || 'ANNUAL',
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      actor: user,
    });

    return NextResponse.json({ success: true, cycle }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
