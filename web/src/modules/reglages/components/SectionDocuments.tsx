import { type FormEvent } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampChoix, ChampTexte, ChampZone } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormulaire } from "@/lib/useFormulaire";
import { usePermission, useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { MODES_REGLEMENT } from "@/modules/clients/domain/delais";
import { appliquerDocuments, schemaSaisieDocuments, valeursDocuments, type ReglagesSociete } from "@/modules/societes/domain/reglages-societe";
import { useEnregistrerReglages, useReglagesSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { CaseACocher, PiedEnregistrement } from "./champs";

export function SectionDocuments() {
  const reglages = useReglagesSociete();
  // Ici et non dans le formulaire : il est remonté après la relecture, l'issue doit survivre.
  const enregistrer = useEnregistrerReglages();
  if (reglages.isPending) return <Chargement />;
  if (reglages.isError) return <Erreur erreur={reglages.error} reessayer={() => void reglages.refetch()} />;
  // La clé remonte le formulaire après la relecture : il montre ce que la base a gardé (PAR-02).
  return <FormulaireDocuments key={JSON.stringify(reglages.data)} reglages={reglages.data} enregistrer={enregistrer} />;
}

/** Valeurs par défaut des nouveaux devis et factures (PAR-02). */
function FormulaireDocuments({ reglages, enregistrer }: { reglages: ReglagesSociete; enregistrer: ReturnType<typeof useEnregistrerReglages> }) {
  const societe = useSocieteActive();
  const modifiable = usePermission("reglages", "modifier");
  const { valeurs, erreurs, changer, valider } = useFormulaire(valeursDocuments(reglages));

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const saisie = valider(schemaSaisieDocuments);
    if (saisie) enregistrer.mutate((r) => appliquerDocuments(r, saisie));
  }

  const texte = (nom: keyof typeof valeurs, libelle: string, extra: Partial<Parameters<typeof ChampTexte>[0]> = {}) => (
    <ChampTexte libelle={libelle} valeur={valeurs[nom]} onChange={(v) => changer(nom, v)} erreur={erreurs[nom]} desactive={!modifiable} {...extra} />
  );
  const zone = (nom: keyof typeof valeurs, libelle: string) => (
    <div className="sm:col-span-2">
      <ChampZone libelle={libelle} valeur={valeurs[nom]} onChange={(v) => changer(nom, v)} desactive={!modifiable} />
    </div>
  );

  return (
    <form onSubmit={soumettre} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Valeurs par défaut des devis et factures</CardTitle>
          <p className="text-sm text-muted-foreground">Appliquées aux nouveaux documents de {societe.nom}.</p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {Object.keys(erreurs).length > 0 && <Alert variant="erreur" className="sm:col-span-2">Le formulaire contient des erreurs : corrigez les champs signalés.</Alert>}
          {texte("validiteDevisJours", "Validité des devis (jours)", { inputMode: "numeric" })}
          {texte("tvaDefaut", "TVA par défaut (%)", { inputMode: "decimal" })}
          {texte("delaiPaiementJours", "Délai de paiement (jours)", { inputMode: "numeric" })}
          <ChampChoix
            libelle="Délai compté"
            valeur={valeurs.modeDelaiPaiement}
            onChange={(v) => changer("modeDelaiPaiement", v)}
            desactive={!modifiable}
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
            desactive={!modifiable}
            options={MODES_REGLEMENT.map((m) => ({ valeur: m.code, libelle: m.libelle }))}
          />
          {texte("tauxTva", "Taux de TVA proposés (%)", { placeholder: "0 ; 5,5 ; 10 ; 20", aide: "Séparés par des points-virgules. 0 sert à l'autoliquidation et aux exonérations." })}
          <div className="sm:col-span-2">{texte("mentionAcceptation", "Mention d'acceptation (devis)")}</div>
          {zone("conditionsDevis", "Conditions affichées sur les devis")}
          {zone("mentionsComplementaires", "Mentions complémentaires (factures)")}
          <div className="sm:col-span-2">{texte("piedDePage", "Pied de page des documents", { aide: "Remplace l'identité légale au bas des documents : à n'employer qu'en connaissance de cause." })}</div>
          {texte("siteWeb", "Site web", { placeholder: "www.exemple.fr" })}
          <div className="flex items-end sm:col-span-2">
            <CaseACocher libelle="Rappeler l'IBAN sur les factures" coche={valeurs.afficherIban === "true"} onChange={(v) => changer("afficherIban", String(v))} desactive={!modifiable} />
          </div>
          <div className="sm:col-span-2">
            <PiedEnregistrement modifiable={modifiable} enCours={enregistrer.isPending} erreur={enregistrer.error} succes={enregistrer.isSuccess ? "Préférences enregistrées." : null} />
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
