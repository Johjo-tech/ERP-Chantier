import { useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampTexte } from "@/components/formulaire/Champ";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { useFormulaire } from "@/lib/useFormulaire";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { adresseElectroniqueParDefaut } from "@/modules/clients/domain/efacture";
import type { EtablissementTrouve } from "@/modules/clients/domain/annuaire";
import {
  MENTION_FRANCHISE_EN_BASE,
  PERIODICITES_EREPORTING,
  REGIMES_TVA,
  SCHEMAS_ADRESSE_ELECTRONIQUE,
  sansTva,
  schemaSaisieSociete,
  tvaDeduite,
  valeursSociete,
  type Societe,
  type ValeursSociete,
} from "@/modules/societes/domain/societe";
import { useInfosEntreprise, useReglagesSociete, useSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { gerantDepuisInfos, type Gerant } from "../api/gerant";
import { useEnregistrerOrganisation } from "../hooks/useOrganisation";
import { BandeauCompletude } from "./BandeauCompletude";
import { BlocFeries } from "./BlocFeries";
import { ChampAdresse, ChampSiret } from "./ChampsAnnuaire";

export function SectionOrganisation() {
  const societe = useSociete();
  const infos = useInfosEntreprise();
  const reglages = useReglagesSociete();
  if (societe.isPending || infos.isPending || reglages.isPending) return <Chargement />;
  const erreur = societe.error ?? infos.error ?? reglages.error;
  if (erreur) return <Erreur erreur={erreur} reessayer={() => void Promise.all([societe.refetch(), infos.refetch(), reglages.refetch()])} />;
  if (!societe.data || !reglages.data) return <Chargement />;
  return (
    <>
      <FormulaireOrganisation
        key={societe.data.id}
        societe={societe.data}
        gerant={gerantDepuisInfos(infos.data ?? {})}
        siteWeb={reglages.data.documents.siteWeb}
        piedDePage={reglages.data.documents.piedDePage}
      />
      <BlocFeries />
    </>
  );
}

const STYLE_AIDE = { color: "var(--text-dim)", fontSize: "11px" } as const;
const STYLE_RESUME = { cursor: "pointer", fontWeight: 700 } as const;

interface Props {
  societe: Societe;
  gerant: Gerant;
  siteWeb: string;
  piedDePage: string;
}

/** `renderInfosEntrepriseSection` (app.js l. 12423) : coordonnées, puis les trois volets repliables de `sectionsEfactureSocieteHTML`. */
function FormulaireOrganisation({ societe, gerant: gerantInitial, siteWeb: siteInitial, piedDePage }: Props) {
  const modifiable = usePermission("reglages", "modifier");
  const enregistrer = useEnregistrerOrganisation();
  const { valeurs, changer } = useFormulaire(valeursSociete(societe));
  const [gerant, setGerant] = useState(gerantInitial);
  const [siteWeb, setSiteWeb] = useState(siteInitial);
  const off = !modifiable;

  function sauver() {
    const r = schemaSaisieSociete.safeParse(valeurs);
    if (!r.success) {
      // `verifierEntite` + `messageAnomalies` de l'ancien : le mal formé bloque, dit en une fenêtre.
      window.alert(r.error.issues.map((i) => i.message).join("\n"));
      return;
    }
    enregistrer.mutate(
      { societe: r.data, gerant, siteWeb },
      { onSuccess: () => afficherToast("Informations enregistrées.", "success"), onError: (e) => afficherToast(messageErreur(e)) }
    );
  }

  /** `appliquerEtablissement` : l'identité choisie écrase, le reste ne remplit que le vide. */
  function depuisAnnuaire(e: EtablissementTrouve) {
    const siVide = (cle: keyof ValeursSociete, v: string) => {
      if (v && !valeurs[cle].trim()) changer(cle, v);
    };
    changer("siret", e.siret);
    changer("adresse", e.adresse);
    changer("code_postal", e.codePostal);
    changer("ville", e.ville);
    changer("siren", e.siren);
    siVide("tva_intracom", e.tvaIntracom);
    siVide("code_naf", e.activite);
    siVide("forme_juridique", e.formeJuridique);
    if (e.dirigeant && !gerant.gerant.trim()) setGerant((g) => ({ ...g, gerant: e.dirigeant }));
    const adr = adresseElectroniqueParDefaut(e);
    if (adr) {
      siVide("adresse_electronique_valeur", adr.valeur);
      siVide("adresse_electronique_schema", adr.schema);
    }
  }

  const champ = (nom: keyof ValeursSociete, libelle: string, extra: Partial<Parameters<typeof ChampTexte>[0]> = {}) => (
    <ChampTexte libelle={libelle} valeur={valeurs[nom]} onChange={(v) => changer(nom, v)} desactive={off} {...extra} />
  );

  return (
    <div className="card" style={{ marginTop: "22px" }}>
      <div className="card-title" style={{ marginBottom: "10px" }}>
        🏢 Informations de l&apos;entreprise
      </div>
      <div className="card-sub" style={{ marginBottom: "14px" }}>
        Utilisées dans l&apos;en-tête de vos devis/factures et pour générer automatiquement des documents comme le PPSPS.
      </div>
      <div className="field-grid">
        <ChampAdresse
          valeur={valeurs.adresse}
          desactive={off}
          onChange={(v) => changer("adresse", v)}
          onChoisir={(a) => {
            changer("adresse", a.adresse);
            changer("code_postal", a.codePostal);
            changer("ville", a.ville);
          }}
        />
        {champ("code_postal", "Code postal")}
        {champ("ville", "Ville")}
        {champ("telephone", "Téléphone")}
        {champ("email", "Email", { type: "email" })}
        <ChampTexte libelle="Site web" valeur={siteWeb} onChange={setSiteWeb} desactive={off} placeholder="www.exemple.fr" />
        <ChampSiret valeur={valeurs.siret} desactive={off} onChange={(v) => changer("siret", v)} onEtablissement={depuisAnnuaire} />
        <ChampTexte libelle="Nom du gérant / représentant" valeur={gerant.gerant} onChange={(v) => setGerant((g) => ({ ...g, gerant: v }))} desactive={off} />
        <ChampTexte libelle="Téléphone du gérant" valeur={gerant.gerantTelephone} onChange={(v) => setGerant((g) => ({ ...g, gerantTelephone: v }))} desactive={off} />
      </div>
      <details style={{ marginTop: "14px" }}>
        <summary style={STYLE_RESUME}>⚖️ Identité légale</summary>
        <div className="field-grid" style={{ marginTop: "10px" }}>
          {champ("raison_sociale_legale", "Raison sociale", { className: "full", placeholder: societe.nom })}
          {champ("forme_juridique", "Forme juridique", { placeholder: "SASU, EURL…" })}
          {champ("siren", "SIREN", { inputMode: "numeric", placeholder: "9 chiffres" })}
          <div className="field">
            <label htmlFor="ie_tvaIntracom">N° de TVA intracommunautaire</label>
            <div style={{ display: "flex", gap: "6px" }}>
              <input type="text" id="ie_tvaIntracom" value={valeurs.tva_intracom} placeholder="FR…" style={{ flex: 1 }} disabled={off} onChange={(e) => changer("tva_intracom", e.target.value)} />
              <button
                type="button"
                className="btn small"
                title="Calculer depuis le SIREN"
                disabled={off}
                onClick={() => {
                  const tva = tvaDeduite(valeurs);
                  if (tva) changer("tva_intracom", tva);
                  else afficherToast("Renseignez d'abord un SIRET ou un SIREN.");
                }}
              >
                ∑
              </button>
            </div>
          </div>
          {champ("code_naf", "Code APE / NAF")}
          {champ("capital_social", "Capital social (€)", { type: "number" })}
          {champ("rcs_numero", "N° RCS")}
          {champ("rcs_ville", "Ville du RCS")}
          {champ("pays_code", "Pays")}
        </div>
      </details>
      <details style={{ marginTop: "8px" }}>
        <summary style={STYLE_RESUME}>💶 TVA et mentions obligatoires</summary>
        <div className="field-grid" style={{ marginTop: "10px" }}>
          <div className="field">
            <label htmlFor="ie_regimeTva">Régime de TVA</label>
            <select id="ie_regimeTva" value={valeurs.regime_tva} disabled={off} onChange={(e) => changer("regime_tva", e.target.value)}>
              <option value="">—</option>
              {REGIMES_TVA.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.libelle}
                </option>
              ))}
            </select>
            <small id="ie_franchiseAide" style={{ color: "#B85C00", fontSize: "11px" }}>
              {sansTva(valeurs.regime_tva) ? `Vos factures porteront « ${MENTION_FRANCHISE_EN_BASE} » et aucune TVA.` : ""}
            </small>
          </div>
          <div className="field">
            <label htmlFor="ie_ereportingRegime">Périodicité de l&apos;e-reporting</label>
            <select id="ie_ereportingRegime" value={valeurs.ereporting_regime} disabled={off} onChange={(e) => changer("ereporting_regime", e.target.value)}>
              <option value="">—</option>
              {PERIODICITES_EREPORTING.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.libelle}
                </option>
              ))}
            </select>
            <small style={STYLE_AIDE}>À aligner sur votre fréquence de déclaration de TVA — à confirmer avec votre comptable.</small>
          </div>
          <div className="field full">
            <label className="bc-tache-row">
              <input type="checkbox" checked={valeurs.tva_sur_encaissements === "true"} disabled={off} onChange={(e) => changer("tva_sur_encaissements", String(e.target.checked))} />
              <span>TVA exigible à l&apos;encaissement (prestations de services)</span>
            </label>
          </div>
          <div className="field full">
            <label className="bc-tache-row">
              <input type="checkbox" checked={valeurs.autoliquidation_batiment === "true"} disabled={off} onChange={(e) => changer("autoliquidation_batiment", String(e.target.checked))} />
              <span>Autoliquidation de la TVA dans le bâtiment (sous-traitance, art. 283-2 nonies du CGI)</span>
            </label>
          </div>
          {champ("mention_penalites_retard", "Mention des pénalités de retard", { className: "full", placeholder: "Ex : trois fois le taux d'intérêt légal" })}
          <div className="field">
            <label htmlFor="ie_indemniteRecouvrement">Indemnité de recouvrement (€)</label>
            <input type="number" step="1" min="0" id="ie_indemniteRecouvrement" value={valeurs.indemnite_recouvrement} disabled={off} onChange={(e) => changer("indemnite_recouvrement", e.target.value)} />
            <small style={STYLE_AIDE}>40 € par défaut — art. D. 441-5 du code de commerce.</small>
          </div>
          {champ("assurance_decennale_nom", "Assurance décennale — assureur")}
          {champ("assurance_decennale_police", "N° de police")}
        </div>
      </details>
      <details style={{ marginTop: "8px" }} open>
        <summary style={STYLE_RESUME}>📧 Réception des factures fournisseurs</summary>
        <div className="card-sub" style={{ margin: "8px 0" }}>
          Obligatoire depuis le 1<sup>er</sup> septembre 2026 : c&apos;est l&apos;adresse que vos fournisseurs et sous-traitants utiliseront pour vous facturer. Elle vous est attribuée par votre plateforme de dématérialisation.
        </div>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="ie_adresseElectroniqueSchema">Schéma de l&apos;adresse</label>
            <select id="ie_adresseElectroniqueSchema" value={valeurs.adresse_electronique_schema} disabled={off} onChange={(e) => changer("adresse_electronique_schema", e.target.value)}>
              <option value="">—</option>
              {SCHEMAS_ADRESSE_ELECTRONIQUE.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.code} — {x.libelle}
                </option>
              ))}
            </select>
          </div>
          {champ("adresse_electronique_valeur", "Adresse électronique", { placeholder: "déduite du SIRET" })}
          {champ("iban", "IBAN", { placeholder: "FR76…" })}
          {champ("bic", "BIC")}
        </div>
      </details>
      <BandeauCompletude valeurs={valeurs} piedDePage={piedDePage} />
      {modifiable ? (
        <button type="button" className="btn primary" style={{ marginTop: "12px" }} disabled={enregistrer.isPending} onClick={sauver}>
          Enregistrer
        </button>
      ) : (
        <div className="card-sub" style={{ marginTop: "12px" }}>
          Lecture seule : seul un administrateur modifie les réglages.
        </div>
      )}
    </div>
  );
}
