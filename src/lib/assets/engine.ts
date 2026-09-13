import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { createAuditLog } from '../audit';

export async function createAsset(params: {
  tenantId: string;
  assetName: string;
  assetTag: string;
  serialNumber?: string;
  category: 'LAPTOP' | 'MONITOR' | 'ACCESSORY' | 'PHONE' | 'SOFTWARE_LICENSE';
  purchaseDate?: Date;
  warrantyExpiry?: Date;
  purchaseCost?: number;
  branchLocationId?: string;
  actor: AuthUser;
}) {
  const asset = await prisma.asset.create({
    data: {
      tenantId: params.tenantId,
      assetName: params.assetName,
      assetTag: params.assetTag,
      serialNumber: params.serialNumber,
      category: params.category,
      purchaseDate: params.purchaseDate || new Date(),
      warrantyExpiry: params.warrantyExpiry,
      purchaseCost: params.purchaseCost,
      branchLocationId: params.branchLocationId,
      status: 'AVAILABLE',
    },
  });

  return asset;
}

export async function assignAssetToEmployee(params: {
  tenantId: string;
  assetId: string;
  employeeId: string;
  condition?: string;
  notes?: string;
  actor: AuthUser;
}) {
  const asset = await prisma.asset.findUnique({ where: { id: params.assetId } });
  if (!asset) throw new Error('Asset not found');
  if (asset.status === 'ASSIGNED') throw new Error('Asset is already assigned');

  const assignment = await prisma.$transaction(async (tx) => {
    const createdAssignment = await tx.assetAssignment.create({
      data: {
        assetId: params.assetId,
        employeeId: params.employeeId,
        condition: params.condition || 'GOOD',
        notes: params.notes,
        assignedDate: new Date(),
      },
    });

    await tx.asset.update({
      where: { id: params.assetId },
      data: { status: 'ASSIGNED' },
    });

    return createdAssignment;
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0],
    action: 'ASSIGN_ASSET',
    entityType: 'ASSET',
    entityId: asset.id,
    afterState: { assetId: asset.id, employeeId: params.employeeId, assetTag: asset.assetTag },
  });

  return assignment;
}

export async function returnAssetFromEmployee(params: {
  tenantId: string;
  assignmentId: string;
  condition?: string;
  notes?: string;
  actor: AuthUser;
}) {
  const assignment = await prisma.assetAssignment.findUnique({
    where: { id: params.assignmentId },
  });

  if (!assignment) throw new Error('Assignment record not found');

  const result = await prisma.$transaction(async (tx) => {
    const updatedAssignment = await tx.assetAssignment.update({
      where: { id: assignment.id },
      data: {
        returnedDate: new Date(),
        condition: params.condition || 'GOOD',
        notes: params.notes,
      },
    });

    await tx.asset.update({
      where: { id: assignment.assetId },
      data: { status: 'AVAILABLE' },
    });

    return updatedAssignment;
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0],
    action: 'RETURN_ASSET',
    entityType: 'ASSET',
    entityId: assignment.assetId,
    afterState: { assignmentId: assignment.id, condition: params.condition },
  });

  return result;
}
