import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { initializeEmployeeOnboarding } from '@/lib/onboarding/engine';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const employeeId = searchParams.get('employeeId');

    const instances = await prisma.onboardingInstance.findMany({
      where: {
        tenantId: user.tenantId,
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: true,
        template: true,
        items: {
          include: { task: true },
          orderBy: { task: { sortOrder: 'asc' } },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    return NextResponse.json({ instances });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { employeeId, templateId } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    const instance = await initializeEmployeeOnboarding({
      tenantId: user.tenantId,
      employeeId,
      templateId,
    });

    return NextResponse.json({ success: true, instance }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
