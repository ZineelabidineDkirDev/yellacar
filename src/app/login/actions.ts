"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await db.user.findFirst({ where: { email, isActive: true } });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !ok) redirect("/login?error=1");

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await db.auditLog.create({
    data: { companyId: user.companyId, userId: user.id, action: "login", entity: "User", entityId: user.id },
  });
  await createSession({
    userId: user.id,
    companyId: user.companyId,
    branchId: user.branchId,
    name: user.name,
  });
  redirect("/dashboard");
}

export async function logout() {
  destroySession();
  redirect("/login");
}
