import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { montant } from "@/lib/money";
import { formatEurosEcran } from "@/lib/modeDiscret";
import { Can } from "@/modules/auth-roles/components/Can";
import { useSession, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import type { BonDeLaListe } from "../api/bons";
import { actionsFacturation, actionsTache } from "../domain/circuit";
import { aFacturer, fileValidation, filtrerFile, type FiltreValidation } from "../domain/files";
import { useBons, useGenererFacture } from "../hooks/useBons";
import { BadgeEtape } from "./BadgeEtape";

function TableBons({ bons, prix, action, detail }: { bons: readonly BonDeLaListe[]; prix: boolean; action: (b: BonDeLaListe) => ReactNode; detail?: (b: BonDeLaListe) => ReactNode }) {
  return (
    <Table>
      <THead>
        <Tr>
          <Th>N° interne</Th>
          <Th>Client</Th>
          <Th>Lieu</Th>
          <Th>Étape</Th>
          {prix && <Th className="text-right">Montant HT</Th>}
          <Th><span className="sr-only">Action</span></Th>
        </Tr>
      </THead>
      <TBody>
        {bons.map((b) => (
          <Tr key={b.id}>
            <Td>
              <Link to={`/commandes/${b.id}`} className="font-medium text-primary hover:underline">{b.numero_interne ?? "Sans numéro"}</Link>
              <span className="block text-xs text-muted-foreground">{formatDateFr(b.date_reception ?? b.date)}</span>
            </Td>
            <Td>{b.client_nom}</Td>
            <Td>{[b.adresse, b.ville].filter(Boolean).join(", ") || "—"}</Td>
            <Td>
              <BadgeEtape bon={b} />
              {detail?.(b)}
            </Td>
            {prix && <Td className="text-right tabular-nums">{b.montant === null ? "—" : formatEurosEcran(montant(b.montant))}</Td>}
            <Td className="text-right">{action(b)}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

const FILTRES: { cle: FiltreValidation; libelle: string }[] = [
  { cle: "tous", libelle: "Tous" },
  { cle: "pret", libelle: "Prêts à chiffrer" },
  { cle: "travaux_en_cours", libelle: "Travaux en cours" },
];

/**
 * Facturation › Validation (BC-42, BC-96) : ce qui attend une décision — prêt
 * à chiffrer, ou travaux commencés avec la raison de l'attente. Le compteur de
 * chaque filtre est celui de la liste qu'il affiche.
 */
export function PageValidation() {
  const bons = useBons();
  const prix = useVoitLesPrix();
  const { roleEffectif } = useSession();
  const [filtre, setFiltre] = useState<FiltreValidation>("tous");
  const file = fileValidation(bons.data ?? []);
  const liste = filtrerFile(file, filtre);
  const droits = actionsFacturation(roleEffectif);
  const arbitre = actionsTache("realisee", roleEffectif).peutArbitrer;
  const action = (b: BonDeLaListe) => {
    const etape = file.find((x) => x.bon.id === b.id)?.etape;
    if (etape === "pret" && prix && droits.peutModifierPrefacture) return <Button size="sm" asChild><Link to={`/commandes/${b.id}/prefacture`}>Ouvrir la pré-facture</Link></Button>;
    if (etape === "travaux_en_cours" && arbitre) return <Button size="sm" variant="outline" asChild><Link to={`/commandes/${b.id}`}>Arbitrer les tâches</Link></Button>;
    return null;
  };
  return (
    <>
      <EnTetePage titre="Validation" sousTitre="Bons dont les travaux sont pointés ou en cours : la décision du conducteur, puis du directeur." />
      <div role="group" aria-label="Filtrer la file de validation" className="mb-3 flex flex-wrap gap-2">
        {FILTRES.map((f) => (
          <Button key={f.cle} variant={filtre === f.cle ? "default" : "outline"} aria-pressed={filtre === f.cle} onClick={() => setFiltre(f.cle)}>
            {f.libelle} ({filtrerFile(file, f.cle).length})
          </Button>
        ))}
      </div>
      {bons.isPending && <Chargement />}
      {bons.isError && <Erreur erreur={bons.error} reessayer={() => void bons.refetch()} />}
      {bons.isSuccess && !liste.length && <Vide message="Aucun bon n'attend de validation." />}
      {liste.length > 0 && (
        <TableBons
          bons={liste.map((x) => x.bon)}
          prix={prix}
          action={action}
          detail={(b) => {
            const attente = file.find((x) => x.bon.id === b.id)?.attente;
            return attente ? <span className="block text-xs text-muted-foreground">{attente}</span> : null;
          }}
        />
      )}
    </>
  );
}

function CreerFacture({ bon, onErreur }: { bon: BonDeLaListe; onErreur: (e: unknown) => void }) {
  const navigate = useNavigate();
  const generer = useGenererFacture();
  return (
    <Button size="sm" disabled={generer.isPending} onClick={() => generer.mutate(bon.id, { onSuccess: (id) => void navigate(`/factures/${id}`, { state: { message: "Facture créée en brouillon depuis le bon de commande." } }), onError: onErreur })}>
      {generer.isPending ? "Création…" : "Créer la facture"}
    </Button>
  );
}

/** Facturation › À facturer (BC-42) : chiffrés, sans facture. La facture naît par la base (`bc_generer_facture`). */
export function PageAFacturer() {
  const bons = useBons();
  const prix = useVoitLesPrix();
  const [erreur, setErreur] = useState<unknown>(null);
  const liste = aFacturer(bons.data ?? []);
  return (
    <>
      <EnTetePage titre="À facturer" sousTitre="Bons dont la pré-facture est validée : la facture naît en brouillon, à relire avant émission." />
      {erreur !== null && <Alert variant="erreur">{messageErreur(erreur)}</Alert>}
      {bons.isPending && <Chargement />}
      {bons.isError && <Erreur erreur={bons.error} reessayer={() => void bons.refetch()} />}
      {bons.isSuccess && !liste.length && <Vide message="Aucun bon à facturer." />}
      {liste.length > 0 && (
        <TableBons
          bons={liste}
          prix={prix}
          action={(b) => (
            <Can module="factures" action="creer">
              <CreerFacture bon={b} onErreur={setErreur} />
            </Can>
          )}
        />
      )}
    </>
  );
}
