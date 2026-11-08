export const money = (n: number | string | { toString(): string }, currency = "MAD") =>
  `${Number(n.toString()).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

export const dt = (d: Date) =>
  d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

export const dateOnly = (d: Date) => d.toLocaleDateString("fr-FR", { dateStyle: "medium" });

export const STATUS_LABEL: Record<string, string> = {
  QUOTE: "Devis",
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  IN_PROGRESS: "En location",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
  NO_SHOW: "Non présenté",
};

export const STATUS_COLOR: Record<string, string> = {
  QUOTE: "bg-gray-200 text-gray-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-green-100 text-green-800",
  COMPLETED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-700",
  NO_SHOW: "bg-red-100 text-red-700",
};
