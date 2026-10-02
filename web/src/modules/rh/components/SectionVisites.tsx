import { useEffect, useState } from "react";
import { formatDateFr, todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { useToastErreur } from "@/modules/materiel/components/communs";
import { avisAptitude, derniereVisite, regimeSuivi, trierVisites, typeVisite, visiteParDefaut, type SaisieVisite, type VisiteMedicale } from "../domain/visites";
import { useDroitsRh, useGererDossier, useSeuilsRh, type VisiteEnAttente } from "../hooks/useRh";
import { EcheanceVisite } from "./BadgeVisite";
import { BoutonPiece } from "./communs";
import { FormulaireVisite, type ValeursVisite } from "./FormulaireVisite";

/** Les couleurs de l'avis rendu (`visiteRhRowHTML`) : inapte en rouge, réserves en orangé, apte en vert. */
const COULEUR_AVIS = { ok: "#15803d", warn: "#a56200", danger: "#a30f22" } as const;

interface Props {
  salarieId: string | null;
  visites: readonly VisiteMedicale[];
  /** L'échéance de la fiche (colonne tenue par la base) : elle fait foi, même sans registre. */
  prochaine: string | null;
  /** Fiche neuve : les visites attendent la fiche (la RLS du registre lit `salaries`). */
  enAttente?: VisiteEnAttente[];
  onEnAttente?: (v: VisiteEnAttente[]) => void;
  /** Un panneau de visite ouvert n'est pas une visite : la fiche refuse de s'enregistrer par-dessus. */
  onEdition?: (ouverte: boolean) => void;
}

function versValeurs(v: VisiteMedicale | SaisieVisite): ValeursVisite {
  return {
    dateVisite: v.dateVisite,
    type: v.type,
    suivi: v.suivi,
    organisme: v.organisme ?? "",
    medecin: v.medecin ?? "",
    avis: v.avis ?? "",
    reserves: v.reserves ?? "",
    prochaineVisite: v.prochaineVisite ?? "",
    notes: v.notes ?? "",
  };
}

/** L'en-tête du registre : l'échéance, ou ce qu'une fiche neuve a en attente (`visitesMedicalesHTML`). */
function Entete({ salarieId, prochaine, seuil, nbAttente }: { salarieId: string | null; prochaine: string | null; seuil: number; nbAttente: number }) {
  if (salarieId) return <EcheanceVisite prochaine={prochaine} seuil={seuil} />;
  if (nbAttente) return <span className="badge warn">{nbAttente} visite{nbAttente > 1 ? "s" : ""} à enregistrer avec la fiche</span>;
  return <span className="card-sub">Saisissez ici la visite d&apos;embauche : elle partira avec la fiche.</span>;
}

/**
 * Le registre des visites d'un salarié (RH-07), au HTML de `visitesMedicalesHTML`
 * (rh-visites.js l. 254) : son état, son historique, de quoi compléter.
 */
export function SectionVisites({ salarieId, visites, prochaine, enAttente = [], onEnAttente, onEdition }: Props) {
  const droits = useDroitsRh();
  const seuils = useSeuilsRh();
  const gerer = useGererDossier();
  useToastErreur(gerer.supprimerVisite.error);
  const [edition, setEdition] = useState<VisiteMedicale | VisiteEnAttente | "nouvelle" | null>(null);
  const triees = trierVisites(visites);
  useEffect(() => onEdition?.(edition !== null), [edition, onEdition]);
  const mutation = edition && edition !== "nouvelle" && "id" in edition ? gerer.modifierVisite : gerer.ajouterVisite;

  function enregistrer(saisie: SaisieVisite, fichier: File | null) {
    if (!salarieId) {
      const cle = edition && edition !== "nouvelle" && "cle" in edition ? edition.cle : crypto.randomUUID();
      const garde = edition && edition !== "nouvelle" && "cle" in edition && !fichier ? edition.fichier : fichier;
      onEnAttente?.([...enAttente.filter((v) => v.cle !== cle), { cle, saisie, fichier: garde }]);
      return setEdition(null);
    }
    const fini = { onSuccess: () => setEdition(null), onError: (e: unknown) => afficherToast(messageErreur(e)) };
    if (edition && edition !== "nouvelle" && "id" in edition) gerer.modifierVisite.mutate({ visite: edition, saisie, fichier }, fini);
    else gerer.ajouterVisite.mutate({ salarieId, saisie, fichier }, fini);
  }

  const initiales = !edition || edition === "nouvelle" ? visiteParDefaut(derniereVisite(visites), todayISO()) : versValeurs("id" in edition ? edition : edition.saisie);
  const echeanceDecidee = !!edition && edition !== "nouvelle" && !!("id" in edition ? edition.prochaineVisite : edition.saisie.prochaineVisite);
  const vide = triees.length === 0 && enAttente.length === 0;

  return (
    <>
      <div className="card-sub">
        <Entete salarieId={salarieId} prochaine={prochaine} seuil={seuils.visiteMedicale} nbAttente={enAttente.length} />
      </div>
      <div style={{ marginTop: "10px" }}>
        {vide && (
          <div className="empty">
            {salarieId && prochaine
              ? "Échéance reprise de l'ancienne saisie, sans visite au registre : ni type, ni avis, ni attestation. Enregistrez la prochaine visite pour repartir sur du solide."
              : "Aucune visite enregistrée. Ce salarié n'a pas de suivi médical traçable."}
          </div>
        )}
        {triees.map((v) => (
          <LigneVisite
            key={v.id}
            v={v}
            modifier={droits.modifier ? () => setEdition(v) : null}
            retirer={
              droits.supprimer
                ? () => {
                    if (window.confirm("Retirer cette visite du registre ? L'attestation sera supprimée.")) gerer.supprimerVisite.mutate(v);
                  }
                : null
            }
          />
        ))}
        {enAttente.map((v) => {
          const t = typeVisite(v.saisie.type);
          const avis = avisAptitude(v.saisie.avis);
          return (
            <div key={v.cle} className="chantier-file-row">
              <span style={{ flex: 1, minWidth: 0 }}>
                {t.icone} <strong>{t.libelle}</strong> <span className="card-sub">du {formatDateFr(v.saisie.dateVisite)}</span>
                {avis && <span className="card-sub"> · {avis.libelle}</span>}
              </span>
              <span className="card-sub">{v.saisie.prochaineVisite ? `→ ${formatDateFr(v.saisie.prochaineVisite)}` : "sans échéance"}</span>
              <span className="card-sub">{v.fichier ? `📎 ${v.fichier.name}` : "sans attestation"}</span>
              <span className="badge warn" title="Sera enregistrée au registre à l'enregistrement de la fiche">
                à déposer
              </span>
              <button type="button" className="btn small" onClick={() => setEdition(v)}>
                Modifier
              </button>
              <button type="button" className="btn small danger" aria-label="Retirer la visite en attente" onClick={() => onEnAttente?.(enAttente.filter((x) => x.cle !== v.cle))}>
                ✕
              </button>
            </div>
          );
        })}
      </div>
      {droits.modifier &&
        (edition ? (
          <FormulaireVisite
            key={edition === "nouvelle" ? "nouvelle" : "id" in edition ? edition.id : edition.cle}
            titre={edition === "nouvelle" ? "Enregistrer une visite médicale" : "Modifier la visite"}
            initiales={initiales}
            echeanceDecidee={echeanceDecidee}
            nomFichier={edition === "nouvelle" ? null : "id" in edition ? (edition.fichierNom ?? null) : (edition.fichier?.name ?? null)}
            enCours={mutation.isPending}
            onEnregistrer={enregistrer}
            onFermer={() => setEdition(null)}
          />
        ) : (
          <button type="button" className="btn small primary" style={{ marginTop: "10px" }} onClick={() => setEdition("nouvelle")}>
            + Enregistrer une visite
          </button>
        ))}
    </>
  );
}

/** Une visite du registre (`visiteRhRowHTML`, rh-visites.js l. 207). */
function LigneVisite({ v, modifier, retirer }: { v: VisiteMedicale; modifier: (() => void) | null; retirer: (() => void) | null }) {
  const t = typeVisite(v.type);
  const avis = avisAptitude(v.avis);
  const details = [regimeSuivi(v.suivi).libelle, v.organisme, v.medecin].filter(Boolean).join(" · ");
  return (
    <div className="chantier-file-row">
      <span style={{ flex: 1, minWidth: 0 }}>
        {t.icone} <strong>{t.libelle}</strong> <span className="card-sub">du {formatDateFr(v.dateVisite)}</span>
        {avis && <span style={{ color: COULEUR_AVIS[avis.gravite], fontWeight: 700 }}> · {avis.libelle}</span>}
        {details && <span className="card-sub">{details}</span>}
        {v.reserves && <span className="card-sub">⚠ {v.reserves}</span>}
        {v.notes && <span className="card-sub">📝 {v.notes}</span>}
      </span>
      <span className="card-sub">{v.prochaineVisite ? `→ ${formatDateFr(v.prochaineVisite)}` : "sans échéance"}</span>
      <BoutonPiece chemin={v.fichierChemin ?? null} libelle="📎 Attestation" absent="sans attestation" />
      {modifier && (
        <button type="button" className="btn small" onClick={modifier}>
          Modifier
        </button>
      )}
      {retirer && (
        <button type="button" className="btn small danger" aria-label="Retirer cette visite" onClick={retirer}>
          ✕
        </button>
      )}
    </div>
  );
}
