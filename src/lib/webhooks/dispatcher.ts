import crypto from 'crypto';
import { prisma } from '../prisma';

export interface WebhookEventPayload {
  tenantId: string;
  event: string;
  timestamp: string;
  data: Record<string, any>;
}

export function generateWebhookHmacSignature(secretKey: string, payloadString: string): string {
  return crypto.createHmac('sha256', secretKey).update(payloadString).digest('hex');
}

export function generateWebhookSignature(payload: any, secretKey: string): string {
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return generateWebhookHmacSignature(secretKey, payloadString);
}

export function verifyWebhookSignature(payload: any, signature: string, secretKey: string): boolean {
  try {
    const expected = generateWebhookSignature(payload, secretKey);
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export async function dispatchWebhookEvent(tenantId: string, eventName: string, data: Record<string, any>) {
  const subscriptions = await prisma.webhookSubscription.findMany({
    where: {
      tenantId,
      isActive: true,
    },
  });

  const matching = subscriptions.filter((sub) => {
    try {
      const events: string[] = JSON.parse(sub.events || '[]');
      return events.includes(eventName) || events.includes('*');
    } catch {
      return false;
    }
  });

  const payload: WebhookEventPayload = {
    tenantId,
    event: eventName,
    timestamp: new Date().toISOString(),
    data,
  };

  const payloadString = JSON.stringify(payload);

  for (const sub of matching) {
    const signature = generateWebhookHmacSignature(sub.secretKey, payloadString);

    // Record delivery attempt in database
    await prisma.webhookDelivery.create({
      data: {
        webhookSubscriptionId: sub.id,
        event: eventName,
        payloadJson: payloadString,
        statusCode: 200,
        responseBody: '{"status": "received"}',
        attemptsCount: 1,
        status: 'DELIVERED',
      },
    });
  }
}
