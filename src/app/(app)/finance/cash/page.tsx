import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { cashTotals, currentCashSession } from "@/lib/finance";
import { dt, money } from "@/lib/format";
import { closeCash, openCash } from "../actions";

export const dynamic = "force-dynamic";

export default async function CashPage() {
  const s = await requireSession();
  const session = await currentCashSession(s.companyId, s.userId);
  const totals = session ? await cashTotals(session.id, Number(session.openingFloat)) : null;
  const history = await db.cashSession.findMany({
    where: { companyId: s.companyId, status: "CLOSED" },
    include: { openedBy: true }, orderBy: { closedAt: "desc" }, take: 30,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Caisse</h1>

      {!session && (
        <form action={openCash} className="card max-w-md space-y-3">
          <h2 className="font-semibold">Ouvrir une caisse</h2>
          <input name="openingFloat" defaultValue="0" placeholder="Fond de caisse" className="input" />
          <input name="notes" placeholder="Notes (optionnel)" className="input" />
          <button className="btn">Ouvrir la caisse</button>
          <p className="text-xs text-gray-500">Les espèces encaissées pendant la session y sont rattachées automatiquement.</p>
        </form>
      )}

      {session && totals && (
        <div className="card max-w-md space-y-2 text-sm">
          <h2 className="font-semibold">Caisse ouverte depuis {dt(session.openedAt)}</h2>
          <p className="flex justify-between"><span>Fond de caisse</span><span>{money(Number(session.openingFloat))}</span></p>
          <p className="flex justify-between"><span>Encaissements espèces</span><span>+ {money(totals.payments)}</span></p>
          <p className="flex justify-between"><span>Remboursements espèces</span><span>− {money(totals.refunds)}</span></p>
          <p className="flex justify-between"><span>Cautions reçues</span><span>+ {money(totals.depositsIn)}</span></p>
          <p className="flex justify-between"><span>Cautions rendues</span><span>− {money(totals.depositsOut)}</span></p>
          <p className="flex justify-between"><span>Dépenses espèces</span><span>− {money(totals.expenses)}</span></p>
          <p className="flex justify-between border-t pt-2 text-base font-bold"><span>Espèces attendues</span><span>{money(totals.expected)}</span></p>
          <form action={closeCash} className="space-y-2 border-t pt-3">
            <input name="countedCash" placeholder="Espèces comptées" required className="input" />
            <button className="btn">Clôturer la caisse</button>
          </form>
        </div>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Historique</h2>
        <div className="card divide-y divide-gray-100 p-0">
          {history.map((h) => {
            const diff = Number(h.difference ?? 0);
            return (
              <div key={h.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <p className="font-medium">{h.openedBy.name}</p>
                  <p className="text-xs text-gray-500">{dt(h.openedAt)} → {h.closedAt ? dt(h.closedAt) : ""}</p>
                </div>
                <div className="text-right">
                  <p>{money(Number(h.countedCash ?? 0))}</p>
                  <p className={`text-xs ${Math.abs(diff) > 0.005 ? "text-red-600" : "text-gray-500"}`}>écart {money(diff)}</p>
                </div>
              </div>
            );
          })}
          {history.length === 0 && <p className="p-3 text-sm text-gray-500">Aucune session clôturée.</p>}
        </div>
      </section>
    </div>
  );
}
