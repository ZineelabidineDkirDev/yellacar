"use client";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn print:hidden">
      Imprimer / Enregistrer en PDF
    </button>
  );
}
