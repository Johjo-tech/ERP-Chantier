import { useState } from "react";
import { Link, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDateFr } from "@/lib/dates";
import { useIdentite } from "@/modules/societes/hooks/useIdentite";
import type { RapportComplet } from "../api/rapports";
import { CONTROLES_PAR_METIER, courrielDuRapport, libelleMetier, signatureClientDemandee } from "../domain/rapport";
import { useCourrielClient, useRapport } from "../hooks/useRapports";
import { ActionsTransformation } from "./ActionsTransformation";

function Envoi({ complet }: { complet: RapportComplet }) {
  const r = complet.rapport;
  const courriel = useCourrielClient(r.client_id);
  const [copie, setCopie] = useState<string | null>(null);
  const { objet, corps } = courrielDuRapport(r);
  const dest = courriel.data ?? "";
  return (
    <>
      <Button asChild variant="outline"><a href={`mailto:${dest}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`}>Envoyer par e-mail</a></Button>
      <Button
        variant="ghost"
        onClick={() =>
          void navigator.clipboard.writeText(`À : ${dest}\nObjet : ${objet}\n\n${corps}`).then(
            () => setCopie("Texte copié — collez-le dans votre messagerie, et joignez le PDF imprimé."),
            (e: unknown) => {
              console.warn("Copie impossible", e);
              setCopie("Impossible de copier automatiquement : sélectionnez le texte à la main.");
            }
          )
        }
      >
        Copier le texte
      </Button>
      {copie && <Alert className="w-full">{copie}</Alert>}
    </>
  );
}

/** Le rapport tel qu'il part chez le client : imprimable (PDF par le navigateur) et envoyable (PLN-20). */
export function PageApercuRapport() {
  const { id } = useParams();
  const rapport = useRapport(id);
  const identite = useIdentite();
  if (rapport.isPending) return <Chargement />;
  if (rapport.isError) return <Erreur erreur={rapport.error} reessayer={() => void rapport.refetch()} />;
  const complet = rapport.data;
  const r = complet.rapport;
  const points = r.metier ? CONTROLES_PAR_METIER[r.metier].filter((p) => complet.controles[p.cle]) : [];
  const lieu = [r.adresse_locataire || r.adresse, [r.code_postal, r.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Button asChild variant="ghost"><Link to="/rapports">← Rapports</Link></Button>
        <Button onClick={() => window.print()}>Imprimer / PDF</Button>
        <Envoi complet={complet} />
        {/* La voie de la carte, relue par son id (D-CLI-09) ; lié à un bon, le rapport se facture par le bon (PLN-20). */}
        <ActionsTransformation rapport={r.id} bonId={r.bon_commande_id} taille="default" />
      </div>
      <article className="mx-auto max-w-3xl rounded-md border bg-white p-6 text-sm text-black print:border-0 print:p-0">
        <header className="mb-4 flex justify-between gap-4">
          <div>
            <p className="font-semibold">{identite.data?.raison_sociale_legale || identite.data?.nom}</p>
            <p>{identite.data?.adresse}</p>
            <p>{[identite.data?.code_postal, identite.data?.ville].filter(Boolean).join(" ")}</p>
          </div>
          <div className="text-right">
            <h1 className="text-lg font-bold">Rapport d'intervention</h1>
            <p className="font-mono">{r.numero ?? "—"}</p>
            <p>{formatDateFr(r.date)}{r.heure ? ` à ${r.heure}` : ""}</p>
          </div>
        </header>
        <section className="mb-3">
          <p><b>Client :</b> {r.client_nom}{r.interlocuteur ? ` — ${r.interlocuteur}` : ""}</p>
          {lieu && <p><b>Lieu :</b> {lieu}</p>}
          {r.logement_statut === "occupé" && r.occupant && <p><b>Locataire :</b> {r.occupant}</p>}
          {r.logement_statut === "vacant" && r.ancien_locataire && <p><b>Ancien locataire :</b> {r.ancien_locataire}</p>}
          {r.logement_statut === "commune" && r.precision_commune && <p><b>Partie commune :</b> {r.precision_commune}</p>}
          {(r.etage || r.numero_logement) && <p>{[r.etage && `Étage ${r.etage}`, r.numero_logement && `N° ${r.numero_logement}`].filter(Boolean).join(" · ")}</p>}
          {r.metier && <p><b>Type d'intervention :</b> {libelleMetier(r.metier)}</p>}
          {r.conducteur && <p><b>Conducteur de travaux :</b> {r.conducteur}</p>}
        </section>
        {points.length > 0 && (
          <section className="mb-3">
            <h2 className="font-semibold">Contrôles réalisés</h2>
            <ul className="ml-4 list-disc">{points.map((p) => <li key={p.cle}>{p.libelle}{p.cle === "autre" && complet.precisionAutre ? ` : ${complet.precisionAutre}` : ""}</li>)}</ul>
          </section>
        )}
        <section className="mb-3">
          <h2 className="font-semibold">Constatations</h2>
          <p className="whitespace-pre-wrap">{r.constatations || "—"}</p>
        </section>
        <section className="mb-3">
          <h2 className="font-semibold">Préconisations</h2>
          <p className="whitespace-pre-wrap">{r.preconisations || "—"}</p>
        </section>
        {complet.photos.length > 0 && (
          <section className="mb-3 grid grid-cols-3 gap-2">
            {complet.photos.map((p, i) => (
              <figure key={p.id}>
                {p.url && <img src={p.url} alt={`Photo ${i + 1}`} className="w-full rounded border" />}
                {p.categorie && <figcaption className="text-xs">{p.categorie === "constatation" ? "Constatation" : "Préconisation"}</figcaption>}
              </figure>
            ))}
          </section>
        )}
        <section className="grid grid-cols-2 gap-4">
          {signatureClientDemandee(r.logement_statut) && (
            <div><p className="font-semibold">Signature client</p>{complet.signatureClient ? <img src={complet.signatureClient} alt="Signature du client" className="h-24" /> : <p className="h-24 border-b" />}</div>
          )}
          <div><p className="font-semibold">Signature du technicien</p>{complet.signatureTechnicien ? <img src={complet.signatureTechnicien} alt="Signature du technicien" className="h-24" /> : <p className="h-24 border-b" />}</div>
        </section>
      </article>
    </>
  );
}
