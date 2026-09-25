import { type FormEvent } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormulaire } from "@/lib/useFormulaire";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
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
import { useModifierSociete, useReglagesSociete, useSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { BandeauCompletude } from "./BandeauCompletude";
import { BlocFeries } from "./BlocFeries";
import { CaseACocher, PiedEnregistrement } from "./champs";

export function SectionOrganisation() {
  const societe = useSociete();
  if (societe.isPending) return <Chargement />;
  if (societe.isError) return <Erreur erreur={societe.error} reessayer={() => void societe.refetch()} />;
  return (
    <div className="flex flex-col gap-4">
      <FormulaireOrganisation key={societe.data.id} societe={societe.data} />
      <BlocFeries />
    </div>
  );
}

const vide = { valeur: "", libelle: "—" };

/** Identité légale, TVA et mentions, réception des factures, coordonnées bancaires (SOC-05). */
function FormulaireOrganisation({ societe }: { societe: Societe }) {
  const modifiable = usePermission("reglages", "modifier");
  const modifier = useModifierSociete();
  const reglages = useReglagesSociete();
  const { valeurs, erreurs, changer, valider } = useFormulaire(valeursSociete(societe));

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const saisie = valider(schemaSaisieSociete);
    if (saisie) modifier.mutate(saisie);
  }

  const champ = (nom: keyof ValeursSociete, libelle: string, extra: Partial<Parameters<typeof ChampTexte>[0]> = {}) => (
    <ChampTexte libelle={libelle} valeur={valeurs[nom]} onChange={(v) => changer(nom, v)} erreur={erreurs[nom]} desactive={!modifiable} {...extra} />
  );
  const choix = (nom: keyof ValeursSociete, libelle: string, options: readonly { code: string; libelle: string }[], aide?: string) => (
    <ChampChoix
      libelle={libelle}
      valeur={valeurs[nom]}
      onChange={(v) => changer(nom, v)}
      desactive={!modifiable}
      aide={aide}
      options={[vide, ...options.map((o) => ({ valeur: o.code, libelle: o.libelle }))]}
    />
  );
  const tva = tvaDeduite(valeurs);

  return (
    <form onSubmit={soumettre} noValidate className="flex flex-col gap-4">
      <BandeauCompletude valeurs={valeurs} piedDePage={reglages.data?.documents.piedDePage ?? ""} />
      {Object.keys(erreurs).length > 0 && <Alert variant="erreur">Le formulaire contient des erreurs : corrigez les champs signalés.</Alert>}
      <Card>
        <CardHeader>
          <CardTitle>Coordonnées</CardTitle>
          <p className="text-sm text-muted-foreground">En-tête de vos devis et factures. Le nom court « {societe.nom} » est celui du sélecteur de société.</p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">{champ("adresse", "Adresse")}</div>
          {champ("code_postal", "Code postal", { inputMode: "numeric" })}
          {champ("ville", "Ville")}
          {champ("telephone", "Téléphone", { type: "tel", inputMode: "tel" })}
          {champ("email", "E-mail", { type: "email", inputMode: "email" })}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Identité légale</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">{champ("raison_sociale_legale", "Raison sociale", { placeholder: societe.nom })}</div>
          {champ("forme_juridique", "Forme juridique", { placeholder: "SASU, EURL…" })}
          {champ("siret", "SIRET", { inputMode: "numeric" })}
          {champ("siren", "SIREN", { inputMode: "numeric", placeholder: "9 chiffres" })}
          <div className="flex items-end gap-2">
            <div className="flex-1">{champ("tva_intracom", "N° de TVA intracommunautaire", { placeholder: "FR…" })}</div>
            {modifiable && (
              <Button type="button" variant="outline" disabled={!tva} onClick={() => tva && changer("tva_intracom", tva)}>
                Calculer
              </Button>
            )}
          </div>
          {champ("code_naf", "Code APE / NAF")}
          {champ("capital_social", "Capital social (€)", { inputMode: "decimal" })}
          {champ("rcs_numero", "N° RCS")}
          {champ("rcs_ville", "Ville du RCS")}
          {champ("pays_code", "Pays (code)")}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>TVA et mentions obligatoires</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {choix("regime_tva", "Régime de TVA", REGIMES_TVA, sansTva(valeurs.regime_tva) ? `Vos factures porteront « ${MENTION_FRANCHISE_EN_BASE} » et aucune TVA.` : undefined)}
          {choix("ereporting_regime", "Périodicité de l'e-reporting", PERIODICITES_EREPORTING, "À aligner sur votre déclaration de TVA — à confirmer avec votre comptable.")}
          <div className="flex flex-col gap-2 sm:col-span-2">
            <CaseACocher
              libelle="TVA exigible à l'encaissement (prestations de services)"
              coche={valeurs.tva_sur_encaissements === "true"}
              onChange={(v) => changer("tva_sur_encaissements", String(v))}
              desactive={!modifiable}
            />
            <CaseACocher
              libelle="Autoliquidation de la TVA dans le bâtiment (sous-traitance, art. 283-2 nonies du CGI)"
              coche={valeurs.autoliquidation_batiment === "true"}
              onChange={(v) => changer("autoliquidation_batiment", String(v))}
              desactive={!modifiable}
            />
          </div>
          <div className="sm:col-span-2">{champ("mention_penalites_retard", "Mention des pénalités de retard", { placeholder: "Ex : trois fois le taux d'intérêt légal" })}</div>
          {champ("indemnite_recouvrement", "Indemnité de recouvrement (€)", { inputMode: "decimal", aide: "40 € par défaut — art. D. 441-5 du code de commerce." })}
          <span />
          {champ("assurance_decennale_nom", "Assurance décennale — assureur")}
          {champ("assurance_decennale_police", "N° de police")}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Réception des factures fournisseurs et banque</CardTitle>
          <p className="text-sm text-muted-foreground">
            Obligatoire depuis le 1er septembre 2026 : l'adresse que vos fournisseurs utiliseront pour vous facturer, attribuée par votre plateforme.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {choix(
            "adresse_electronique_schema",
            "Schéma de l'adresse",
            SCHEMAS_ADRESSE_ELECTRONIQUE.map((s) => ({ code: s.code, libelle: `${s.code} — ${s.libelle}` }))
          )}
          {champ("adresse_electronique_valeur", "Adresse électronique", { placeholder: "déduite du SIRET" })}
          {champ("iban", "IBAN", { placeholder: "FR76…" })}
          {champ("bic", "BIC")}
        </CardContent>
      </Card>
      <PiedEnregistrement modifiable={modifiable} enCours={modifier.isPending} erreur={modifier.error} succes={modifier.isSuccess ? "Informations enregistrées." : null} />
    </form>
  );
}
