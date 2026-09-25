import { type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampChoix, ChampTexte, ChampZone } from "@/components/formulaire/Champ";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { messageErreur } from "@/lib/erreurs";
import { useFormulaire } from "@/lib/useFormulaire";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { CADRES_FACTURATION, saisieDepuis, schemaSaisieClient, type Client } from "../domain/client";
import { CLE_DELAI_PAR_CADRE, DELAIS_PREREGLES } from "../domain/delais";
import { adresseElectroniqueParDefaut, completudeClient, phraseManques, sectionsEfactureVisibles } from "../domain/efacture";
import { chiffres, sirenDuSiret, tvaIntracomFr } from "../domain/identifiants";
import { SCHEMAS_ADRESSE_ELECTRONIQUE } from "@/modules/societes/domain/societe";
import { useClient, useEnregistrerClient } from "../hooks/useClients";
import { ChampsDelai } from "./ChampsDelai";
import { VillesProposees } from "./VillesProposees";

export function PageFormulaireClient() {
  const { id } = useParams();
  const client = useClient(id);
  if (id && client.isPending) return <Chargement />;
  if (id && client.isError) return <Erreur erreur={client.error} reessayer={() => void client.refetch()} />;
  const f = <FormulaireClient key={id ?? "nouveau"} client={client.data ?? null} />;
  return client.data ? <GardeSociete societeId={client.data.societe_id} retour="/clients">{f}</GardeSociete> : f;
}

