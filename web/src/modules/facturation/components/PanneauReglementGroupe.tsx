import { useEffect, useRef, useState } from "react";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { schemaNombreFr } from "@/lib/nombres";
import { MODES_REGLEMENT } from "@/modules/clients/domain/delais";
import { imputer, refusImputation, RESTE_SOLDE_EUR } from "../domain/reglements";
import { totalDu, type Solde } from "../domain/solde";
import { useReglementGroupe } from "../hooks/useFactures";

/**
 * Le règlement groupé (FAC-35, app.js l. 11168) : un virement réparti sur les
 * factures cochées, de la plus ancienne à la plus récente. Le montant se
 * modifie ; la RÉPARTITION se voit avant de valider — c'est elle qu'on
 * accepte. La base refait l'imputation et écrit tout ou rien
 * (`enregistrer_reglement_groupe`) : l'aperçu montre, la base décide.
 */
export function PanneauReglementGroupe({ factures, fermer }: { factures: readonly Solde[]; fermer: (message?: string) => void }) {
  const cadre = useRef<HTMLElement>(null);
  useEffect(() => cadre.current?.focus(), []);
  useModeDiscret();
  const du = totalDu(factures);
  const [saisie, setSaisie] = useState({ montant: String(du).replace(".", ","), date: todayISO(), mode: "virement", reference: "" });
  const groupe = useReglementGroupe();
  const cibles = factures.map((f) => ({ id: f.facture_id, numero: f.numero, date: f.date, reste: f.du }));
  const lu = schemaNombreFr.safeParse(saisie.montant);
  const refus = lu.success ? refusImputation(lu.data, cibles) : "Montant invalide.";
  const parts = lu.success && !refus ? imputer(lu.data, cibles) : [];

  function valider() {
    if (refus || !lu.success) return;
    groupe.mutate(
      { factures: factures.map((f) => f.facture_id), montant: lu.data, date: saisie.date, mode: saisie.mode, reference: saisie.reference.trim() || null },
      {
        onSuccess: (servies) => {
          const soldees = servies.filter((p) => p.reste_apres <= RESTE_SOLDE_EUR).length;
          fermer(`${formatEurosEcran(montant(lu.data))} enregistré${servies.length > 1 ? ` sur ${servies.length} factures` : ""} — ${soldees} soldée${soldees > 1 ? "s" : ""}.`);
        },
      }
    );
  }

  return (
    // Un panneau DANS la page, pas une fenêtre modale : « dialog » sans modalité ni focus
    // trompait les lecteurs d'écran (relecture 4, M8). Il prend le focus à l'ouverture
    // et Échap le referme, comme un dialogue.
    <section
      ref={cadre}
      tabIndex={-1}
      role="region"
      aria-label="Règlement groupé"
      onKeyDown={(e) => {
        if (e.key === "Escape") fermer();
      }}
      className="flex flex-col gap-3 rounded-md border border-primary p-4 outline-none"
    >
      <h2 className="font-semibold">Règlement groupé — {factures.length} facture{factures.length > 1 ? "s" : ""}</h2>
      <p className="text-sm text-muted-foreground">Total dû : {formatEurosEcran(du)}</p>
      <div className="grid gap-2 sm:grid-cols-4">
        <ChampTexte libelle="Montant reçu" inputMode="decimal" valeur={saisie.montant} onChange={(v) => setSaisie({ ...saisie, montant: v })} />
        <ChampTexte libelle="Date" type="date" valeur={saisie.date} onChange={(v) => setSaisie({ ...saisie, date: v })} />
        <ChampChoix libelle="Mode de règlement" valeur={saisie.mode} onChange={(v) => setSaisie({ ...saisie, mode: v })} options={MODES_REGLEMENT.map((m) => ({ valeur: m.code, libelle: m.libelle }))} />
        <ChampTexte libelle="Référence" placeholder="N° chèque, réf. virement…" valeur={saisie.reference} onChange={(v) => setSaisie({ ...saisie, reference: v })} />
      </div>
      <h3 className="text-sm font-semibold">Répartition</h3>
      {refus ? (
        <Alert variant="erreur">{refus}</Alert>
      ) : (
        <ul aria-label="Répartition du règlement" className="text-sm">
          {cibles.map((f) => {
            const p = parts.find((x) => x.id === f.id);
            return (
              <li key={f.id} className={`flex justify-between gap-3 py-1 ${p ? "" : "opacity-50"}`}>
                <span>
                  {f.numero}{" "}
                  <small className="text-muted-foreground">{!p ? "— rien cette fois" : p.resteApres.lt("0.005") ? "soldée" : `reste ${formatEurosEcran(p.resteApres)}`}</small>
                </span>
                <b className="tabular-nums">{p ? formatEurosEcran(p.montant) : "—"}</b>
              </li>
            );
          })}
          {parts.length < cibles.length && <li className="text-muted-foreground">Les factures non servies restent dues : le virement ne va pas jusqu'à elles.</li>}
        </ul>
      )}
      {groupe.isError && <Alert variant="erreur">{messageErreur(groupe.error)}</Alert>}
      <div className="flex gap-2">
        <Button disabled={!!refus || groupe.isPending} onClick={valider}>Enregistrer le règlement</Button>
        <Button variant="ghost" onClick={() => fermer()}>Annuler</Button>
      </div>
    </section>
  );
}
