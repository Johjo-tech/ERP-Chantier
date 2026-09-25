import { useState } from "react";
import { Link } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDateFr } from "@/lib/dates";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { correspond } from "@/lib/recherche";
import { BadgeEtape } from "@/modules/commandes/components/BadgeEtape";
import { etapeValidation } from "@/modules/commandes/domain/workflow";
import { useBons } from "@/modules/commandes/hooks/useBons";
import { dansLaFile, type FileBons } from "../domain/files";
import { OngletsFacturation } from "./OngletsFacturation";

/**
 * Les files Validation / À facturer (FAC-14), regroupées en dossiers par
 * client avec leur étape. Les gestes (chiffrer, valider, facturer) vivent sur
 * la fiche du bon.
 */
export function PageFilesBons({ file }: { file: FileBons }) {
  useModeDiscret();
  const bons = useBons();
  const [recherche, setRecherche] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const liste = (bons.data ?? []).filter((b) => dansLaFile(b, file));
  const retenus = liste.filter((b) => correspond(recherche, b.client_nom, b.numero_bc, b.numero_interne, b.adresse, b.ville));
  const dossiers = [...new Set(retenus.map((b) => b.client_nom))].sort((a, b) => a.localeCompare(b, "fr")).map((client) => ({ client, bons: retenus.filter((b) => b.client_nom === client) }));

  return (
    <>
      <EnTetePage titre={file === "validation" ? "Validation" : "À facturer"} />
      <OngletsFacturation />
      <p className="mb-3 text-sm text-muted-foreground">
        {file === "validation" ? "Bons de commande dont les travaux avancent ou sont validés par le conducteur, en attente de validation par le directeur." : "Bons de commande validés par le directeur — à facturer et envoyer au client."}
      </p>
      <label htmlFor="recherche-file" className="sr-only">Rechercher un bon</label>
      <Input id="recherche-file" type="search" className="mb-3 max-w-sm" placeholder="Client, n° de bon, adresse…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      {bons.isPending && <Chargement />}
      {bons.isError && <Erreur erreur={bons.error} reessayer={() => void bons.refetch()} />}
      {bons.isSuccess && dossiers.length === 0 && (
        // Une file non vide dont rien ne correspond n'est pas une file vide : les confondre ferait croire qu'il n'y a plus rien à traiter.
        <Vide message={liste.length ? "Aucun bon de commande ne correspond à votre recherche." : file === "validation" ? "Aucun bon de commande en attente de validation." : "Aucun bon de commande à facturer."} />
      )}
      <ul aria-label="Dossiers clients" className="flex flex-col gap-2">
        {dossiers.map(({ client, bons: duClient }) => {
          // Pendant une recherche, tous les dossiers s'ouvrent : un dossier fermé ne montre pas ce qu'on cherche.
          const deplie = !!recherche || ouvert === client;
          const enCours = file === "validation" ? duClient.filter((b) => etapeValidation(b.circuit) === "travaux_en_cours").length : 0;
          return (
            <li key={client} className="rounded-md border border-border">
              <button type="button" aria-expanded={deplie} className="flex w-full items-center justify-between gap-3 p-3 text-left" onClick={() => setOuvert(ouvert === client ? null : client)}>
                <span className="font-medium">{client}</span>
                <span className="flex items-center gap-2">
                  <Badge variant="neutre">{duClient.length}</Badge>
                  {enCours > 0 && <Badge variant="alerte" title="Travaux non terminés — pas encore chiffrables">{enCours} en cours</Badge>}
                </span>
              </button>
              {deplie && (
                <ul className="divide-y divide-border border-t border-border">
                  {duClient.map((b) => (
                    <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                      <span>
                        <Link className="font-medium text-primary hover:underline" to={`/commandes/${b.id}`}>{b.numero_bc || b.numero_interne}</Link>
                        <span className="block text-muted-foreground">{[b.adresse, b.ville].filter(Boolean).join(", ")} · reçu le {formatDateFr(b.date_reception ?? b.date)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        {b.montant != null && <span className="tabular-nums">{formatEurosEcran(montant(b.montant))} HT</span>}
                        <BadgeEtape bon={b} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
