import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { schemaNombreFr } from "@/lib/nombres";
import { useFormulaire } from "@/lib/useFormulaire";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { useClients } from "@/modules/clients/hooks/useClients";
import { BlocTotaux } from "@/modules/documents/components/BlocTotaux";
import { ChampsEnteteDocument } from "@/modules/documents/components/ChampsEnteteDocument";
import { SectionLieu } from "@/modules/documents/components/SectionLieu";
import { ChampChoix } from "@/components/formulaire/Champ";
import { EditeurLignes } from "@/modules/documents/components/EditeurLignes";
import type { ChampReferenceLigne } from "@/modules/documents/components/reference";
import { depuisBase, ligneVide, lignesPourEnregistrement, type ErreurLigne, type LigneEdition } from "@/modules/documents/domain/lignes";
import { REGLAGES_DEFAUT, type ReglagesDocuments } from "@/modules/societes/domain/reglages";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import { useConducteurs } from "@/modules/societes/hooks/useConducteurs";
import { conducteurIdDe } from "../domain/liste";
import { EnregistrementPartiel } from "../api/devis";
import { enteteAEnregistrer, LIBELLES_STATUT, schemaSaisieDevis, STATUTS_DEVIS, valeursDepuis, type Devis } from "../domain/devis";
import { useDevis, useEnregistrerDevis } from "../hooks/useDevis";
import { BadgeStatutDevis } from "./BadgeStatutDevis";

export function PageEditionDevis({ actions, ChampReference }: { actions?: (d: Devis) => ReactNode; ChampReference?: ChampReferenceLigne }) {
  const { id } = useParams();
  const devis = useDevis(id);
  const reglages = useReglages();
  // L'annuaire des conducteurs d'abord : un ancien devis n'a que le NOM du sien (DEV-26).
  const conducteurs = useConducteurs();
  if ((id && devis.isPending) || reglages.isPending || conducteurs.isPending) return <Chargement />;
  if (id && devis.isError) return <Erreur erreur={devis.error} reessayer={() => void devis.refetch()} />;
  // Des réglages illisibles ne bloquent pas la saisie : on travaille avec les défauts.
  const d = devis.data ?? null;
  const avecConducteur = d && !d.conducteur_id ? { ...d, conducteur_id: conducteurIdDe(d, conducteurs.data ?? []) || null } : d;
  return <FormulaireDevis key={id ?? "nouveau"} devis={avecConducteur} reglages={reglages.data ?? REGLAGES_DEFAUT} actions={actions} ChampReference={ChampReference} />;
}

interface PropsFormulaire {
  devis: Devis | null;
  reglages: ReglagesDocuments;
  actions?: ((d: Devis) => ReactNode) | undefined;
  ChampReference?: ChampReferenceLigne | undefined;
}

