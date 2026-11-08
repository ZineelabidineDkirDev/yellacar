import type { Prisma } from "@prisma/client";

const DEFAULTS: Record<string, string> = {
  reservation: "RES-{YYYY}-{SEQ:5}",
  quote: "DEV-{YYYY}-{SEQ:5}",
  contract: "CTR-{YYYY}-{SEQ:6}",
  invoice: "FAC-{YYYY}-{SEQ:5}",
  receipt: "REC-{YYYY}-{SEQ:5}",
};

export async function nextNumber(tx: Prisma.TransactionClient, companyId: string, type: string) {
  const year = new Date().getFullYear();
  let seq = await tx.documentSequence.findUnique({ where: { companyId_type: { companyId, type } } });
  if (!seq) {
    seq = await tx.documentSequence.create({
      data: { companyId, type, pattern: DEFAULTS[type] ?? `${type.toUpperCase()}-{YYYY}-{SEQ:5}` },
    });
  }
  const reset = seq.resetYearly && seq.lastYear !== year;
  const updated = await tx.documentSequence.update({
    where: { id: seq.id },
    data: reset ? { current: 1, lastYear: year } : { current: { increment: 1 }, lastYear: year },
  });
  return updated.pattern
    .replace("{YYYY}", String(year))
    .replace("{YY}", String(year).slice(-2))
    .replace(/\{SEQ:(\d+)\}/, (_m, n) => String(updated.current).padStart(Number(n), "0"));
}
