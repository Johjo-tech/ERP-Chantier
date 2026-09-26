import { useId, useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { formatDateFr } from "@/lib/dates";
import { afficherToast } from "@/lib/toast";
import { useFormulaire } from "@/lib/useFormulaire";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { verifierFichierChantier } from "@/modules/chantiers/domain/fichiers";
import { useToastErreur } from "@/modules/materiel/components/communs";
import { useReglagesSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { ACCEPTE_DOCUMENT_VEHICULE, saisieDocumentVierge, schemaSaisieDocument, TYPE_FACTURE_ACHAT, TYPES_DOCUMENT, type DocumentVehicule, type SaisieDocument } from "../domain/documents";
import { etiquetteEcheance } from "../domain/echeances";
import type { Vehicule } from "../domain/vehicule";
import { useAjouterDocument, useDocumentsVehicule, useSupprimerDocument } from "../hooks/useVehicules";
import { LienFichier } from "./LienFichier";

/** Le bouton-fichier de l'ancien écran : un `<label class="btn …">` qui porte un `<input type=file>` caché. */
function BoutonFichier({ libelle, className, enCours, onFichier }: { libelle: string; className: string; enCours: boolean; onFichier: (f: File) => void }) {
  const id = useId();
  return (
    <label className={className} style={{ cursor: "pointer" }} htmlFor={id} aria-disabled={enCours}>
      {libelle}
      <input
        type="file"
        id={id}
        accept={ACCEPTE_DOCUMENT_VEHICULE}
        style={{ display: "none" }}
        disabled={enCours}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const verdict = verifierFichierChantier(f);
          if (verdict.ok) onFichier(f);
          else afficherToast(verdict.motif);
        }}
      />
    </label>
  );
}

/** Décrire une autre pièce (carte grise, assurance, photo…) avant d'en choisir le fichier — ajout de D-VEH-03. */
function AutreDocument({ enCours, onEnvoyer }: { enCours: boolean; onEnvoyer: (s: SaisieDocument, f: File) => void }) {
  const { valeurs, erreurs, changer, valider } = useFormulaire(saisieDocumentVierge());
  return (
    <div className="form-panel" style={{ marginBottom: "8px" }}>
      <div className="field-grid">
        <ChampChoix libelle="Type" valeur={valeurs.type} onChange={(v) => changer("type", v)} options={TYPES_DOCUMENT.map((t) => ({ valeur: t, libelle: t }))} erreur={erreurs.type} />
        <ChampTexte libelle="Intitulé" valeur={valeurs.nom} onChange={(v) => changer("nom", v)} />
        <ChampTexte libelle="Organisme (assureur, garage…)" valeur={valeurs.organisme} onChange={(v) => changer("organisme", v)} />
        <ChampTexte libelle="N° (contrat, police…)" valeur={valeurs.numero_document} onChange={(v) => changer("numero_document", v)} />
        <ChampTexte libelle="Expire le" type="date" valeur={valeurs.date_expiration} onChange={(v) => changer("date_expiration", v)} erreur={erreurs.date_expiration} />
      </div>
      <BoutonFichier
        libelle="📎 Choisir le fichier et l'envoyer"
        className="btn small primary"
        enCours={enCours}
        onFichier={(f) => {
          const s = valider(schemaSaisieDocument);
          if (s) onEnvoyer(s, f);
        }}
      />
    </div>
  );
}

function LigneDocument({ d, seuil, vendu, modifiable, onRetirer }: { d: DocumentVehicule; seuil: number | undefined; vendu: boolean; modifiable: boolean; onRetirer: () => void }) {
  const e = seuil === undefined ? null : etiquetteEcheance(d.date_expiration, seuil, vendu);
  const nom = d.nom || d.fichier_nom || d.type || "Fichier";
  const autre = d.type && d.type !== TYPE_FACTURE_ACHAT;
  return (
    <div className="chantier-file-row">
      {d.fichier_chemin ? <LienFichier chemin={d.fichier_chemin} libelle={`📎 ${nom}`} /> : <span>📎 {nom}</span>}
      <span className="card-sub">
        {autre && `${d.type} · `}
        {formatDateFr(d.date_document)}
        {d.date_expiration && ` · expire le ${formatDateFr(d.date_expiration)}`}
      </span>
      {e && <span className="vehicule-ct-tag">{e.texte}</span>}
      {modifiable && (
        <button type="button" className="btn small danger" aria-label={`Retirer ${nom}`} onClick={onRetirer}>
          ✕
        </button>
      )}
    </div>
  );
}

/**
 * La section « 🧾 Facture d'achat » de la fiche (app.js l. 15014) : « + Ajouter »
 * dépose une facture d'achat en un clic, les fichiers en `.chantier-file-row`.
 * L'ancien `factureAchatFiles` n'avait pas de colonne ; la table accueille aussi
 * carte grise, assurance, photos (« Autre document… », D-VEH-03), avec leur
 * étiquette d'échéance.
 */
export function BlocDocuments({ vehicule }: { vehicule: Vehicule }) {
  const modifiable = usePermission("vehicules", "modifier");
  const documents = useDocumentsVehicule(vehicule.id);
  const ajouter = useAjouterDocument(vehicule.id);
  const supprimer = useSupprimerDocument(vehicule.id);
  useToastErreur(ajouter.error ?? supprimer.error);
  const reglages = useReglagesSociete();
  const seuil = reglages.data?.seuils.vehiculeControle;
  const [autre, setAutre] = useState(false);
  const envoyer = (saisie: SaisieDocument, fichier: File) => ajouter.mutate({ saisie, fichier }, { onSuccess: () => setAutre(false) });

  return (
    <div className="chantier-section">
      <div className="section-title">🧾 Facture d&apos;achat</div>
      {modifiable && (
        <div style={{ marginBottom: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <BoutonFichier libelle="+ Ajouter" className="btn small primary" enCours={ajouter.isPending} onFichier={(f) => envoyer(schemaSaisieDocument.parse(saisieDocumentVierge()), f)} />
          <button type="button" className="btn small ghost" aria-expanded={autre} onClick={() => setAutre((x) => !x)}>
            Autre document…
          </button>
        </div>
      )}
      {autre && <AutreDocument enCours={ajouter.isPending} onEnvoyer={envoyer} />}
      {documents.isPending && <Chargement />}
      {documents.isError && <Erreur erreur={documents.error} reessayer={() => void documents.refetch()} />}
      {documents.isSuccess && !documents.data.length && <div className="empty">Aucun fichier pour l&apos;instant.</div>}
      {documents.isSuccess &&
        documents.data.map((d) => (
          <LigneDocument
            key={d.id}
            d={d}
            seuil={seuil}
            vendu={vehicule.vendu}
            modifiable={modifiable}
            onRetirer={() => {
              if (window.confirm(`Retirer « ${d.nom || d.type || "ce document"} » ?`)) supprimer.mutate(d);
            }}
          />
        ))}
    </div>
  );
}
