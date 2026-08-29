import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ROLE_LABELS, AppRole } from "@/lib/roles";
import { formatFcfa, formatNombre } from "@/lib/money";
import { getMetierSettings } from "@/lib/metier";
import { filtresExpirationFigee } from "@/lib/validite";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user.role as AppRole | undefined;
  const userId = session?.user.id ? Number(session.user.id) : 0;

  if (role === "AGENT_CT") {
    const [total, authentiques, recentes, commissions] = await Promise.all([
      prisma.verification.count({ where: { agentId: userId } }),
      prisma.verification.count({ where: { agentId: userId, resultat: "AUTHENTIQUE" } }),
      prisma.verification.findMany({
        where: { agentId: userId },
        orderBy: { horodatage: "desc" },
        take: 8,
      }),
      prisma.verification.aggregate({
        where: { agentId: userId, resultat: "AUTHENTIQUE" },
        _sum: { commissionMontant: true },
      }),
    ]);
    const due = await prisma.verification.aggregate({
      where: { agentId: userId, resultat: "AUTHENTIQUE", paiementCommissionId: null },
      _sum: { commissionMontant: true },
    });

    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <h1 className="text-2xl font-bold">Contrôle technique</h1>
          <p className="mb-8 text-slate-500">
            Bienvenue, {session?.user.identifiant} — {ROLE_LABELS.AGENT_CT}
          </p>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card">
              <p className="text-sm text-slate-500">Vérifications</p>
              <p className="text-3xl font-bold">{formatNombre(total)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-500">Authentiques</p>
              <p className="text-3xl font-bold text-green-700">{formatNombre(authentiques)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-500">Commission à percevoir</p>
              <p className="text-3xl font-bold text-amber-700">{formatFcfa(due._sum.commissionMontant ?? 0)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-500">Commissions générées</p>
              <p className="text-3xl font-bold">{formatFcfa(commissions._sum.commissionMontant ?? 0)}</p>
            </div>
          </div>
          <Link href="/controle/verification" className="btn-primary mb-8 mr-3 inline-flex">
            Vérifier une plaque
          </Link>
          <Link href="/controle/commissions" className="btn-secondary mb-8 mr-3 inline-flex">
            Mes commissions
          </Link>
          <Link href="/rapports" className="btn-secondary mb-8 mr-3 inline-flex">
            Faire un rapport
          </Link>
          <Link href="/performances" className="btn-secondary mb-8 inline-flex">
            Performances
          </Link>
          <div className="card">
            <h2 className="mb-4 font-semibold">Derniers contrôles</h2>
            {recentes.map((v) => (
              <div key={v.id} className="flex justify-between border-b border-slate-100 py-2 text-sm">
                <span className="font-mono text-xs">{v.numeroSaisi}</span>
                <span>{v.resultat}</span>
              </div>
            ))}
            {recentes.length === 0 && <p className="text-sm text-slate-400">Aucun contrôle.</p>}
          </div>
        </main>
      </div>
    );
  }

  if (role === "COMMERCIAL") {
    const [stock, vendues, commissions, due] = await Promise.all([
      prisma.plaque.count({ where: { commercialId: userId, statut: "AFFECTEE" } }),
      prisma.vente.count({ where: { vendeurId: userId } }),
      prisma.vente.aggregate({
        where: { vendeurId: userId },
        _sum: { commissionMontant: true, prixVente: true },
      }),
      prisma.vente.aggregate({
        where: { vendeurId: userId, paiementCommissionId: null },
        _sum: { commissionMontant: true },
      }),
    ]);

    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <h1 className="text-2xl font-bold">Espace commercial</h1>
          <p className="mb-8 text-slate-500">
            Bienvenue, {session?.user.identifiant} — {ROLE_LABELS.COMMERCIAL}
          </p>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card">
              <p className="text-sm text-slate-500">Stock à vendre</p>
              <p className="text-3xl font-bold text-amber-600">{formatNombre(stock)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-500">Ventes</p>
              <p className="text-3xl font-bold text-green-700">{formatNombre(vendues)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-500">Commission à percevoir</p>
              <p className="text-3xl font-bold text-amber-700">{formatFcfa(due._sum.commissionMontant ?? 0)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-500">Commissions générées</p>
              <p className="text-3xl font-bold">{formatFcfa(commissions._sum.commissionMontant ?? 0)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/ventes/nouvelle" className="btn-primary">
              Enregistrer une vente
            </Link>
            <Link href="/commercial/stock" className="btn-secondary">
              Mon stock
            </Link>
            <Link href="/ventes/commissions" className="btn-secondary">
              Ma commission
            </Link>
            <Link href="/rapports" className="btn-secondary">
              Faire un rapport
            </Link>
            <Link href="/performances" className="btn-secondary">
              Performances
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const settings = await getMetierSettings();
  const filtres = filtresExpirationFigee(settings.plaqueAlerteExpirationJours);

  const [total, enStock, affectees, vendues, ventesDirectes, expirees, expireBientot, commissionsVentesDue, commissionsControlesDue] =
    await Promise.all([
    prisma.plaque.count(),
    prisma.plaque.count({ where: { statut: "EN_STOCK" } }),
    prisma.plaque.count({ where: { statut: "AFFECTEE" } }),
    prisma.plaque.count({ where: { statut: "VENDUE" } }),
    prisma.vente.count({ where: { canal: "DIRECTE" } }),
    prisma.vente.count({ where: filtres.expirees }),
    prisma.vente.count({ where: filtres.expireBientot }),
    prisma.vente.aggregate({
      where: { paiementCommissionId: null, commissionMontant: { gt: 0 } },
      _sum: { commissionMontant: true },
    }),
    prisma.verification.aggregate({
      where: { paiementCommissionId: null, resultat: "AUTHENTIQUE", commissionMontant: { gt: 0 } },
      _sum: { commissionMontant: true },
    }),
  ]);

  const recentes = await prisma.plaque.findMany({
    take: 5,
    orderBy: { dateFabrication: "desc" },
    include: { produit: { select: { libelle: true } } },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
          <p className="text-slate-500">
            Bienvenue, {session?.user.identifiant} — {role ? ROLE_LABELS[role] : ""}
          </p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <p className="text-sm text-slate-500">Total plaques</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{formatNombre(total)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Stock production</p>
            <p className="mt-1 text-3xl font-bold text-amber-600">{formatNombre(enStock)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Chez les vendeurs</p>
            <p className="mt-1 text-3xl font-bold text-blue-700">{formatNombre(affectees)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Vendues</p>
            <p className="mt-1 text-3xl font-bold text-green-600">{formatNombre(vendues)}</p>
            {role === "ADMINISTRATEUR" && (
              <p className="mt-1 text-xs text-slate-400">{formatNombre(ventesDirectes)} vente(s) directe(s)</p>
            )}
          </div>
        </div>

        {role === "ADMINISTRATEUR" && (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/admin/expirations" className="card block hover:ring-2 hover:ring-red-200">
              <p className="text-sm text-slate-500">Plaques expirées</p>
              <p className="mt-1 text-3xl font-bold text-red-700">{formatNombre(expirees)}</p>
              <p className="mt-1 text-xs text-slate-400">Validité {settings.plaqueValiditeMois} mois après achat</p>
            </Link>
            <Link href="/admin/expirations" className="card block hover:ring-2 hover:ring-amber-200">
              <p className="text-sm text-slate-500">Expiration proche</p>
              <p className="mt-1 text-3xl font-bold text-amber-600">{formatNombre(expireBientot)}</p>
            </Link>
            <Link href="/admin/paiements-commissions" className="card block hover:ring-2 hover:ring-amber-200">
              <p className="text-sm text-slate-500">Commissions commerciaux dues</p>
              <p className="mt-1 text-3xl font-bold text-amber-700">
                {formatFcfa(commissionsVentesDue._sum.commissionMontant ?? 0)}
              </p>
            </Link>
            <Link href="/admin/paiements-commissions" className="card block hover:ring-2 hover:ring-amber-200">
              <p className="text-sm text-slate-500">Commissions contrôleurs dues</p>
              <p className="mt-1 text-3xl font-bold text-amber-700">
                {formatFcfa(commissionsControlesDue._sum.commissionMontant ?? 0)}
              </p>
            </Link>
          </div>
        )}

        <div className="mb-8 flex flex-wrap gap-3">
          <Link href="/operator" className="btn-primary">
            Produire des plaques
          </Link>
          <Link href="/production/affectation" className="btn-secondary">
            Mettre à disposition
          </Link>
          <Link href="/catalogue" className="btn-secondary">
            Catalogue
          </Link>
          {(role === "ADMINISTRATEUR" || role === "OPERATEUR") && (
            <Link href="/carte" className="btn-secondary">
              Carte des sites
            </Link>
          )}
          {role === "ADMINISTRATEUR" && (
            <>
              <Link href="/admin/utilisateurs" className="btn-secondary">
                Utilisateurs
              </Link>
              <Link href="/performances" className="btn-secondary">
                Performances
              </Link>
              <Link href="/ventes/nouvelle?canal=DIRECTE" className="btn-secondary">
                Vente directe
              </Link>
              <Link href="/admin/paiements-commissions" className="btn-secondary">
                Payer les commissions
              </Link>
              <Link href="/admin/expirations" className="btn-secondary">
                Plaques expirées
              </Link>
              <Link href="/rapports" className="btn-secondary">
                Rapports
              </Link>
            </>
          )}
        </div>

        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Dernières plaques</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-3 pr-4 font-medium">Numéro de série</th>
                <th className="pb-3 pr-4 font-medium">Produit</th>
                <th className="pb-3 pr-4 font-medium">Date</th>
                <th className="pb-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {recentes.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-mono text-xs">{p.numeroSerie}</td>
                  <td className="py-3 pr-4">{p.produit?.libelle ?? p.typeProduit.replace("_", " ")}</td>
                  <td className="py-3 pr-4">{p.dateFabrication.toLocaleDateString("fr-FR")}</td>
                  <td className="py-3">
                    <span
                      className={`badge ${
                        p.statut === "VENDUE" ? "badge-success" : p.statut === "AFFECTEE" ? "badge-info" : "badge-warning"
                      }`}
                    >
                      {p.statut.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
