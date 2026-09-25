import { useState, type FormEvent } from "react";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { montant } from "@/lib/money";
import { formatEurosEcran } from "@/lib/modeDiscret";
import { schemaNombreFr } from "@/lib/nombres";
import { MODES_REGLEMENT } from "@/modules/clients/domain/delais";
import type { Reglement } from "../api/factures";
import { refusReglement, resteAPayer, totalRegle } from "../domain/reglements";
import { useAjouterReglement, useModifierReglement } from "../hooks/useFactures";

interface Props {
  factureId: string;
  /** Ce que la facture doit en tout : TTC − acomptes déduits (la retenue reste due). */
  totalDu: number;
  reglements: readonly Reglement[];
  modeParDefaut: string | null;
  /** Un règlement à corriger (✎) ; absent pour un nouveau. */
  enCours?: Reglement | null;
  fini?: () => void;
}

/**
 * Saisir ou corriger UN règlement (FAC-34) : montant proposé = reste, mode de
 * la facture, aide « Total · déjà réglé · reste ». En correction, le
 * règlement corrigé est exclu du calcul du reste — corriger 500 en 700 ne
 * doit pas se heurter à un plafond qui compte encore les 500.
 */
export function SaisieReglement({ factureId, totalDu, reglements, modeParDefaut, enCours = null, fini }: Props) {
  const modifier = useModifierReglement();
  const ajouter = useAjouterReglement(factureId);
  const sauf = enCours?.id ?? null;
  const reste = resteAPayer(totalDu, reglements, sauf);
  const [saisie, setSaisie] = useState({
    date: enCours?.date ?? todayISO(),
    montant: enCours ? String(enCours.montant).replace(".", ",") : "",
    mode: enCours?.mode ?? modeParDefaut ?? "virement",
    reference: enCours?.reference ?? "",
  });
  const [refus, setRefus] = useState<string | null>(null);
  const enCoursDEnvoi = ajouter.isPending || modifier.isPending;

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const lu = schemaNombreFr.safeParse(saisie.montant || String(reste));
    const motif = lu.success ? refusReglement({ montant: lu.data, ttc: totalDu, reglements, idModifie: sauf }) : "Montant invalide.";
    setRefus(motif);
    if (motif || !lu.success) return;
    const r = { date: saisie.date, montant: lu.data, mode: saisie.mode, reference: saisie.reference.trim() || null };
    const apres = { onSuccess: () => { setSaisie((x) => ({ ...x, montant: "", reference: "" })); fini?.(); } };
    if (enCours) modifier.mutate({ id: enCours.id, ...r }, apres);
    else ajouter.mutate(r, apres);
  }

  return (
    <form onSubmit={soumettre} noValidate aria-label={enCours ? "Modifier le règlement" : "Nouveau règlement"} className="grid gap-2 border-t border-border pt-3 sm:grid-cols-5">
      <ChampTexte libelle="Date" type="date" valeur={saisie.date} onChange={(v) => setSaisie({ ...saisie, date: v })} />
      <ChampTexte
        libelle="Montant"
        inputMode="decimal"
        placeholder={String(reste).replace(".", ",")}
        valeur={saisie.montant}
        erreur={refus ?? undefined}
        aide={`Total ${formatEurosEcran(montant(totalDu))} · déjà réglé ${formatEurosEcran(totalRegle(reglements, sauf))} · reste ${formatEurosEcran(reste)}`}
        onChange={(v) => setSaisie({ ...saisie, montant: v })}
      />
      <ChampChoix libelle="Mode" valeur={saisie.mode} onChange={(v) => setSaisie({ ...saisie, mode: v })} options={MODES_REGLEMENT.map((m) => ({ valeur: m.code, libelle: m.libelle }))} />
      <ChampTexte libelle="Référence" placeholder="N° chèque, réf. virement…" valeur={saisie.reference} onChange={(v) => setSaisie({ ...saisie, reference: v })} />
      <div className="flex items-end gap-2">
        <Button type="submit" variant="secondary" disabled={enCoursDEnvoi}>{enCours ? "Enregistrer la correction" : "Enregistrer le règlement"}</Button>
        {fini && <Button type="button" variant="ghost" onClick={fini}>Annuler</Button>}
      </div>
      {(ajouter.isError || modifier.isError) && <Alert variant="erreur" className="sm:col-span-5">{messageErreur(ajouter.error ?? modifier.error)}</Alert>}
    </form>
  );
}
