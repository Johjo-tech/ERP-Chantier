import { useState } from "react";
import { useFiltresAdresse } from "@/lib/useFiltresAdresse";
import { CLASSE_EN_EVIDENCE, useEntreeDefile, useRechercheDifferee } from "@/lib/useRecherche";
import { cn } from "@/lib/utils";
import { useCroisement } from "@/modules/facturation/hooks/useCroisement";
import { OrigineRecherche } from "@/modules/facturation/components/OrigineRecherche";
import { Link } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDateFr } from "@/lib/dates";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { Can } from "@/modules/auth-roles/components/Can";
import { useFonctionnalite } from "@/modules/societes/hooks/useFonctionnalite";
import { usePermission, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import { Alert } from "@/components/ui/alert";
import { messageErreur } from "@/lib/erreurs";
import type { BonDeLaListe } from "../api/bons";
import { champsCherchesDuBon, conducteursDesBons, filtrerBons, FILTRES_VIDES, valeursDeFiltre } from "../domain/filtres";
import type { Apport } from "@/modules/facturation/domain/croisement";
import { LIBELLES_MODE, modeDuBon } from "../domain/regles";
import { useBons } from "../hooks/useBons";
import { BadgeEtape } from "./BadgeEtape";
import { BarreFiltresBons } from "./BarreFiltresBons";
import { ContactsBon } from "./ContactsBon";

/** Le n° du client, ou le mode quand il n'y en a pas : on ne montre jamais une sentinelle comme un numéro. */
function NumeroClient({ bon }: { bon: BonDeLaListe }) {
  useModeDiscret();
  const mode = modeDuBon(bon);
  if (mode !== "normal") return <Badge variant={mode === "attente_bc" ? "alerte" : "neutre"}>{LIBELLES_MODE[mode]}</Badge>;
  return <span className="whitespace-pre-line">{bon.numero_bc ?? "—"}</span>;
}

interface Recherche {
  requete: string;
  apports: readonly Apport[];
  idDom: string;
  enEvidence: boolean;
}

function LigneBon({ bon, prix, contacts, onResultat, recherche }: { bon: BonDeLaListe; prix: boolean; contacts: boolean; onResultat: (m: string, e?: unknown) => void; recherche: Recherche }) {
  useModeDiscret();
  return (
    <Tr id={recherche.idDom} className={cn(recherche.enEvidence && CLASSE_EN_EVIDENCE)}>
      <Td>
        <Link to={`/commandes/${bon.id}`} className="font-medium text-primary hover:underline">{bon.numero_interne ?? "Sans numéro"}</Link>
        {bon.bon_commande_parent_id && <span className="ml-1 text-xs text-muted-foreground">SAV</span>}
      </Td>
      <Td><NumeroClient bon={bon} /></Td>
      <Td>
        {bon.client_nom}
        {bon.interlocuteur && <span className="block text-xs text-muted-foreground">{bon.interlocuteur}</span>}
        <OrigineRecherche requete={recherche.requete} propres={champsCherchesDuBon(bon)} apports={recherche.apports} />
      </Td>
      <Td>{[bon.adresse, [bon.code_postal, bon.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—"}</Td>
      <Td>
        {formatDateFr(bon.date_reception ?? bon.date)}
        {bon.date_fin_travaux && <span className="block text-xs text-muted-foreground">fin {formatDateFr(bon.date_fin_travaux)}</span>}
      </Td>
      <Td><BadgeEtape bon={bon} /></Td>
      {prix && <Td className="text-right tabular-nums">{bon.montant === null ? "—" : formatEurosEcran(montant(bon.montant))}</Td>}
      {contacts && <Td><ContactsBon bon={bon} onResultat={onResultat} /></Td>}
    </Tr>
  );
}

export function PageBonsCommande() {
  useModeDiscret();
  const bons = useBons();
  // Le montant ne s'affiche qu'à qui voit les prix ; la vue le rend NULL aux autres de toute façon.
  const prix = useVoitLesPrix();
  // Les filtres vivent dans l'adresse : la tuile « SAV » ouvre `/commandes?type=sav` (D-CLI-10).
  const { filtres, changer: setFiltres, changerUn } = useFiltresAdresse(FILTRES_VIDES);
  const saisie = useRechercheDifferee(filtres.recherche, (q) => changerUn("recherche", q));
  const croisement = useCroisement();
  const apportsDe = (b: BonDeLaListe) => croisement.apportsBon(b);
  const liste = filtrerBons(bons.data ?? [], filtres, (b) => apportsDe(b).map((a) => a.valeur));
  const defile = useEntreeDefile("bon", liste.map((b) => b.id), filtres.recherche, saisie);
  const filtre = JSON.stringify(filtres) !== JSON.stringify(FILTRES_VIDES);
  const ocr = useFonctionnalite("ocr");
  const contacts = usePermission("bons_commande", "modifier");
  const [resultat, setResultat] = useState<{ message: string; erreur?: unknown } | null>(null);
  const onResultat = (message: string, erreur?: unknown) => setResultat({ message, erreur });

  return (
    <>
      <EnTetePage
        titre="Bons de commande"
        actions={
          <Can module="bons_commande" action="creer">
            {ocr && <Button asChild variant="outline"><Link to="/commandes/lecture">Importer un bon (PDF, photo)</Link></Button>}
            <Button asChild><Link to="/commandes/nouveau">Nouveau bon de commande</Link></Button>
          </Can>
        }
      />
      <BarreFiltresBons
        filtres={filtres}
        onChange={setFiltres}
        conducteurs={conducteursDesBons(bons.data ?? [])}
        valeurs={valeursDeFiltre(bons.data ?? [])}
        saisie={{ valeur: saisie.saisie, onChange: saisie.setSaisie, onKeyDown: defile.surTouche }}
      />
      {resultat && <Alert variant={resultat.erreur ? "erreur" : "succes"}>{resultat.erreur ? messageErreur(resultat.erreur) : resultat.message}</Alert>}
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
              {contacts && <Th>Contact</Th>}
            </Tr>
          </THead>
          <TBody>
            {liste.map((b) => (
              <LigneBon key={b.id} bon={b} prix={prix} contacts={contacts} onResultat={onResultat} recherche={{ requete: filtres.recherche, apports: apportsDe(b), idDom: defile.idDomDe(b.id), enEvidence: defile.enEvidence === b.id }} />
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