function FormulaireDevis({ devis, reglages, actions, ChampReference }: PropsFormulaire) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const clients = useClients();
  const enregistrer = useEnregistrerDevis(devis?.id);
  const peutEcrire = usePermission("devis", devis ? "modifier" : "creer");
  const lectureSeule = !peutEcrire;
  const { valeurs, erreurs, changer, valider } = useFormulaire(
    valeursDepuis(devis, todayISO(), params.get("chantier") ?? "", params.get("client") ?? "")
  );
  const [lignes, setLignes] = useState<LigneEdition[]>(() =>
    devis?.lignes.length ? devis.lignes.map(depuisBase) : [ligneVide(reglages.tvaDefaut)]
  );
  const [erreursLignes, setErreursLignes] = useState<ErreurLigne[]>([]);
  // Après une création, l'écran passe à l'URL du devis et se remonte : le
  // message de réussite voyage dans l'état de navigation pour ne pas se perdre.
  const location = useLocation();
  const [message, setMessage] = useState<string | null>(() => (location.state as { message?: string } | null)?.message ?? null);

  function soumettre(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const saisie = valider(schemaSaisieDevis);
    const remise = schemaNombreFr.safeParse(valeurs.remise_pourcentage);
    const l = lignesPourEnregistrement(lignes);
    setErreursLignes(l.erreurs);
    const client = clients.data?.find((c) => c.id === saisie?.client_id);
    if (!saisie || !remise.success || l.erreurs.length || !client) {
      if (!remise.success) setMessage("La remise doit être un nombre entre 0 et 100.");
      return;
    }
    const pct = Math.min(100, Math.max(0, remise.data));
    enregistrer.mutate(
      {
        entete: enteteAEnregistrer(saisie, client, pct),
        lignes: l.lignes,
        // Un devis ancien portait parfois le NOM du conducteur sans sa fiche : on le garde (DEV-26).
        conducteurHistorique: devis && !devis.conducteur_id ? devis.conducteur : null,
      },
      {
        onSuccess: (nouvelId) => {
          setMessage("Devis enregistré.");
          if (!devis) void navigate(`/devis/${nouvelId}`, { replace: true, state: { message: "Devis enregistré." } });
        },
        onError: (err) => {
          if (err instanceof EnregistrementPartiel && !devis) void navigate(`/devis/${err.devisId}`, { replace: true });
        },
      }
    );
  }

  return (
    <>
      {/* Les actions de l'en-tête (PDF, e-mail, bon de commande) vivent HORS du formulaire : Entrée dans le panneau e-mail n'enregistre pas le devis. */}
      <EnTetePage
        titre={devis ? `Devis ${devis.numero}` : "Nouveau devis"}
        sousTitre={devis && <BadgeStatutDevis statut={devis.statut} />}
        actions={devis && actions?.(devis)}
      />
      <form onSubmit={soumettre} noValidate className="flex flex-col gap-4">
        {lectureSeule && <Alert>Lecture seule : votre rôle ne permet pas de modifier ce devis.</Alert>}
        {enregistrer.isError && <Alert variant="erreur">{messageErreur(enregistrer.error)}</Alert>}
        {(Object.keys(erreurs).length > 0 || erreursLignes.length > 0) && (
          <Alert variant="erreur">Le devis contient des erreurs : corrigez les champs signalés en rouge.</Alert>
        )}
        {message && <Alert variant={message.startsWith("Devis") ? "succes" : "erreur"}>{message}</Alert>}
        <Card>
          <CardContent className="flex flex-col gap-4 pt-4">
            <ChampsEnteteDocument
              valeurs={valeurs}
              erreurs={erreurs}
              changer={changer}
              conducteurCourant={devis?.conducteur_id ?? null}
              lectureSeule={lectureSeule}
              enPlus={
                <ChampChoix
                  libelle="Statut"
                  valeur={valeurs.statut}
                  desactive={lectureSeule}
                  onChange={(v) => changer("statut", v)}
                  options={STATUTS_DEVIS.map((s) => ({ valeur: s, libelle: LIBELLES_STATUT[s] }))}
                />
              }
            />
            <SectionLieu valeurs={valeurs} changer={changer} lectureSeule={lectureSeule} />
          </CardContent>
        </Card>
        <EditeurLignes
          lignes={lignes}
          onChange={setLignes}
          tvaDefaut={reglages.tvaDefaut}
         
          taux={reglages.tauxTva}
          erreurs={erreursLignes}
          lectureSeule={lectureSeule}
          ChampReference={ChampReference}
        />
        <BlocTotaux lignes={lignes} remise={valeurs.remise_pourcentage} onRemise={lectureSeule ? undefined : (v) => changer("remise_pourcentage", v)} />
        <div className="flex flex-wrap gap-2">
          {!lectureSeule && (
            <Button type="submit" disabled={enregistrer.isPending}>
              {enregistrer.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          )}
          {devis && (
            <Button variant="outline" asChild>
              <Link to={`/devis/${devis.id}/apercu`}>Aperçu / imprimer</Link>
            </Button>
          )}
          <Button variant="ghost" asChild>
            <Link to="/devis">Retour à la liste</Link>
          </Button>
        </div>
      </form>
    </>
  );
}
