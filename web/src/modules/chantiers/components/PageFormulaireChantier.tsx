import { type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampChoix, ChampTexte, ChampZone } from "@/components/formulaire/Champ";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { useFormulaire } from "@/lib/useFormulaire";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { useClients } from "@/modules/clients/hooks/useClients";
import { optionsConducteurs, useConducteurs } from "@/modules/societes/hooks/useConducteurs";
import { libelleStatutChantier, saisieDepuis, schemaSaisieChantier, STATUTS_CHANTIER, TYPES_CHANTIER, type Chantier } from "../domain/chantier";
import { useChantier, useEnregistrerChantier } from "../hooks/useChantiers";

export function PageFormulaireChantier() {
  const { id } = useParams();
  const chantier = useChantier(id);
  if (id && chantier.isPending) return <Chargement />;
  if (id && chantier.isError) return <Erreur erreur={chantier.error} reessayer={() => void chantier.refetch()} />;
  const f = <FormulaireChantier key={id ?? "nouveau"} chantier={chantier.data ?? null} />;
  return chantier.data ? <GardeSociete societeId={chantier.data.societe_id} retour="/chantiers">{f}</GardeSociete> : f;
}

function FormulaireChantier({ chantier }: { chantier: Chantier | null }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const enregistrer = useEnregistrerChantier(chantier?.id);
  const clients = useClients();
  const conducteurs = useConducteurs();
  const initiales = saisieDepuis(chantier);
  if (!chantier && params.get("client")) initiales.client_id = params.get("client") ?? "";
  const { valeurs, erreurs, changer, valider } = useFormulaire(initiales);

  function choisirClient(id: string) {
    changer("client_id", id);
    // Nouveau chantier : l'adresse du client sert de point de départ, jamais d'écrasement.
    const c = clients.data?.find((x) => x.id === id);
    if (c && !valeurs.adresse && !valeurs.ville) {
      changer("adresse", c.adresse ?? "");
      changer("code_postal", c.code_postal ?? "");
      changer("ville", c.ville ?? "");
    }
  }

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const s = valider(schemaSaisieChantier);
    if (!s) return;
    // Un client absent de la liste (autre société, lien fabriqué) n'est pas rattaché.
    const clientConnu = !s.client_id || (clients.data ?? []).some((c) => c.id === s.client_id);
    enregistrer.mutate({ ...s, client_id: clientConnu ? s.client_id : null }, { onSuccess: (c) => void navigate(`/chantiers/${c.id}`) });
  }

  const texte = (nom: keyof typeof valeurs, libelle: string, extra: { type?: string; requis?: boolean } = {}) => (
    <ChampTexte libelle={libelle} valeur={valeurs[nom]} onChange={(v) => changer(nom, v)} erreur={erreurs[nom]} {...extra} />
  );

  return (
    <form onSubmit={soumettre} noValidate className="flex max-w-3xl flex-col gap-4">
      <EnTetePage titre={chantier ? `Modifier ${chantier.nom}` : "Nouveau chantier"} />
      {enregistrer.isError && <Alert variant="erreur">{messageErreur(enregistrer.error)}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">{texte("nom", "Nom du chantier", { requis: true })}</div>
        <ChampChoix
          libelle="Client"
          valeur={valeurs.client_id}
          onChange={choisirClient}
          options={[{ valeur: "", libelle: clients.isPending ? "Chargement…" : "— Aucun —" }, ...(clients.data ?? []).map((c) => ({ valeur: c.id, libelle: c.nom }))]}
        />
        <ChampChoix
          libelle="Conducteur de travaux"
          valeur={valeurs.conducteur_id}
          onChange={(v) => changer("conducteur_id", v)}
          options={[{ valeur: "", libelle: "— Aucun —" }, ...optionsConducteurs(conducteurs.data ?? [], chantier?.conducteur_id ?? null)]}
        />
        <div className="sm:col-span-2">{texte("adresse", "Adresse du chantier")}</div>
        {texte("code_postal", "Code postal")}
        {texte("ville", "Ville")}
        <ChampChoix
          libelle="Type"
          valeur={valeurs.type}
          onChange={(v) => changer("type", v)}
          options={[
            ...TYPES_CHANTIER.map((t) => ({ valeur: t.code, libelle: t.libelle })),
            // Un type historique hors liste reste affiché plutôt que perdu.
            ...(valeurs.type && !TYPES_CHANTIER.some((t) => t.code === valeurs.type) ? [{ valeur: valeurs.type, libelle: valeurs.type }] : []),
          ]}
        />
        <ChampChoix
          libelle="Statut"
          valeur={valeurs.statut}
          onChange={(v) => changer("statut", v)}
          erreur={erreurs.statut}
          options={STATUTS_CHANTIER.map((s) => ({ valeur: s, libelle: libelleStatutChantier(s) }))}
        />
        {texte("date_debut", "Début", { type: "date" })}
        {texte("date_fin", "Fin prévue", { type: "date" })}
        <div className="sm:col-span-2">{texte("notes", "Notes")}</div>
      </div>
      <ChampZone libelle="Informations diverses" valeur={valeurs.infos_diverses} onChange={(v) => changer("infos_diverses", v)} />
      <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-semibold">Informations PPSPS (facultatif)</legend>
        <p className="text-xs text-muted-foreground">Utilisées pour générer le PPSPS de ce chantier (fiche › Documents › Sécurité).</p>
        {texte("ppsps_lot", "Lot")}
        <div className="grid gap-3 sm:grid-cols-2">
          <ChampZone libelle="Maître de l'ouvrage (si différent du client)" valeur={valeurs.ppsps_maitre_ouvrage} onChange={(v) => changer("ppsps_maitre_ouvrage", v)} />
          <ChampZone libelle="Maître d'œuvre" valeur={valeurs.ppsps_maitre_oeuvre} onChange={(v) => changer("ppsps_maitre_oeuvre", v)} />
          <ChampZone libelle="Coordonnateur S.P.S." valeur={valeurs.ppsps_coordinateur_sps} onChange={(v) => changer("ppsps_coordinateur_sps", v)} />
          {texte("ppsps_effectif_moyen", "Effectif moyen prévisible")}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" disabled={enregistrer.isPending}>
          {enregistrer.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button variant="ghost" asChild>
          <Link to={chantier ? `/chantiers/${chantier.id}` : "/chantiers"}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
