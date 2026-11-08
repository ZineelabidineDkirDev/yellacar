import type { CategoryRate, Season, VehicleCategory } from "@prisma/client";

export const PREP_MINUTES = 60; // délai de préparation entre deux locations

export type RateWithSeason = CategoryRate & { season: Season | null };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function rentalDays(pickup: Date, ret: Date) {
  const ms = ret.getTime() - pickup.getTime();
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

export function dailyRateFor(category: VehicleCategory, rates: RateWithSeason[], date: Date): number {
  const seasonal = rates.find((r) => r.season && r.season.startDate <= date && r.season.endDate >= date);
  if (seasonal) return Number(seasonal.dailyRate);
  const base = rates.find((r) => !r.seasonId);
  return Number(base?.dailyRate ?? category.defaultDailyRate);
}

export type PriceInput = {
  category: VehicleCategory;
  rates: RateWithSeason[];
  pickup: Date;
  ret: Date;
  options?: { price: number; perDay: boolean; qty: number }[];
  protectionPerDay?: number;
  taxRate: number;
  pricesIncludeTax: boolean;
};

export function priceRental(i: PriceInput) {
  const days = rentalDays(i.pickup, i.ret);
  const base = i.rates.find((r) => !r.seasonId);

  let rental = 0;
  if (base?.monthlyRate && days >= 30) rental = (Number(base.monthlyRate) / 30) * days;
  else if (base?.weeklyRate && days >= 7) rental = (Number(base.weeklyRate) / 7) * days;
  else {
    for (let d = 0; d < days; d++) {
      const date = new Date(i.pickup.getTime() + d * 86_400_000);
      rental += dailyRateFor(i.category, i.rates, date);
    }
  }

  const optionsAmount = (i.options ?? []).reduce(
    (sum, o) => sum + o.price * o.qty * (o.perDay ? days : 1),
    0,
  );
  const protectionAmount = (i.protectionPerDay ?? 0) * days;
  const subtotal = round2(rental + optionsAmount + protectionAmount);

  let total: number;
  let taxAmount: number;
  if (i.pricesIncludeTax) {
    total = subtotal;
    taxAmount = round2(total - total / (1 + i.taxRate / 100));
  } else {
    taxAmount = round2((subtotal * i.taxRate) / 100);
    total = round2(subtotal + taxAmount);
  }

  return {
    days,
    rentalAmount: round2(rental),
    optionsAmount: round2(optionsAmount),
    protectionAmount: round2(protectionAmount),
    subtotal,
    taxAmount,
    total,
    avgDailyRate: round2(rental / days),
  };
}
