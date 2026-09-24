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
import { CADRES_FACTURATION, saisieDepuis, schemaSaisieClient, type Client } from "../domain/client";
import { CLE_DELAI_PAR_CADRE, DELAIS_PREREGLES } from "../domain/delais";
import { chiffres, sirenDuSiret, tvaIntracomFr } from "../domain/identifiants";
import { useClient, useEnregistrerClient } from "../hooks/useClients";
import { ChampsDelai } from "./ChampsDelai";

export function PageFormulaireClient() {
  const { id } = useParams();
  const client = useClient(id);
  if (id && client.isPending) return <Chargement />;
  if (id && client.isError) return <Erreur erreur={client.error} reessayer={() => void client.refetch()} />;
  return <FormulaireClient key={id ?? "nouveau"} client={client.data ?? null} />;
}

function FormulaireClient({ client }: { client: Client | null }) {
  const navigate = useNavigate();
  const enregistrer = useEnregistrerClient(client?.id);
  const { valeurs, erreurs, changer, valider } = useFormulaire(saisieDepuis(client));
  const particulier = valeurs.cadre_facturation === "B2C";

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
    const saisie = valider(schemaSaisieClient);
    if (!saisie) return;
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
          {champ("pays_code", "Pays (code)")}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Coordonnées</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">{champ("adresse", "Adresse")}</div>
          {champ("code_postal", "Code postal", { inputMode: "numeric" })}
          {champ("ville", "Ville")}
          {champ("email", "E-mail", { type: "email", inputMode: "email" })}
          {champ("telephone", "Téléphone", { type: "tel", inputMode: "tel" })}
          {!particulier && champ("contact_nom", "Contact comptabilité")}
        </CardContent>
      </Card>
      {!particulier && (
        <Card>
          <CardHeader>
            <CardTitle>Adresse de facturation (si différente)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">{champ("facturation_adresse", "Adresse")}</div>
            {champ("facturation_code_postal", "Code postal", { inputMode: "numeric" })}
            {champ("facturation_ville", "Ville")}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Règlement</CardTitle>
        </CardHeader>
        <CardContent>
          <ChampsDelai
            jours={valeurs.delai_paiement_jours}
            mode={valeurs.delai_paiement_mode}
            modePaiement={valeurs.mode_paiement}
            erreurJours={erreurs.delai_paiement_jours}
            onChange={(c, v) => changer(c, v)}
          />
        </CardContent>
      </Card>
      <ChampZone libelle="Notes internes" valeur={valeurs.notes} onChange={(v) => changer("notes", v)} />
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
