"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

const num = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null;
};

export async function saveRate(fd: FormData) {
  const s = await requireSession();
  const categoryId = String(fd.get("categoryId") ?? "");
  const seasonId = String(fd.get("seasonId") ?? "") || null;
  const daily = num(fd.get("dailyRate"));
  if (!categoryId || daily === null) return;

  const cat = await db.vehicleCategory.findFirst({ where: { id: categoryId, companyId: s.companyId } });
  if (!cat) return;
  if (seasonId && !(await db.season.findFirst({ where: { id: seasonId, companyId: s.companyId } }))) return;

  const data = { dailyRate: daily, weeklyRate: num(fd.get("weeklyRate")), monthlyRate: num(fd.get("monthlyRate")) };
  const existing = await db.categoryRate.findFirst({ where: { categoryId, seasonId } });
  if (existing) await db.categoryRate.update({ where: { id: existing.id }, data });
  else await db.categoryRate.create({ data: { categoryId, seasonId, ...data } });
  revalidatePath("/pricing");
}

export async function createSeason(fd: FormData) {
  const s = await requireSession();
  const name = String(fd.get("name") ?? "").trim();
  const start = new Date(String(fd.get("startDate") ?? ""));
  const end = new Date(String(fd.get("endDate") ?? ""));
  if (!name || isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return;
  end.setHours(23, 59, 59, 999);
  await db.season.create({ data: { companyId: s.companyId, name, startDate: start, endDate: end } });
  revalidatePath("/pricing");
}

export async function deleteSeason(fd: FormData) {
  const s = await requireSession();
  const id = String(fd.get("id") ?? "");
  await db.season.deleteMany({ where: { id, companyId: s.companyId } });
  revalidatePath("/pricing");
}

export async function createOption(fd: FormData) {
  const s = await requireSession();
  const name = String(fd.get("name") ?? "").trim();
  const price = num(fd.get("price"));
  if (!name || price === null) return;
  const key = name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "option";
  await db.rentalOption.upsert({
    where: { companyId_key: { companyId: s.companyId, key } },
    update: { name, price, priceType: fd.get("priceType") === "FLAT" ? "FLAT" : "PER_DAY" },
    create: {
      companyId: s.companyId, key, name, price,
      priceType: fd.get("priceType") === "FLAT" ? "FLAT" : "PER_DAY",
      maxQty: Math.max(1, Number(fd.get("maxQty") ?? 1) || 1),
    },
  });
  revalidatePath("/pricing");
}

export async function createProtection(fd: FormData) {
  const s = await requireSession();
  const name = String(fd.get("name") ?? "").trim();
  const pricePerDay = num(fd.get("pricePerDay"));
  const deductible = num(fd.get("deductible"));
  if (!name || pricePerDay === null || deductible === null) return;
  const key = name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "protection";
  await db.protection.upsert({
    where: { companyId_key: { companyId: s.companyId, key } },
    update: { name, pricePerDay, deductible },
    create: { companyId: s.companyId, key, name, pricePerDay, deductible },
  });
  revalidatePath("/pricing");
}

export async function seedDefaults() {
  const s = await requireSession();
  const c = s.companyId;
  const opts = [
    ["additional_driver", "Conducteur additionnel", 30, 2],
    ["baby_seat", "Siège bébé", 30, 3],
    ["booster_seat", "Réhausseur", 20, 3],
    ["gps", "GPS", 40, 1],
  ] as const;
  for (const [key, name, price, maxQty] of opts) {
    await db.rentalOption.upsert({
      where: { companyId_key: { companyId: c, key } }, update: {},
      create: { companyId: c, key, name, price, maxQty },
    });
  }
  const prots = [
    ["basic", "Basique (incluse)", 0, 5000, true],
    ["medium", "Protection moyenne", 60, 2000, false],
    ["full", "Protection complète", 120, 0, false],
  ] as const;
  for (const [key, name, pricePerDay, deductible, isDefault] of prots) {
    await db.protection.upsert({
      where: { companyId_key: { companyId: c, key } }, update: {},
      create: { companyId: c, key, name, pricePerDay, deductible, isDefault },
    });
  }
  revalidatePath("/pricing");
}
