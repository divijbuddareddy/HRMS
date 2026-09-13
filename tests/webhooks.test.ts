import { describe, it, expect } from 'vitest';
import { generateWebhookSignature, verifyWebhookSignature } from '../src/lib/webhooks/dispatcher';

describe('Webhook Delivery & HMAC-SHA256 Signature Engine', () => {
  const secretKey = 'whsec_test_secret_998877665544332211';
  const payload = {
    event: 'employee.onboarded',
    tenantId: 'tenant-123',
    data: {
      employeeId: 'emp-456',
      employeeCode: 'EMP-2026-0007',
      name: 'Vikram Mehta',
    },
    timestamp: 1778900000000,
  };

  it('should generate valid HMAC-SHA256 signature', () => {
    const signature = generateWebhookSignature(payload, secretKey);
    expect(signature).toHaveLength(64);
    expect(typeof signature).toBe('string');
  });

  it('should verify signature successfully when payload and secret match', () => {
    const signature = generateWebhookSignature(payload, secretKey);
    const isValid = verifyWebhookSignature(payload, signature, secretKey);
    expect(isValid).toBe(true);
  });

  it('should reject tampered payload or incorrect secret key', () => {
    const signature = generateWebhookSignature(payload, secretKey);
    const tamperedPayload = { ...payload, data: { ...payload.data, name: 'Attacker' } };

    const isValidTampered = verifyWebhookSignature(tamperedPayload, signature, secretKey);
    expect(isValidTampered).toBe(false);

    const isValidWrongSecret = verifyWebhookSignature(payload, signature, 'wrong_secret');
    expect(isValidWrongSecret).toBe(false);
  });
});
