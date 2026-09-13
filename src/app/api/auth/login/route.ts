import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, generateToken, checkRateLimit, resetRateLimit } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { RoleName, DataScope } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { email, password, tenantSlug } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimitKey = `${clientIp}:${email}`;
    const rateCheck = checkRateLimit(rateLimitKey);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many failed login attempts. Please try again in ${Math.ceil((rateCheck.remainingMs || 0) / 60000)} minutes.` },
        { status: 429 }
      );
    }

    // Find tenant if slug provided, or find tenant by user email
    let tenantId: string | undefined;
    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
      }
      tenantId = tenant.id;
    }

    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        ...(tenantId ? { tenantId } : {}),
      },
      include: {
        tenant: true,
        userRoles: {
          include: {
            role: {
              include: {
                permissions: true,
              },
            },
          },
        },
        employee: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (user.status !== 'ACTIVE') {
      await createAuditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        action: 'LOGIN_BLOCKED',
        entityType: 'USER',
        entityId: user.id,
        afterState: { reason: `User account is ${user.status}` },
        ipAddress: clientIp,
      });
      return NextResponse.json({ error: `Account is ${user.status.toLowerCase()}. Please contact HR admin.` }, { status: 403 });
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      // Update failed login count
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: { increment: 1 } },
      });

      await createAuditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'USER',
        entityId: user.id,
        ipAddress: clientIp,
      });

      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Reset rate limit on success
    resetRateLimit(rateLimitKey);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lastLoginAt: new Date(),
      },
    });

    const roles = user.userRoles.map((ur) => ur.role.name as RoleName);
    const permissions = user.userRoles.flatMap((ur) =>
      ur.role.permissions.map((p) => ({
        permissionKey: p.permissionKey,
        dataScope: p.dataScope as DataScope,
        isSensitive: p.isSensitive,
      }))
    );

    const tokenPayload = {
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

    const token = generateToken(tokenPayload);

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.id,
      actorRole: roles[0] || 'EMPLOYEE',
      action: 'LOGIN_SUCCESS',
      entityType: 'USER',
      entityId: user.id,
      ipAddress: clientIp,
    });

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        tenantName: user.tenant.name,
        roles,
        employee: user.employee
          ? {
              id: user.employee.id,
              employeeCode: user.employee.employeeCode,
              firstName: user.employee.firstName,
              lastName: user.employee.lastName,
              displayName: user.employee.displayName,
            }
          : null,
      },
    });

    response.cookies.set('token', token, {
      httpOnly: false, // Accessible to client app
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
