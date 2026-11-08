"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function createVehicle(formData: FormData) {
  const s = await requireSession();
  const plate = String(formData.get("plate") ?? "").trim().toUpperCase();
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!plate || !brand || !model || !categoryId) return;

  const branchId =
    s.branchId ??
    (await db.branch.findFirst({ where: { companyId: s.companyId, isDefault: true } }))?.id;
  if (!branchId) return;

  const vehicle = await db.vehicle.create({
    data: {
      companyId: s.companyId,
      branchId,
      categoryId,
      plate,
      brand,
      model,
      transmission: formData.get("transmission") === "AUTOMATIC" ? "AUTOMATIC" : "MANUAL",
      fuel: formData.get("fuel") === "PETROL" ? "PETROL" : "DIESEL",
    },
  });
  await db.auditLog.create({
    data: { companyId: s.companyId, userId: s.userId, action: "create", entity: "Vehicle", entityId: vehicle.id },
  });
  revalidatePath("/vehicles");
}
