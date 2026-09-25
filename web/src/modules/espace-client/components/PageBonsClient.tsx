import { useState } from "react";
import { Link } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDateFr } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { chercherBonsClient, statutClientBon, tentativesDe, trierBonsClient, TUILES, type CouleurBon } from "../domain/bons";
import { useBonsClient } from "../hooks/useEspaceClient";

const VARIANTE: Record<CouleurBon, BadgeVariant> = { rouge: "danger", orange: "alerte", jaune: "alerte", vert: "succes" };
const BORD: Record<CouleurBon, string> = { rouge: "border-l-red-600", orange: "border-l-orange-600", jaune: "border-l-yellow-500", vert: "border-l-green-600" };

/**
 * « Suivi de vos bons de commande » (ESP-01) : quatre tuiles qui comptent et
 * filtrent, des cartes triées de ce qui attend à ce qui est fait. Rien
 * d'interne : ni montant, ni note, ni conducteur — la vue ne les porte pas.
 */
export function PageBonsClient() {
  const bons = useBonsClient();
  const [recherche, setRecherche] = useState("");
  const [couleur, setCouleur] = useState<CouleurBon | "">("");
  if (bons.isPending) return <Chargement />;
  if (bons.isError) return <Erreur erreur={bons.error} reessayer={() => void bons.refetch()} />;
  const trouves = chercherBonsClient(bons.data, recherche);
  const compte = (c: CouleurBon) => trouves.filter((b) => statutClientBon(b).cle === c).length;
  const visibles = trierBonsClient(couleur ? trouves.filter((b) => statutClientBon(b).cle === couleur) : trouves);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Suivi de vos bons de commande</h1>
        <Link className="text-sm text-primary hover:underline" to="/espace-client">Vos documents</Link>
      </div>
      <label htmlFor="recherche-bons-client" className="sr-only">Rechercher un bon</label>
      <Input id="recherche-bons-client" type="search" placeholder="N° de bon, adresse, n° de logement, locataire, nature des travaux…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      <div role="group" aria-label="Avancement" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TUILES.map((t) => (
          <button key={t.cle} type="button" aria-pressed={couleur === t.cle} onClick={() => setCouleur(couleur === t.cle ? "" : t.cle)} className={cn("flex items-center justify-between rounded-md border border-l-4 p-3 text-sm", BORD[t.cle], couleur === t.cle && "bg-muted font-semibold")}>
            {t.libelle}
            <b>{compte(t.cle)}</b>
          </button>
        ))}
      </div>
      {visibles.length === 0 ? (
        <Vide message={`Aucun bon de commande${couleur ? " dans cette catégorie" : ""}.`} />
      ) : (
        <ul aria-label="Bons de commande" className="flex flex-col gap-2">
          {visibles.map((b) => {
            const st = statutClientBon(b);
            const tentatives = tentativesDe(b);
            return (
              <li key={b.id} className={cn("rounded-md border border-l-4 p-3 text-sm", BORD[st.cle])}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span>
                    <span className="font-medium">BC n° {b.numero_bc || "—"}</span>
                    <span className="block text-muted-foreground">{[[b.adresse_locataire || b.adresse, [b.code_postal, b.ville].filter(Boolean).join(" ")].filter(Boolean).join(", "), b.numero_logement && `N° ${b.numero_logement}`].filter(Boolean).join(" · ")}</span>
                    {b.occupant && <span className="block text-muted-foreground">Locataire : {b.occupant}</span>}
                    {b.interlocuteur && <span className="block text-muted-foreground">Interlocuteur : {b.interlocuteur}</span>}
                  </span>
                  <Badge variant={VARIANTE[st.cle]}>{st.libelle}</Badge>
                </div>
                {b.piece_a_commander && b.piece_a_commander_detail && <p className="mt-1">Pièce : {b.piece_a_commander_detail}{b.piece_date_commande ? ` — commandée le ${formatDateFr(b.piece_date_commande)}` : ""}</p>}
                {b.date_planification_initiale && b.piece_a_commander && <p>1ʳᵉ intervention le {formatDateFr(b.date_planification_initiale)} — reportée en attente de la pièce</p>}
                {tentatives.length > 0 && <p>Locataire injoignable — nos tentatives : {tentatives.map((t) => `${t.type === "appel" ? "Appel" : "SMS"} ${formatDateFr(t.date)}${t.heure ? ` ${t.heure}` : ""}`).join(", ")}</p>}
                {b.rappel_date && !b.date_intervention_terminee && <p>Prochain contact prévu le {formatDateFr(b.rappel_date)}</p>}
                {b.date_intervention_terminee && <p className="font-semibold text-green-700">Réalisé le {formatDateFr(b.date_intervention_terminee)}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
