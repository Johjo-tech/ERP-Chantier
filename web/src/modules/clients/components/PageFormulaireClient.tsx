import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampChoix, ChampTexte, ChampZone } from "@/components/formulaire/Champ";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { useFormulaire } from "@/lib/useFormulaire";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { CADRES_FACTURATION, saisieDepuis, schemaSaisieClient, type Client } from "../domain/client";
import { CLE_DELAI_PAR_CADRE, DELAIS_PREREGLES } from "../domain/delais";
import { adresseElectroniqueParDefaut, completudeClient, phraseManques, sectionsEfactureVisibles } from "../domain/efacture";
import { chiffres, sirenDuSiret, tvaIntracomFr } from "../domain/identifiants";
import { SCHEMAS_ADRESSE_ELECTRONIQUE } from "@/modules/societes/domain/societe";
import { cadreSuggere } from "@/modules/efacture/domain/cadre";
import { appliquerEtablissement, messageApresRemplissage, type ChampsAnnuaire, type EtablissementTrouve } from "../domain/annuaire";
import { useClient, useEnregistrerClient } from "../hooks/useClients";
import { RechercheSiret, SuggestionsAdresse, SuggestionsEntreprise } from "./Annuaire";
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
  // Les services publics ne s'interrogent que sur une saisie de l'utilisateur, jamais à l'ouverture d'une fiche.
  const [nomTape, setNomTape] = useState(false);
  const [adresseTapee, setAdresseTapee] = useState(false);
  const [apresAnnuaire, setApresAnnuaire] = useState<{ texte: string; alerte: boolean } | null>(null);
  const [cadrePropose, setCadrePropose] = useState<{ cadre: string; motif: string } | null>(null);
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

  /** Un établissement choisi dans l'annuaire (CLI-23) : l'identité s'écrase, TVA et adresse électronique ne remplissent que le vide. */
  function choisirEtablissement(etab: EtablissementTrouve) {
    const actuels: ChampsAnnuaire = {
      nom: valeurs.nom, siret: valeurs.siret, siren: valeurs.siren, adresse: valeurs.adresse, code_postal: valeurs.code_postal, ville: valeurs.ville,
      tva_intracom: valeurs.tva_intracom, adresse_electronique_valeur: valeurs.adresse_electronique_valeur, adresse_electronique_schema: valeurs.adresse_electronique_schema,
    };
    for (const [cle, v] of Object.entries(appliquerEtablissement(actuels, etab))) changer(cle as keyof ChampsAnnuaire, v);
    setNomTape(false);
    setAdresseTapee(false);
    setApresAnnuaire(messageApresRemplissage(etab, formatDateFr));
    // « Acheteur public » : seulement PROPOSÉ — le type de client reste le choix de l'utilisateur.
    const s = cadreSuggere({ paysCode: valeurs.pays_code, natureJuridique: etab.formeJuridique });
    setCadrePropose(s && s.cadre !== valeurs.cadre_facturation ? s : null);
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
          <ChampTexte
            libelle="Nom ou raison sociale"
            valeur={valeurs.nom}
            onChange={(v) => {
              changer("nom", v);
              setNomTape(true);
              setApresAnnuaire(null);
            }}
            erreur={erreurs.nom}
            requis
          />
          {/* Un particulier n'a rien à trouver dans l'annuaire des entreprises (CLI-40). */}
          <SuggestionsEntreprise saisie={valeurs.nom} actif={nomTape && !particulier} onChoisir={choisirEtablissement} />
          {!particulier && champ("siret", "SIRET", { inputMode: "numeric" })}
          {!particulier && champ("siren", "SIREN", { inputMode: "numeric" })}
          {!particulier && <RechercheSiret numero={valeurs.siret || valeurs.siren} onChoisir={choisirEtablissement} message={apresAnnuaire} />}
          {apresAnnuaire && (
            <p role="status" className={`text-xs sm:col-span-2 ${apresAnnuaire.alerte ? "font-semibold text-destructive" : "text-success"}`}>{apresAnnuaire.texte}</p>
          )}
          {cadrePropose && (
            <div className="flex flex-wrap items-center gap-2 text-xs sm:col-span-2">
              <span>{cadrePropose.motif} Type suggéré : {CADRES_FACTURATION.find((c) => c.code === cadrePropose.cadre)?.libelle}.</span>
              <Button type="button" size="sm" variant="outline" onClick={() => { changerCadre(cadrePropose.cadre); setCadrePropose(null); }}>
                Appliquer ce type
              </Button>
            </div>
          )}
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
          <div className="sm:col-span-2">
            <ChampTexte
              libelle="Adresse"
              valeur={valeurs.adresse}
              onChange={(v) => {
                changer("adresse", v);
                setAdresseTapee(true);
              }}
              erreur={erreurs.adresse}
            />
          </div>
          <SuggestionsAdresse
            saisie={valeurs.adresse}
            actif={adresseTapee}
            onChoisir={(a) => {
              changer("adresse", a.adresse);
              changer("code_postal", a.codePostal);
              changer("ville", a.ville);
              setAdresseTapee(false);
            }}
          />
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
