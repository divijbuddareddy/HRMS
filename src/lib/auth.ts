import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { prisma } from './prisma';
import { AuthUser, RoleName, DataScope } from './types';

const JWT_SECRET = process.env.JWT_SECRET || 'ai-automation-labs-hrms-master-jwt-secret-key-2026';
const TOKEN_EXPIRY = '7d';

// In-memory rate limiting map for login attempts: ip/email -> { count, lastAttempt }
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: AuthUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export function checkRateLimit(key: string, maxAttempts = 5, windowMs = 15 * 60 * 1000): { allowed: boolean; remainingMs?: number } {
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record) {
    loginAttempts.set(key, { count: 1, lastAttempt: now });
    return { allowed: true };
  }

  if (now - record.lastAttempt > windowMs) {
    loginAttempts.set(key, { count: 1, lastAttempt: now });
    return { allowed: true };
  }

  if (record.count >= maxAttempts) {
    const remainingMs = windowMs - (now - record.lastAttempt);
    return { allowed: false, remainingMs };
  }

  record.count += 1;
  record.lastAttempt = now;
  return { allowed: true };
}

export function resetRateLimit(key: string): void {
  loginAttempts.delete(key);
}

export async function getAuthenticatedUser(req: NextRequest): Promise<AuthUser | null> {
  // 1. Check Authorization: Bearer <token>
  const authHeader = req.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  // 2. Check cookie if header not found
  if (!token) {
    const cookie = req.cookies.get('token');
    token = cookie ? cookie.value : null;
  }

  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded) return null;

  // Verify user still exists, active, and belongs to tenant
  const user = await prisma.user.findFirst({
    where: {
      id: decoded.userId,
      tenantId: decoded.tenantId,
      status: 'ACTIVE',
    },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              permissions: true,
            },
          },
        },
      },
      employee: {
        select: {
          id: true,
          departmentId: true,
          branchLocationId: true,
          legalEntityId: true,
        },
      },
    },
  });

  if (!user) return null;

  const roles = user.userRoles.map((ur) => ur.role.name as RoleName);
  const permissions = user.userRoles.flatMap((ur) =>
    ur.role.permissions.map((p) => ({
      permissionKey: p.permissionKey,
      dataScope: p.dataScope as DataScope,
      isSensitive: p.isSensitive,
    }))
  );

  return {
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    employeeId: user.employee?.id,
    roles,
    permissions,
    departmentId: user.employee?.departmentId,
    branchLocationId: user.employee?.branchLocationId,
    legalEntityId: user.employee?.legalEntityId,
  };
}
