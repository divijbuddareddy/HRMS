import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const subscriptions = await prisma.webhookSubscription.findMany({
      where: { tenantId: user.tenantId },
      include: {
        deliveries: {
          orderBy: { deliveredAt: 'desc' },
          take: 10,
        },
      },
    });

    return NextResponse.json({ subscriptions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const secretKey = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const sub = await prisma.webhookSubscription.create({
      data: {
        tenantId: user.tenantId,
        targetUrl: body.targetUrl,
        secretKey,
        events: typeof body.events === 'string' ? body.events : JSON.stringify(body.events || ['*']),
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, subscription: sub }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
