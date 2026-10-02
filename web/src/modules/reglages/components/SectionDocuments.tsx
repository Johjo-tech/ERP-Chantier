import { type FormEvent } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { useFormulaire } from "@/lib/useFormulaire";
import { usePermission, useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { MODES_REGLEMENT } from "@/modules/clients/domain/delais";
import { appliquerDocuments, schemaSaisieDocuments, valeursDocuments, type ReglagesSociete } from "@/modules/societes/domain/reglages-societe";
import { useEnregistrerReglages, useReglagesSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { PiedEnregistrement } from "./champs";

export function SectionDocuments() {
  const reglages = useReglagesSociete();
  // Ici et non dans le formulaire : il est remonté après la relecture, l'issue doit survivre.
  const enregistrer = useEnregistrerReglages();
  if (reglages.isPending) return <Chargement />;
  if (reglages.isError) return <Erreur erreur={reglages.error} reessayer={() => void reglages.refetch()} />;
  // La clé remonte le formulaire après la relecture : il montre ce que la base a gardé (PAR-02).
  return <FormulaireDocuments key={JSON.stringify(reglages.data)} reglages={reglages.data} enregistrer={enregistrer} />;
}

/**
 * Valeurs par défaut des nouveaux devis et factures (PAR-02), au HTML de
 * `renderReglagesDocumentsSection` (app.js l. 12744). Les taux s'affichent comme
 * l'ancien (« 0, 5.5, 10, 20 ») ; la saisie accepte aussi « 0 ; 5,5 » (D-SOC-11).
 * Délai compté et mode de règlement, absents de l'ancien écran, viennent APRÈS
 * ses champs (D-SOC-11). Le site web est rangé sous Organisation, comme avant.
 */
function FormulaireDocuments({ reglages, enregistrer }: { reglages: ReglagesSociete; enregistrer: ReturnType<typeof useEnregistrerReglages> }) {
  const societe = useSocieteActive();
  const modifiable = usePermission("reglages", "modifier");
  const { valeurs, erreurs, changer, valider } = useFormulaire({
    ...valeursDocuments(reglages),
    tvaDefaut: String(reglages.documents.tvaDefaut),
    tauxTva: reglages.tauxTva.join(", "),
  });

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const saisie = valider(schemaSaisieDocuments);
    if (saisie) enregistrer.mutate((r) => appliquerDocuments(r, saisie));
  }

  const off = !modifiable;
  const texte = (nom: keyof typeof valeurs, libelle: string, extra: Partial<Parameters<typeof ChampTexte>[0]> = {}) => (
    <ChampTexte libelle={libelle} valeur={valeurs[nom]} onChange={(v) => changer(nom, v)} erreur={erreurs[nom]} desactive={off} {...extra} />
  );
  const zone = (nom: keyof typeof valeurs, libelle: string) => (
    <div className="field full">
      <label htmlFor={`rg_${nom}`}>{libelle}</label>
      <textarea id={`rg_${nom}`} style={{ minHeight: "60px" }} value={valeurs[nom]} disabled={off} onChange={(e) => changer(nom, e.target.value)} />
    </div>
  );

  return (
    <form className="card" onSubmit={soumettre} noValidate>
      <div className="card-title" style={{ marginBottom: "10px" }}>
        🧾 Valeurs par défaut des devis et factures
      </div>
      <div className="card-sub" style={{ marginBottom: "14px" }}>
        Appliquées aux nouveaux documents de {societe.nom}.
      </div>
      <div className="field-grid">
        {texte("validiteDevisJours", "Validité des devis (jours)", { type: "number" })}
        {texte("delaiPaiementJours", "Délai de paiement (jours)", { type: "number" })}
        {texte("tvaDefaut", "TVA par défaut (%)", { type: "number" })}
        <div className="field">
          <label htmlFor="rg_tauxTva">Taux de TVA proposés (%)</label>
          <input type="text" id="rg_tauxTva" value={valeurs.tauxTva} placeholder="0, 5.5, 10, 20" disabled={off} onChange={(e) => changer("tauxTva", e.target.value)} />
          <small style={{ color: "var(--text-dim)", fontSize: "11px" }}>Séparés par des virgules. 0 sert à l&apos;autoliquidation et aux exonérations.</small>
          {erreurs.tauxTva && <small className="champ-erreur">{erreurs.tauxTva}</small>}
        </div>
        {texte("mentionAcceptation", "Mention d'acceptation (devis)", { className: "full" })}
        {zone("conditionsDevis", "Conditions affichées sur les devis")}
        {zone("mentionsComplementaires", "Mentions complémentaires (factures)")}
        {texte("piedDePage", "Pied de page des documents", { className: "full" })}
        <div className="field full">
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="checkbox" id="rg_afficherIban" checked={valeurs.afficherIban === "true"} disabled={off} onChange={(e) => changer("afficherIban", String(e.target.checked))} /> Rappeler l&apos;IBAN sur les factures
          </label>
        </div>
        <ChampChoix
          libelle="Délai compté"
          valeur={valeurs.modeDelaiPaiement}
          onChange={(v) => changer("modeDelaiPaiement", v)}
          desactive={off}
          options={[
            { valeur: "net", libelle: "Net (à compter de la facture)" },
            { valeur: "fin_de_mois", libelle: "Fin de mois" },
          ]}
        />
        <ChampChoix
          libelle="Mode de règlement par défaut"
          valeur={valeurs.modeReglementDefaut}
          onChange={(v) => changer("modeReglementDefaut", v)}
          erreur={erreurs.modeReglementDefaut}
          desactive={off}
          options={MODES_REGLEMENT.map((m) => ({ valeur: m.code, libelle: m.libelle }))}
        />
      </div>
      <PiedEnregistrement modifiable={modifiable} enCours={enregistrer.isPending} erreur={enregistrer.error} succes={enregistrer.isSuccess ? "Préférences enregistrées." : null} />
    </form>
  );
}
