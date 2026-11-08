import Link from "next/link";

const TABS = [
  ["/finance", "Vue d’ensemble"],
  ["/finance/payments", "Paiements"],
  ["/finance/cash", "Caisse"],
  ["/finance/deposits", "Cautions"],
  ["/finance/invoices", "Factures"],
  ["/finance/expenses", "Dépenses"],
  ["/finance/suppliers", "Fournisseurs"],
];

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 text-sm">
        {TABS.map(([href, label]) => (
          <Link key={href} href={href} className="rounded-full border border-gray-300 bg-white px-3 py-1 hover:border-brand">
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
