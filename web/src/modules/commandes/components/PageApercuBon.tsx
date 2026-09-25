import { Link, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Button } from "@/components/ui/button";
import { useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import { DocumentImprimable } from "@/modules/documents/components/DocumentImprimable";
import { depuisBase } from "@/modules/documents/domain/lignes";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { useIdentite } from "@/modules/societes/hooks/useIdentite";
import { versLigneBase } from "../domain/bon";
import { metaImpressionBon } from "../domain/impression";
import { useBon } from "../hooks/useBons";
import { LignesSansPrix } from "./LignesSansPrix";

/** Le bon imprimable (Ctrl+P → PDF), avec la référence du client toujours affichée (BC-80). */
export function PageApercuBon() {
  const { id } = useParams();
  const bon = useBon(id);
  const identite = useIdentite();
  const prix = useVoitLesPrix();
  if (bon.isPending || identite.isPending) return <Chargement />;
  if (bon.isError) return <Erreur erreur={bon.error} reessayer={() => void bon.refetch()} />;
  if (identite.isError) return <Erreur erreur={identite.error} reessayer={() => void identite.refetch()} />;
  const b = bon.data;
  const s = identite.data;
  const lieu = [b.adresse, b.code_postal, b.ville].filter(Boolean).join(" ");
  return (
    <GardeSociete societeId={b.societe_id} retour="/commandes">
      <div className="mb-4 flex gap-2 print:hidden">
        <Button onClick={() => window.print()}>Imprimer / enregistrer en PDF</Button>
        <Button variant="ghost" asChild><Link to={`/commandes/${b.id}`}>Retour au bon</Link></Button>
      </div>
      {prix ? (
        <DocumentImprimable
          titre={b.bon_commande_parent_id ? "SAV" : "BON DE COMMANDE"}
          numero={b.numero_interne ?? "—"}
          date={b.date_reception ?? b.date}
          emetteur={{ nom: s.raison_sociale_legale || s.nom, lignes: [s.adresse, [s.code_postal, s.ville].filter(Boolean).join(" "), s.telephone, s.email, s.siret && `SIRET ${s.siret}`] }}
          destinataire={{ nom: b.client_nom, lignes: [b.interlocuteur && `À l'attention de ${b.interlocuteur}`] }}
          meta={[...metaImpressionBon(b), ...(lieu ? [{ libelle: "Lieu :", valeur: lieu }] : [])]}
          lignes={b.lignes.map(versLigneBase).map(depuisBase)}
          remise="0"
        />
      ) : (
        // Sans les prix, le document imprimé ne montre que ce qu'il y a à faire.
        <LignesSansPrix lignes={b.lignes} />
      )}
    </GardeSociete>
  );
}
