import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const company = await db.company.create({
    data: { name: "YellaCar Démo", city: "Rabat", currency: "MAD" },
  });
  const branch = await db.branch.create({
    data: { companyId: company.id, name: "Agence principale", city: "Rabat", isDefault: true },
  });
  const role = await db.role.create({
    data: {
      companyId: company.id,
      key: "company_admin",
      name: "Administrateur société",
      isSystem: true,
      permissions: ["*"],
    },
  });
  const user = await db.user.create({
    data: {
      companyId: company.id,
      branchId: branch.id,
      name: "Admin",
      email: "admin@yellacar.test",
      passwordHash: await bcrypt.hash("ChangeMe123!", 10),
    },
  });
  await db.userRole.create({ data: { userId: user.id, roleId: role.id } });

  const cats = [
    ["ECO", "Économique", 250],
    ["COM", "Compact", 300],
    ["SUV", "SUV", 450],
    ["PRE", "Premium", 700],
  ] as const;
  for (const [code, name, rate] of cats) {
    await db.vehicleCategory.create({
      data: { companyId: company.id, code, name, defaultDailyRate: rate, includedKmPerDay: 250 },
    });
  }

  const sequences = [
    ["reservation", "RES-{YYYY}-{SEQ:5}"],
    ["quote", "DEV-{YYYY}-{SEQ:5}"],
    ["contract", "CTR-{YYYY}-{SEQ:6}"],
    ["invoice", "FAC-{YYYY}-{SEQ:5}"],
  ];
  for (const [type, pattern] of sequences) {
    await db.documentSequence.create({ data: { companyId: company.id, type, pattern } });
  }

  console.log("Seed OK → admin@yellacar.test / ChangeMe123!");
}

main().finally(() => db.$disconnect());
