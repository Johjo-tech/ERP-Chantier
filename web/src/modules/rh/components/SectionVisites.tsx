import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { formatDateFr, todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { avisAptitude, derniereVisite, regimeSuivi, trierVisites, typeVisite, visiteParDefaut, type SaisieVisite, type VisiteMedicale } from "../domain/visites";
import { useDroitsRh, useGererDossier, useSeuilsRh, type VisiteEnAttente } from "../hooks/useRh";
import { BoutonPiece } from "./communs";
import { EcheanceVisite } from "./BadgeVisite";
import { FormulaireVisite, type ValeursVisite } from "./FormulaireVisite";

const COULEUR_AVIS = { ok: "text-success", warn: "text-foreground", danger: "text-destructive" } as const;

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

/** Le registre des visites d'un salarié (RH-07) : son état, son historique, de quoi compléter. */
export function SectionVisites({ salarieId, visites, prochaine, enAttente = [], onEnAttente, onEdition }: Props) {
  const droits = useDroitsRh();
  const seuils = useSeuilsRh();
  const gerer = useGererDossier();
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
    if (edition && edition !== "nouvelle" && "id" in edition) gerer.modifierVisite.mutate({ visite: edition, saisie, fichier }, { onSuccess: () => setEdition(null) });
    else gerer.ajouterVisite.mutate({ salarieId, saisie, fichier }, { onSuccess: () => setEdition(null) });
  }

  const initiales = !edition || edition === "nouvelle" ? visiteParDefaut(derniereVisite(visites), todayISO()) : versValeurs("id" in edition ? edition : edition.saisie);
  const echeanceDecidee = !!edition && edition !== "nouvelle" && !!("id" in edition ? edition.prochaineVisite : edition.saisie.prochaineVisite);

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div>
        {salarieId ? (
          <EcheanceVisite prochaine={prochaine} seuil={seuils.visiteMedicale} />
        ) : enAttente.length ? (
          <Badge variant="alerte">{enAttente.length} visite{enAttente.length > 1 ? "s" : ""} à enregistrer avec la fiche</Badge>
        ) : (
          <span className="text-muted-foreground">Saisissez ici la visite d'embauche : elle partira avec la fiche.</span>
        )}
      </div>
      {gerer.supprimerVisite.isError && <Alert variant="erreur">{messageErreur(gerer.supprimerVisite.error)}</Alert>}
      {triees.length === 0 && enAttente.length === 0 ? (
        <p className="text-muted-foreground">
          {salarieId && prochaine
            ? "Échéance reprise de l'ancienne saisie, sans visite au registre : ni type, ni avis, ni attestation. Enregistrez la prochaine visite pour repartir sur du solide."
            : "Aucune visite enregistrée. Ce salarié n'a pas de suivi médical traçable."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {triees.map((v) => (
            <LigneVisite key={v.id} v={v} modifier={droits.modifier ? () => setEdition(v) : null} retirer={droits.supprimer ? () => gerer.supprimerVisite.mutate(v) : null} />
          ))}
          {enAttente.map((v) => (
            <li key={v.cle} className="flex flex-wrap items-center gap-2 py-1.5">
              <span className="flex-1">{typeVisite(v.saisie.type).icone} <strong>{typeVisite(v.saisie.type).libelle}</strong> du {formatDateFr(v.saisie.dateVisite)}</span>
              <span className="text-xs text-muted-foreground">{v.saisie.prochaineVisite ? `→ ${formatDateFr(v.saisie.prochaineVisite)}` : "sans échéance"} · {v.fichier ? `📎 ${v.fichier.name}` : "sans attestation"}</span>
              <Badge variant="alerte" title="Sera enregistrée au registre à l'enregistrement de la fiche">à déposer</Badge>
              <Button size="sm" variant="outline" onClick={() => setEdition(v)}>Modifier</Button>
              <Button size="sm" variant="ghost" aria-label="Retirer la visite en attente" onClick={() => onEnAttente?.(enAttente.filter((x) => x.cle !== v.cle))}>✕</Button>
            </li>
          ))}
        </ul>
      )}
      {droits.modifier &&
        (edition ? (
          <FormulaireVisite
            key={edition === "nouvelle" ? "nouvelle" : "id" in edition ? edition.id : edition.cle}
            titre={edition === "nouvelle" ? "Enregistrer une visite médicale" : "Modifier la visite"}
            initiales={initiales}
            echeanceDecidee={echeanceDecidee}
            nomFichier={edition === "nouvelle" ? null : "id" in edition ? (edition.fichierNom ?? null) : (edition.fichier?.name ?? null)}
            enCours={mutation.isPending}
            erreur={mutation.isError ? messageErreur(mutation.error) : null}
            onEnregistrer={enregistrer}
            onFermer={() => setEdition(null)}
          />
        ) : (
          <div>
            <Button size="sm" onClick={() => setEdition("nouvelle")}>+ Enregistrer une visite</Button>
          </div>
        ))}
    </div>
  );
}

function LigneVisite({ v, modifier, retirer }: { v: VisiteMedicale; modifier: (() => void) | null; retirer: (() => void) | null }) {
  const t = typeVisite(v.type);
  const avis = avisAptitude(v.avis);
  const details = [regimeSuivi(v.suivi).libelle, v.organisme, v.medecin].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-wrap items-center gap-2 py-1.5">
      <span className="min-w-0 flex-1">
        {t.icone} <strong>{t.libelle}</strong> <span className="text-xs text-muted-foreground">du {formatDateFr(v.dateVisite)}</span>
        {avis && <span className={`font-semibold ${COULEUR_AVIS[avis.gravite]}`}> · {avis.libelle}</span>}
        {details && <span className="block text-xs text-muted-foreground">{details}</span>}
        {v.reserves && <span className="block text-xs text-muted-foreground">⚠ {v.reserves}</span>}
        {v.notes && <span className="block text-xs text-muted-foreground">📝 {v.notes}</span>}
      </span>
      <span className="text-xs text-muted-foreground">{v.prochaineVisite ? `→ ${formatDateFr(v.prochaineVisite)}` : "sans échéance"}</span>
      <BoutonPiece chemin={v.fichierChemin ?? null} libelle="📎 Attestation" />
      {modifier && <Button size="sm" variant="outline" onClick={modifier}>Modifier</Button>}
      {retirer && <BoutonConfirme libelle="✕" question="Retirer cette visite du registre ? L'attestation sera supprimée." onConfirmer={retirer} />}
    </li>
  );
}
