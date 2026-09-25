import { useState, type FormEvent } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { useFormulaire } from "@/lib/useFormulaire";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { BoutonDepot } from "@/modules/chantiers/components/Fichiers";
import { useReglagesSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { ACCEPTE_DOCUMENT_VEHICULE, saisieDocumentVierge, schemaSaisieDocument, TYPES_DOCUMENT, type SaisieDocument } from "../domain/documents";
import { etiquetteEcheance } from "../domain/echeances";
import type { Vehicule } from "../domain/vehicule";
import { useAjouterDocument, useDocumentsVehicule, useSupprimerDocument } from "../hooks/useVehicules";
import { LienFichier } from "./LienFichier";

/**
 * Déposer une pièce. Le geste court de l'ancien écran (« + Facture d'achat »)
 * reste en un clic ; les autres documents se décrivent d'abord (type,
 * organisme, échéance), puis le fichier part dès qu'il est choisi.
 */
function Depot({ vehiculeId }: { vehiculeId: string }) {
  const ajouter = useAjouterDocument(vehiculeId);
  const { valeurs, erreurs, changer, valider, reinitialiser } = useFormulaire(saisieDocumentVierge());
  const [detail, setDetail] = useState(false);

  function envoyer(fichier: File, saisie: SaisieDocument | null) {
    if (!saisie) return;
    ajouter.mutate(
      { saisie, fichier },
      {
        onSuccess: () => {
          reinitialiser(saisieDocumentVierge());
          setDetail(false);
        },
      }
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {ajouter.isError && <Alert variant="erreur">{messageErreur(ajouter.error)}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        <BoutonDepot
          libelle="+ Facture d'achat"
          accepte={ACCEPTE_DOCUMENT_VEHICULE}
          enCours={ajouter.isPending}
          onFichier={(f) => envoyer(f, schemaSaisieDocument.parse(saisieDocumentVierge()))}
        />
        <Button size="sm" variant="outline" aria-expanded={detail} onClick={() => setDetail((d) => !d)}>
          Autre document ou photo…
        </Button>
      </div>
      {detail && (
        <form onSubmit={(e: FormEvent) => e.preventDefault()} noValidate aria-label="Décrire le document" className="flex flex-col gap-2 rounded-md border border-border p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <ChampChoix libelle="Type" valeur={valeurs.type} onChange={(v) => changer("type", v)} options={TYPES_DOCUMENT.map((t) => ({ valeur: t, libelle: t }))} erreur={erreurs.type} />
            <ChampTexte libelle="Intitulé" valeur={valeurs.nom} onChange={(v) => changer("nom", v)} />
            <ChampTexte libelle="Organisme (assureur, garage…)" valeur={valeurs.organisme} onChange={(v) => changer("organisme", v)} />
            <ChampTexte libelle="N° (contrat, police…)" valeur={valeurs.numero_document} onChange={(v) => changer("numero_document", v)} />
            <ChampTexte libelle="Expire le" type="date" valeur={valeurs.date_expiration} onChange={(v) => changer("date_expiration", v)} erreur={erreurs.date_expiration} />
          </div>
          <div>
            <BoutonDepot libelle="Choisir le fichier et l'envoyer" accepte={ACCEPTE_DOCUMENT_VEHICULE} enCours={ajouter.isPending} onFichier={(f) => envoyer(f, valider(schemaSaisieDocument))} />
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * Facture d'achat et autres pièces du véhicule (VEH-01) : carte grise,
 * assurance, photos… L'ancien `factureAchatFiles` n'avait pas de colonne.
 * Une pièce qui expire porte l'étiquette d'échéance (seuil des réglages).
 */
export function BlocDocuments({ vehicule }: { vehicule: Vehicule }) {
  const modifiable = usePermission("vehicules", "modifier");
  const documents = useDocumentsVehicule(vehicule.id);
  const supprimer = useSupprimerDocument(vehicule.id);
  const reglages = useReglagesSociete();
  const seuil = reglages.data?.seuils.vehiculeControle;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents et photos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {modifiable && <Depot vehiculeId={vehicule.id} />}
        {supprimer.isError && <Alert variant="erreur">{messageErreur(supprimer.error)}</Alert>}
        {documents.isPending && <Chargement />}
        {documents.isError && <Erreur erreur={documents.error} reessayer={() => void documents.refetch()} />}
        {documents.isSuccess && !documents.data.length && <p className="text-sm text-muted-foreground">Aucun document pour l'instant.</p>}
        {documents.isSuccess && documents.data.length > 0 && (
          <ul className="divide-y divide-border" aria-label="Documents du véhicule">
            {documents.data.map((d) => {
              const e = seuil === undefined ? null : etiquetteEcheance(d.date_expiration, seuil, vehicule.vendu);
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                  <Badge variant="neutre">{d.type || "Document"}</Badge>
                  {d.fichier_chemin ? <LienFichier chemin={d.fichier_chemin} libelle={d.nom || d.fichier_nom || "Fichier"} /> : <span>{d.nom}</span>}
                  <span className="text-xs text-muted-foreground">
                    {[d.organisme, d.numero_document].filter(Boolean).join(" · ")}
                    {d.date_expiration && ` · expire le ${formatDateFr(d.date_expiration)}`}
                  </span>
                  {e && <Badge variant={e.niveau === "danger" ? "danger" : "alerte"}>{e.texte}</Badge>}
                  {modifiable && (
                    <span className="ml-auto">
                      <BoutonConfirme libelle="Retirer" question={`Retirer « ${d.nom || d.type || "ce document"} » ?`} onConfirmer={() => supprimer.mutate(d)} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
