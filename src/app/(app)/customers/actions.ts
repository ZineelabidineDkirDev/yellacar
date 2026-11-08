"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function createCustomer(formData: FormData) {
  const s = await requireSession();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!firstName || !lastName || !phone) return;

  const customer = await db.customer.create({
    data: {
      companyId: s.companyId,
      firstName,
      lastName,
      phone,
      email: String(formData.get("email") ?? "").trim() || null,
      idType: String(formData.get("idType") ?? "") || null,
      idNumber: String(formData.get("idNumber") ?? "").trim() || null,
      licenseNumber: String(formData.get("licenseNumber") ?? "").trim() || null,
    },
  });
  await db.auditLog.create({
    data: { companyId: s.companyId, userId: s.userId, action: "create", entity: "Customer", entityId: customer.id },
  });
  revalidatePath("/customers");
}
