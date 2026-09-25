import { useState } from "react";
import { Link } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDateFr } from "@/lib/dates";
import { formatEuros, montant } from "@/lib/money";
import { Can } from "@/modules/auth-roles/components/Can";
import { useFonctionnalite } from "@/modules/societes/hooks/useFonctionnalite";
import { useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import type { BonDeLaListe } from "../api/bons";
import { conducteursDesBons, filtrerBons, FILTRES_VIDES, type FiltresBons } from "../domain/filtres";
import { LIBELLES_MODE, modeDuBon } from "../domain/regles";
import { useBons } from "../hooks/useBons";
import { BadgeEtape } from "./BadgeEtape";
import { BarreFiltresBons } from "./BarreFiltresBons";

/** Le n° du client, ou le mode quand il n'y en a pas : on ne montre jamais une sentinelle comme un numéro. */
function NumeroClient({ bon }: { bon: BonDeLaListe }) {
  const mode = modeDuBon(bon);
  if (mode !== "normal") return <Badge variant={mode === "attente_bc" ? "alerte" : "neutre"}>{LIBELLES_MODE[mode]}</Badge>;
  return <span className="whitespace-pre-line">{bon.numero_bc ?? "—"}</span>;
}

function LigneBon({ bon, prix }: { bon: BonDeLaListe; prix: boolean }) {
  return (
    <Tr>
      <Td>
        <Link to={`/commandes/${bon.id}`} className="font-medium text-primary hover:underline">{bon.numero_interne ?? "Sans numéro"}</Link>
        {bon.bon_commande_parent_id && <span className="ml-1 text-xs text-muted-foreground">SAV</span>}
      </Td>
      <Td><NumeroClient bon={bon} /></Td>
      <Td>
        {bon.client_nom}
        {bon.interlocuteur && <span className="block text-xs text-muted-foreground">{bon.interlocuteur}</span>}
      </Td>
      <Td>{[bon.adresse, [bon.code_postal, bon.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—"}</Td>
      <Td>
        {formatDateFr(bon.date_reception ?? bon.date)}
        {bon.date_fin_travaux && <span className="block text-xs text-muted-foreground">fin {formatDateFr(bon.date_fin_travaux)}</span>}
      </Td>
      <Td><BadgeEtape bon={bon} /></Td>
      {prix && <Td className="text-right tabular-nums">{bon.montant === null ? "—" : formatEuros(montant(bon.montant))}</Td>}
    </Tr>
  );
}

export function PageBonsCommande() {
  const bons = useBons();
  // Le montant ne s'affiche qu'à qui voit les prix ; la vue le rend NULL aux autres de toute façon.
  const prix = useVoitLesPrix();
  const [filtres, setFiltres] = useState<FiltresBons>(FILTRES_VIDES);
  const liste = filtrerBons(bons.data ?? [], filtres);
  const filtre = JSON.stringify(filtres) !== JSON.stringify(FILTRES_VIDES);
  const ocr = useFonctionnalite("ocr");

  return (
    <>
      <EnTetePage
        titre="Bons de commande"
        actions={
          <Can module="bons_commande" action="creer">
            {ocr && <Button asChild variant="outline"><Link to="/commandes/lecture">Lire un bon (PDF, photo)</Link></Button>}
            <Button asChild><Link to="/commandes/nouveau">Nouveau bon de commande</Link></Button>
          </Can>
        }
      />
      <BarreFiltresBons filtres={filtres} onChange={setFiltres} conducteurs={conducteursDesBons(bons.data ?? [])} />
      {bons.isPending && <Chargement />}
      {bons.isError && <Erreur erreur={bons.error} reessayer={() => void bons.refetch()} />}
      {bons.isSuccess && liste.length === 0 && <Vide message={filtre ? "Aucun bon de commande ne correspond." : "Aucun bon de commande pour l'instant."} />}
      {liste.length > 0 && (
        <Table>
          <THead>
            <Tr>
              <Th>N° interne</Th>
              <Th>N° BC client</Th>
              <Th>Client</Th>
              <Th>Lieu</Th>
              <Th>Réception</Th>
              <Th>Étape</Th>
              {prix && <Th className="text-right">Montant HT</Th>}
            </Tr>
          </THead>
          <TBody>{liste.map((b) => <LigneBon key={b.id} bon={b} prix={prix} />)}</TBody>
        </Table>
      )}
    </>
  );
}
