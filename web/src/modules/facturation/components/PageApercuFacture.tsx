import { Link, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Button } from "@/components/ui/button";
import { formatDateFr } from "@/lib/dates";
import { DocumentImprimable } from "@/modules/documents/components/DocumentImprimable";
import { depuisBase } from "@/modules/documents/domain/lignes";
import { estAvoir } from "@/modules/documents/domain/totaux";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { useIdentite } from "@/modules/societes/hooks/useIdentite";
import { libelleDocument } from "../domain/avoir";
import { mentionsLegales } from "../domain/mentions";
import { useFacture } from "../hooks/useFactures";

const LIBELLE_MODE: Record<string, string> = { virement: "virement", cheque: "chèque", prelevement: "prélèvement", carte: "carte bancaire", especes: "espèces" };

/** La facture imprimable : l'émetteur FIGÉ l'emporte sur les réglages du jour (tél. et e-mail restent courants). */
export function PageApercuFacture() {
  const { id } = useParams();
  const facture = useFacture(id);
  const identite = useIdentite();
  if (facture.isPending || identite.isPending) return <Chargement />;
  if (facture.isError) return <Erreur erreur={facture.error} reessayer={() => void facture.refetch()} />;
  if (identite.isError) return <Erreur erreur={identite.error} reessayer={() => void identite.refetch()} />;
  const f = facture.data;
  const s = identite.data;
  const avoir = estAvoir(f.type_document);

  return (
    <GardeSociete societeId={f.societe_id} retour="/factures">
      <div className="mb-4 flex gap-2 print:hidden">
        <Button onClick={() => window.print()}>Imprimer / enregistrer en PDF</Button>
        <Button variant="ghost" asChild><Link to={`/factures/${f.id}`}>Retour à la facture</Link></Button>
      </div>
      {!f.numero && <p className="mb-2 text-sm font-semibold text-destructive print:text-black">BROUILLON — sans valeur de facture tant qu'elle n'est pas émise.</p>}
      <DocumentImprimable
        titre={libelleDocument(f.type_document)}
        numero={f.numero ?? "—"}
        date={f.date}
        emetteur={{
          nom: f.emetteur_nom ?? s.raison_sociale_legale ?? s.nom,
          lignes: [
            f.emetteur_adresse ?? s.adresse,
            [f.emetteur_code_postal ?? s.code_postal, f.emetteur_ville ?? s.ville].filter(Boolean).join(" "),
            s.telephone,
            s.email,
            (f.emetteur_siret ?? s.siret) && `SIRET ${f.emetteur_siret ?? s.siret}`,
            (f.emetteur_tva_intracom ?? s.tva_intracom) && `TVA ${f.emetteur_tva_intracom ?? s.tva_intracom}`,
          ],
        }}
        destinataire={{ nom: f.client_nom, lignes: [f.interlocuteur && `À l'attention de ${f.interlocuteur}`, f.adresse] }}
        meta={[
          ...(f.echeance && !avoir ? [{ libelle: "Échéance :", valeur: formatDateFr(f.echeance) }] : []),
          ...(f.ref_bon_commande_client ? [{ libelle: "Votre commande :", valeur: f.ref_bon_commande_client }] : []),
          ...(f.ref_marche ? [{ libelle: "Marché :", valeur: f.ref_marche }] : []),
          ...(f.motif_rectification ? [{ libelle: "Motif :", valeur: f.motif_rectification }] : []),
        ]}
        lignes={f.lignes.map(depuisBase)}
        remise={String(f.remise_pourcentage)}
        signe={avoir ? -1 : 1}
        deductions={avoir ? undefined : { acomptes: f.acomptes_deduits, retenuePct: f.retenue_garantie_pourcentage }}
        pied={
          <footer className="flex flex-col gap-2 text-xs">
            {!avoir && (
              <p>
                {f.conditions_reglement ?? ""}
                {f.mode_paiement ? ` — règlement par ${LIBELLE_MODE[f.mode_paiement] ?? f.mode_paiement}` : ""}
                {(f.emetteur_iban ?? s.iban) && ` — IBAN ${f.emetteur_iban ?? s.iban}`}
              </p>
            )}
            {/* Mentions légales : sur la facture seulement (jamais sur un devis). */}
            {mentionsLegales(s).map((m) => <p key={m}>{m}</p>)}
          </footer>
        }
      />
    </GardeSociete>
  );
}
