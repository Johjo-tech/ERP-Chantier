import { useId, useState, type CSSProperties } from "react";
import { z } from "zod";
import { ChampTexte } from "@/components/formulaire/Champ";
import { formatDateFr, todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { useFormulaire } from "@/lib/useFormulaire";
import type { EtablissementTrouve } from "@/modules/clients/domain/annuaire";
import { useMembres } from "@/modules/comptes/hooks/useComptes";
import { useDefilerVersFormulaire, useToastErreur } from "@/modules/materiel/components/communs";
import { ChampSiret } from "@/modules/reglages/components/ChampsAnnuaire";
import {
  comptesSousTraitantLiables,
  echeanceDocumentSousTraitant,
  schemaSaisieSousTraitant,
  trierDocumentsSousTraitant,
  TYPES_DOC_SOUS_TRAITANT,
  valeursSousTraitant,
  type DocumentSousTraitant,
  type SousTraitant,
} from "../domain/intervenants";
import { useMetiersRh, useGererIntervenants, useSeuilsRh } from "../hooks/useRh";
import { BoutonPiece, CasesMetiers } from "./communs";

interface Props {
  fiche: SousTraitant | null;
  fiches: readonly SousTraitant[];
  documents: readonly DocumentSousTraitant[];
  onFermer: () => void;
}

/**
 * La fiche d'un sous-traitant, au HTML de `sousTraitantForm` (app.js l. 18210) :
 * identité légale contrôlée et recherche dans l'annuaire, coordonnées, métiers,
 * documents. En plus de l'ancien (décidés) : l'interlocuteur et le compte relié
 * (AUTH-44), sans lesquels l'entreprise ne voit pas ses tâches au planning.
 */
export function FormulaireSousTraitant({ fiche, fiches, documents, onFermer }: Props) {
  const gerer = useGererIntervenants();
  const membres = useMembres();
  const metiers = useMetiersRh();
  const { valeurs, changer } = useFormulaire(valeursSousTraitant(fiche));
  const [coches, setCoches] = useState<string[]>(fiche?.metiers.length ? fiche.metiers : fiche?.metier ? [fiche.metier] : []);
  const comptes = comptesSousTraitantLiables(membres.data ?? [], fiches, fiche?.id ?? null);
  const c = (champ: keyof typeof valeurs) => ({ valeur: valeurs[champ], onChange: (v: string) => changer(champ, v) });
  useDefilerVersFormulaire("formZoneSousTraitant");

  function enregistrer() {
    // Les métiers vivent hors des champs texte du formulaire : ils rejoignent la saisie AVANT la validation.
    const r = z.preprocess((v) => ({ ...(v as object), metiers: coches }), schemaSaisieSousTraitant).safeParse(valeurs);
    if (!r.success) {
      window.alert(r.error.issues.map((i) => i.message).join("\n"));
      return;
    }
    gerer.sousTraitant.mutate(
      { id: fiche?.id ?? null, saisie: r.data },
      { onSuccess: () => { onFermer(); afficherToast(fiche ? "Sous-traitant modifié." : "Sous-traitant créé.", "success"); }, onError: (e) => afficherToast(messageErreur(e)) }
    );
  }

  function depuisAnnuaire(e: EtablissementTrouve) {
    changer("siret", e.siret);
    changer("nom", e.nom);
    changer("adresse", e.adresse);
    changer("codePostal", e.codePostal);
    changer("ville", e.ville);
    changer("siren", e.siren);
    if (e.tvaIntracom && !valeurs.tvaIntracom.trim()) changer("tvaIntracom", e.tvaIntracom);
  }

  return (
    <div className="form-panel" role="form" aria-label={fiche ? "Modifier le sous-traitant" : "Nouveau sous-traitant"}>
      <h3>{fiche ? "Modifier le sous-traitant" : "Nouveau sous-traitant"}</h3>
      <div className="field-grid">
        <ChampTexte className="full" libelle="Nom / Entreprise" {...c("nom")} placeholder="Ex : SARL Toiture Plus" />
        <ChampSiret id="st_siret" valeur={valeurs.siret} desactive={false} onChange={(v) => changer("siret", v)} onEtablissement={depuisAnnuaire} />
        <ChampTexte libelle="SIREN" inputMode="numeric" {...c("siren")} placeholder="9 chiffres" />
        <ChampTexte libelle="N° de TVA intracommunautaire" {...c("tvaIntracom")} placeholder="FR…" />
        <div className="field full">
          <small style={{ color: "var(--text-dim)", fontSize: "11px" }}>Le SIREN sert à rapprocher automatiquement les factures que ce sous-traitant vous adresse.</small>
        </div>
        <ChampTexte className="full" libelle="Adresse" {...c("adresse")} />
        <ChampTexte libelle="Code postal" {...c("codePostal")} />
        <ChampTexte libelle="Ville" {...c("ville")} />
        <ChampTexte libelle="Téléphone" type="tel" {...c("telephone")} />
        <ChampTexte libelle="Email" type="email" {...c("email")} />
        <div className="field full">
          <label>Métier(s)</label>
          <CasesMetiers legende="Métier(s)" referentiel={metiers.data} coches={coches} onChange={setCoches} />
        </div>
        <ChampTexte libelle="Interlocuteur" {...c("contactNom")} />
        <ChampTexte libelle="E-mail de l'interlocuteur" type="email" {...c("contactEmail")} />
        <div className="field full">
          <label htmlFor="st_compte">Compte relié</label>
          <select id="st_compte" value={valeurs.contactProfileId} onChange={(e) => changer("contactProfileId", e.target.value)}>
            {[{ valeur: "", libelle: "— Aucun —" }, ...comptes].map((o) => (
              <option key={o.valeur} value={o.valeur}>
                {o.libelle}
              </option>
            ))}
          </select>
          <div className="card-sub" style={{ marginTop: "4px" }}>
            Le compte (rôle sous-traitant) de l&apos;entreprise : sans lui, elle ne voit ni ses tâches ni ses montants au planning.
          </div>
        </div>
      </div>
      {fiche ? (
        <DocumentsSousTraitant sousTraitantId={fiche.id} documents={documents} />
      ) : (
        <div className="card-sub" style={{ marginTop: "14px" }}>
          💡 Enregistrez d&apos;abord la fiche pour pouvoir ajouter ses documents (décennale, vigilance…).
        </div>
      )}
      <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
        <button type="button" className="btn primary" disabled={gerer.sousTraitant.isPending} onClick={enregistrer}>
          Enregistrer
        </button>
        <button type="button" className="btn ghost" onClick={onFermer}>
          Annuler
        </button>
      </div>
    </div>
  );
}

/** Vert tant que la pièce vaut, orangé à l'approche, rouge une fois expirée. */
const COULEURS = { aucune: "#5BC97A", bientot: "#F0A82E", expire: "#EF5A6F" } as const;

function DocumentsSousTraitant({ sousTraitantId, documents }: { sousTraitantId: string; documents: readonly DocumentSousTraitant[] }) {
  const gerer = useGererIntervenants();
  const seuils = useSeuilsRh();
  const idFichier = useId();
  const [type, setType] = useState<string>(TYPES_DOC_SOUS_TRAITANT[0]);
  const [date, setDate] = useState("");
  const [fichier, setFichier] = useState<File | null>(null);
  const aujourdHui = todayISO();
  useToastErreur(gerer.ajouterDocument.error ?? gerer.supprimerDocument.error);

  function ajouter() {
    gerer.ajouterDocument.mutate(
      { sousTraitantId, type, dateValidite: date || null, fichier },
      {
        onSuccess: () => {
          setDate("");
          setFichier(null);
          afficherToast("Document enregistré.", "success");
        },
      }
    );
  }

  return (
    <>
      <div className="chantier-subsection-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px" }}>
        <span>📑 Documents (décennale, vigilance URSSAF…)</span>
      </div>
      <div className="entretien-add-row" role="group" aria-label="Ajouter un document">
        <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES_DOC_SOUS_TRAITANT.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input type="date" aria-label="Date d'expiration" placeholder="Date d'expiration" value={date} onChange={(e) => setDate(e.target.value)} />
        <label className="btn small" style={{ cursor: "pointer" }} htmlFor={idFichier} title={fichier?.name}>
          📎 Fichier
          <input type="file" id={idFichier} accept=".pdf,image/*" style={{ display: "none" }} onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />
        </label>
        <button type="button" className="btn primary" disabled={gerer.ajouterDocument.isPending} onClick={ajouter}>
          + Ajouter
        </button>
      </div>
      <div className="achats-list" style={{ marginTop: "10px" }}>
        {documents.length === 0 ? (
          <div className="empty">Aucun document enregistré.</div>
        ) : (
          trierDocumentsSousTraitant(documents).map((d) => {
            const alerte = echeanceDocumentSousTraitant(d.dateValidite, aujourdHui, seuils.documentLegal);
            const couleur = COULEURS[alerte?.niveau ?? "aucune"];
            return (
              <div key={d.id} className="achat-row" style={{ "--cat-color": couleur } as CSSProperties}>
                <div className="achat-row-icon" style={{ background: `${couleur}22`, color: couleur }}>
                  📑
                </div>
                <div className="achat-row-main">
                  <div className="achat-designation">
                    {d.type ?? d.nom}
                    {d.fichierChemin && (
                      <>
                        {" · "}
                        <BoutonPiece chemin={d.fichierChemin} libelle="📎 voir" />
                      </>
                    )}
                  </div>
                  <div className="achat-date">
                    {d.dateValidite ? `Expire le ${formatDateFr(d.dateValidite)}` : "Sans date d\u2019expiration"}
                    {alerte && (
                      <>
                        {" "}
                        <span className={`badge ${alerte.niveau === "expire" ? "danger" : "warn"}`}>{alerte.niveau === "expire" ? "EXPIRÉ" : `DANS ${alerte.jours} J`}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn small danger"
                  aria-label={`Retirer ${d.type ?? d.nom}`}
                  onClick={() => {
                    if (window.confirm(`Retirer « ${d.type ?? d.nom} » ?`)) gerer.supprimerDocument.mutate(d);
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