function FormulaireClient({ client }: { client: Client | null }) {
  const navigate = useNavigate();
  const enregistrer = useEnregistrerClient(client?.id);
  const { valeurs, erreurs, changer, valider } = useFormulaire(saisieDepuis(client));
  const sections = sectionsEfactureVisibles(valeurs.cadre_facturation as Client["cadre_facturation"]);
  const particulier = !sections.includes("immatriculation");
  const adresseProposee = adresseElectroniqueParDefaut(valeurs);
  const manques = completudeClient({
    nom: valeurs.nom, adresse: valeurs.adresse, codePostal: valeurs.code_postal, ville: valeurs.ville, siret: valeurs.siret,
    tvaIntracom: valeurs.tva_intracom, adresseElectroniqueValeur: valeurs.adresse_electronique_valeur || adresseProposee?.valeur,
    codeService: valeurs.code_service, referenceEngagement: valeurs.reference_engagement, cadreFacturation: valeurs.cadre_facturation,
  });

  function changerCadre(cadre: string) {
    changer("cadre_facturation", cadre);
    // Le délai du type de client ne s'impose qu'au CHANGEMENT de type, jamais à l'ouverture.
    const cle = CLE_DELAI_PAR_CADRE[cadre];
    const p = DELAIS_PREREGLES.find((d) => d.cle === cle);
    if (p) {
      changer("delai_paiement_jours", String(p.jours));
      changer("delai_paiement_mode", p.mode);
    }
  }

  function calculerTva() {
    const siren = chiffres(valeurs.siren) || sirenDuSiret(valeurs.siret) || "";
    const tva = tvaIntracomFr(siren);
    if (tva) changer("tva_intracom", tva);
  }

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const lue = valider(schemaSaisieClient);
    if (!lue) return;
    // L'adresse de routage se déduit du SIRET : proposée, et gardée si l'utilisateur n'en a pas dicté une autre.
    const deduite = sections.includes("efacture") && !lue.adresse_electronique_valeur && adresseProposee;
    const saisie = deduite
      ? { ...lue, adresse_electronique_valeur: adresseProposee.valeur, adresse_electronique_schema: lue.adresse_electronique_schema ?? adresseProposee.schema }
      : lue;
    enregistrer.mutate(saisie, { onSuccess: (c) => void navigate(`/clients/${c.id}`) });
  }

  const champ = (nom: keyof typeof valeurs, libelle: string, extra: Partial<Parameters<typeof ChampTexte>[0]> = {}) => (
    <ChampTexte libelle={libelle} valeur={valeurs[nom]} onChange={(v) => changer(nom, v)} erreur={erreurs[nom]} {...extra} />
  );

  return (
    <form onSubmit={soumettre} noValidate className="flex max-w-3xl flex-col gap-4">
      <EnTetePage titre={client ? `Modifier ${client.nom}` : "Nouveau client"} />
      {enregistrer.isError && <Alert variant="erreur">{messageErreur(enregistrer.error)}</Alert>}
      {Object.keys(erreurs).length > 0 && (
        <Alert variant="erreur">Le formulaire contient des erreurs : corrigez les champs signalés.</Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Identité</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <ChampChoix
            libelle="Type de client"
            valeur={valeurs.cadre_facturation}
            onChange={changerCadre}
            options={CADRES_FACTURATION.map((c) => ({ valeur: c.code, libelle: c.libelle }))}
          />
          {champ("nom", "Nom ou raison sociale", { requis: true })}
          {!particulier && champ("siret", "SIRET", { inputMode: "numeric" })}
          {!particulier && champ("siren", "SIREN", { inputMode: "numeric" })}
          {!particulier && (
            <div className="flex items-end gap-2 sm:col-span-2">
              <div className="flex-1">{champ("tva_intracom", "N° de TVA intracommunautaire")}</div>
              <Button variant="outline" onClick={calculerTva} disabled={!chiffres(valeurs.siren) && !sirenDuSiret(valeurs.siret)}>
                Calculer depuis le SIREN
              </Button>
            </div>
          )}
          {sections.includes("pays") && champ("pays_code", "Pays (code)")}
        </CardContent>
      </Card>
      {sections.includes("efacture") && (
        <Card>
          <CardHeader>
            <CardTitle>Facture électronique</CardTitle>
            <p className="text-xs text-muted-foreground">L'adresse électronique se déduit du SIRET. Ne la modifiez que si votre client vous en a communiqué une autre.</p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <ChampChoix
              libelle="Schéma de l'adresse"
              valeur={valeurs.adresse_electronique_schema}
              onChange={(v) => changer("adresse_electronique_schema", v)}
              options={[{ valeur: "", libelle: "—" }, ...SCHEMAS_ADRESSE_ELECTRONIQUE.map((x) => ({ valeur: x.code, libelle: `${x.code} — ${x.libelle}` }))]}
            />
            {champ("adresse_electronique_valeur", "Adresse électronique", { placeholder: adresseProposee ? `${adresseProposee.valeur} (déduite)` : "déduite du SIRET" })}
            {champ("code_routage", "Code de routage", { placeholder: "facultatif" })}
            {champ("reference_acheteur", "Référence acheteur", { placeholder: "réf. interne exigée par le client" })}
          </CardContent>
        </Card>
      )}
      {sections.includes("marche") && (
        <Card>
          <CardHeader>
            <CardTitle>Marché public</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {champ("code_service", "Code service exécutant")}
            {champ("reference_engagement", "N° d'engagement")}
            {champ("numero_marche", "N° de marché")}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Coordonnées</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">{champ("adresse", "Adresse")}</div>
          {champ("code_postal", "Code postal", { inputMode: "numeric" })}
          {champ("ville", "Ville")}
          <VillesProposees codePostal={valeurs.code_postal} ville={valeurs.ville} onChoisir={(v) => changer("ville", v)} />
          {champ("email", "E-mail", { type: "email", inputMode: "email" })}
          {champ("telephone", "Téléphone", { type: "tel", inputMode: "tel" })}
        </CardContent>
      </Card>
      {!particulier && (
        <Card>
          <CardHeader>
            <CardTitle>Service comptabilité</CardTitle>
            <p className="text-xs text-muted-foreground">Destinataire des factures. Les interlocuteurs restent l'annuaire opérationnel du chantier.</p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {champ("contact_nom", "Contact comptabilité")}
            {champ("contact_email", "E-mail comptabilité", { type: "email", inputMode: "email" })}
            {champ("contact_telephone", "Téléphone comptabilité", { type: "tel", inputMode: "tel" })}
          </CardContent>
        </Card>
      )}
      {!particulier && (
        <Card>
          <CardHeader>
            <CardTitle>Adresse de facturation (si différente)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">{champ("facturation_adresse", "Adresse de facturation")}</div>
            {champ("facturation_code_postal", "Code postal de facturation", { inputMode: "numeric" })}
            {champ("facturation_ville", "Ville de facturation")}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Adresse de livraison (si différente)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">{champ("livraison_adresse", "Adresse de livraison")}</div>
          {champ("livraison_code_postal", "Code postal de livraison", { inputMode: "numeric" })}
          {champ("livraison_ville", "Ville de livraison")}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Règlement</CardTitle>
        </CardHeader>
        <CardContent>
          <ChampsDelai
            // Le type de client peut imposer un délai : la liste se recale alors dessus.
            key={valeurs.cadre_facturation}
            jours={valeurs.delai_paiement_jours}
            mode={valeurs.delai_paiement_mode}
            modePaiement={valeurs.mode_paiement}
            erreurJours={erreurs.delai_paiement_jours}
            erreurMode={erreurs.mode_paiement}
            onChange={(c, v) => changer(c, v)}
          />
        </CardContent>
      </Card>
      <ChampZone libelle="Notes internes" valeur={valeurs.notes} onChange={(v) => changer("notes", v)} />
      {/* Informatif, jamais bloquant : ce qui manquera le jour d'émettre (CLI-05). */}
      <Alert variant={manques.length ? "info" : "succes"}>
        {manques.length ? phraseManques(manques) : "✓ Cette fiche est complète pour la facture électronique."}
      </Alert>
      <div className="flex gap-2">
        <Button type="submit" disabled={enregistrer.isPending}>
          {enregistrer.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button variant="ghost" asChild>
          <Link to={client ? `/clients/${client.id}` : "/clients"}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
