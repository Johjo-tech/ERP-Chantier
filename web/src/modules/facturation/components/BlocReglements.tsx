import { useState, type FormEvent } from "react";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { formatDateFr, todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { formatEuros, montant, type Montant } from "@/lib/money";
import { schemaNombreFr } from "@/lib/nombres";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { MODES_REGLEMENT } from "@/modules/clients/domain/delais";
import { refusReglement, statutReglement } from "../domain/reglements";
import { useReglementsFacture } from "../hooks/useFactures";

const LIBELLE_MODE: Record<string, string> = { avoir: "Avoir", imputation: "Imputation", ...Object.fromEntries(MODES_REGLEMENT.map((m) => [m.code, m.libelle])) };

/** Règlements d'une facture émise : ajout contrôlé (jamais au-delà du reste), historique, suppression. */
export function BlocReglements({ factureId, ttc, modeParDefaut }: { factureId: string; ttc: Montant; modeParDefaut: string | null }) {
  const { reglements, chargement, ajouter, retirer } = useReglementsFacture(factureId, ttc);
  const peutCreer = usePermission("reglements", "creer");
  const peutSupprimer = usePermission("reglements", "supprimer");
  const statut = statutReglement(ttc, reglements);
  const [saisie, setSaisie] = useState({ date: todayISO(), montant: "", mode: modeParDefaut ?? "virement", reference: "" });
  const [refus, setRefus] = useState<string | null>(null);

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const m = schemaNombreFr.safeParse(saisie.montant || String(statut.reste));
    const motif = m.success ? refusReglement({ montant: m.data, ttc, reglements }) : "Montant invalide.";
    setRefus(motif);
    if (motif || !m.success) return;
    ajouter.mutate(
      { date: saisie.date, montant: m.data, mode: saisie.mode, reference: saisie.reference.trim() || null },
      { onSuccess: () => setSaisie((s) => ({ ...s, montant: "", reference: "" })) }
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Règlements</CardTitle>
        <p className="text-sm text-muted-foreground">
          Total {formatEuros(statut.ttc)} · déjà réglé {formatEuros(statut.paye)} · reste {formatEuros(statut.reste)}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {chargement.isError && <Alert variant="erreur">{messageErreur(chargement.error)}</Alert>}
        {(ajouter.isError || retirer.isError) && <Alert variant="erreur">{messageErreur(ajouter.error ?? retirer.error)}</Alert>}
        {reglements.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun règlement.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {reglements.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {formatDateFr(r.date)} · {LIBELLE_MODE[r.mode ?? ""] ?? r.mode} {r.reference && `· ${r.reference}`}
                </span>
                <span className="tabular-nums">{formatEuros(montant(r.montant))}</span>
                {peutSupprimer && <BoutonConfirme libelle="Retirer" question="Retirer ce règlement ?" onConfirmer={() => retirer.mutate(r.id)} />}
              </li>
            ))}
          </ul>
        )}
        {peutCreer && statut.reste.gt(0) && (
          <form onSubmit={soumettre} noValidate className="grid gap-2 border-t border-border pt-3 sm:grid-cols-5">
            <ChampTexte libelle="Date" type="date" valeur={saisie.date} onChange={(v) => setSaisie({ ...saisie, date: v })} />
            <ChampTexte libelle="Montant" inputMode="decimal" placeholder={String(statut.reste).replace(".", ",")} valeur={saisie.montant} erreur={refus ?? undefined} onChange={(v) => setSaisie({ ...saisie, montant: v })} />
            <ChampChoix libelle="Mode" valeur={saisie.mode} onChange={(v) => setSaisie({ ...saisie, mode: v })} options={MODES_REGLEMENT.map((m) => ({ valeur: m.code, libelle: m.libelle }))} />
            <ChampTexte libelle="Référence" valeur={saisie.reference} onChange={(v) => setSaisie({ ...saisie, reference: v })} />
            <div className="flex items-end">
              <Button type="submit" variant="secondary" disabled={ajouter.isPending}>Enregistrer le règlement</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
