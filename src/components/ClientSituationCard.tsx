"use client";

type Situation = {
  totalFacture: number;
  totalPaye: number;
  soldeDu: number;
  facturesImpayees: number;
  nbVentes: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " F";
}

export function ClientSituationCard({ situation }: { situation: Situation }) {
  return (
    <div className="card bg-slate-50">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Situation financière</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-500">Facturé</p>
          <p className="font-semibold text-slate-900">{fmt(situation.totalFacture)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Payé</p>
          <p className="font-semibold text-green-700">{fmt(situation.totalPaye)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Solde dû</p>
          <p className="font-semibold text-amber-700">{fmt(situation.soldeDu)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Factures impayées</p>
          <p className="font-medium">{situation.facturesImpayees}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Ventes plaques</p>
          <p className="font-medium">{situation.nbVentes}</p>
        </div>
      </div>
    </div>
  );
}
