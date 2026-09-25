import { useState, type FormEvent } from "react";
import { z } from "zod";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { formatDateFr, todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { useFormulaire } from "@/lib/useFormulaire";
import { useMembres } from "@/modules/comptes/hooks/useComptes";
import { useMetiers } from "@/modules/reglages/hooks/useReglagesEcran";
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
import { useGererIntervenants, useSeuilsRh } from "../hooks/useRh";
import { BoutonPiece, CasesMetiers, ChoixFichier } from "./communs";

interface Props {
  fiche: SousTraitant | null;
  fiches: readonly SousTraitant[];
  documents: readonly DocumentSousTraitant[];
  onFermer: () => void;
}

/** La fiche d'un sous-traitant : identité légale contrôlée, métiers, compte relié (AUTH-44), documents. */
export function FormulaireSousTraitant({ fiche, fiches, documents, onFermer }: Props) {
  const gerer = useGererIntervenants();
  const membres = useMembres();
  const metiers = useMetiers();
  const { valeurs, erreurs, changer, valider } = useFormulaire(valeursSousTraitant(fiche));
  const [coches, setCoches] = useState<string[]>(fiche?.metiers.length ? fiche.metiers : fiche?.metier ? [fiche.metier] : []);
  const comptes = comptesSousTraitantLiables(membres.data ?? [], fiches, fiche?.id ?? null);
  const c = (champ: keyof typeof valeurs) => ({ valeur: valeurs[champ], onChange: (v: string) => changer(champ, v), erreur: erreurs[champ] });

  function soumettre(e: FormEvent) {
    e.preventDefault();
    // Les métiers vivent hors des champs texte du formulaire : ils rejoignent la saisie AVANT la validation.
    const saisie = valider(z.preprocess((v) => ({ ...(v as object), metiers: coches }), schemaSaisieSousTraitant));
    if (saisie) gerer.sousTraitant.mutate({ id: fiche?.id ?? null, saisie }, { onSuccess: onFermer });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={soumettre} noValidate aria-label={fiche ? "Modifier le sous-traitant" : "Nouveau sous-traitant"} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
        <h3 className="font-semibold sm:col-span-2">{fiche ? `Modifier ${fiche.nom}` : "Nouveau sous-traitant"}</h3>
        <div className="sm:col-span-2">
          <ChampTexte libelle="Nom / Entreprise" {...c("nom")} requis placeholder="Ex : SARL Toiture Plus" />
        </div>
        <ChampTexte libelle="SIRET" inputMode="numeric" {...c("siret")} />
        <ChampTexte libelle="SIREN" inputMode="numeric" {...c("siren")} placeholder="9 chiffres" aide="Le SIREN sert à rapprocher les factures que ce sous-traitant vous adresse." />
        <ChampTexte libelle="N° de TVA intracommunautaire" {...c("tvaIntracom")} placeholder="FR…" />
        <ChampTexte libelle="Adresse" {...c("adresse")} />
        <ChampTexte libelle="Code postal" {...c("codePostal")} />
        <ChampTexte libelle="Ville" {...c("ville")} />
        <ChampTexte libelle="Téléphone" type="tel" {...c("telephone")} />
        <ChampTexte libelle="E-mail" type="email" {...c("email")} />
        <ChampTexte libelle="Interlocuteur" {...c("contactNom")} />
        <ChampTexte libelle="E-mail de l'interlocuteur" type="email" {...c("contactEmail")} />
        <div className="sm:col-span-2">
          <ChampChoix
            libelle="Compte relié"
            {...c("contactProfileId")}
            options={[{ valeur: "", libelle: "— Aucun —" }, ...comptes]}
            aide="Le compte (rôle sous-traitant) de l'entreprise : sans lui, elle ne voit ni ses tâches ni ses montants au planning."
          />
        </div>
        <div className="sm:col-span-2">
          <CasesMetiers legende="Métier(s)" referentiel={(metiers.data ?? []).map((m) => m.libelle)} coches={coches} onChange={setCoches} />
        </div>
        {gerer.sousTraitant.isError && <Alert variant="erreur" className="sm:col-span-2">{messageErreur(gerer.sousTraitant.error)}</Alert>}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={gerer.sousTraitant.isPending}>Enregistrer</Button>
          <Button variant="ghost" onClick={onFermer}>Annuler</Button>
        </div>
      </form>
      {fiche ? <DocumentsSousTraitant sousTraitantId={fiche.id} documents={documents} /> : <p className="text-sm text-muted-foreground">💡 Enregistrez d'abord la fiche pour pouvoir ajouter ses documents (décennale, vigilance…).</p>}
    </div>
  );
}

function DocumentsSousTraitant({ sousTraitantId, documents }: { sousTraitantId: string; documents: readonly DocumentSousTraitant[] }) {
  const gerer = useGererIntervenants();
  const seuils = useSeuilsRh();
  const [type, setType] = useState<string>(TYPES_DOC_SOUS_TRAITANT[0]);
  const [date, setDate] = useState("");
  const [fichier, setFichier] = useState<File | null>(null);
  const aujourdHui = todayISO();
  const echec = gerer.ajouterDocument.error ?? gerer.supprimerDocument.error;

  function ajouter(e: FormEvent) {
    e.preventDefault();
    gerer.ajouterDocument.mutate(
      { sousTraitantId, type, dateValidite: date || null, fichier },
      {
        onSuccess: () => {
          setDate("");
          setFichier(null);
        },
      }
    );
  }

  return (
    <section aria-label="Documents du sous-traitant" className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm">
      <h3 className="font-semibold">📑 Documents (décennale, vigilance URSSAF…)</h3>
      <form onSubmit={ajouter} aria-label="Ajouter un document" className="flex flex-wrap items-end gap-2">
        <ChampChoix libelle="Type" valeur={type} onChange={setType} options={TYPES_DOC_SOUS_TRAITANT.map((t) => ({ valeur: t, libelle: t }))} />
        <ChampTexte libelle="Date d'expiration" type="date" valeur={date} onChange={setDate} />
        <ChoixFichier libelle="Fichier" onFichiers={(f) => setFichier(f[0] ?? null)} nomActuel={fichier?.name} />
        <Button type="submit" size="sm" disabled={gerer.ajouterDocument.isPending}>+ Ajouter</Button>
      </form>
      {echec && <Alert variant="erreur">{messageErreur(echec)}</Alert>}
      {documents.length === 0 ? (
        <p className="text-muted-foreground">Aucun document enregistré.</p>
      ) : (
        <ul className="divide-y divide-border">
          {trierDocumentsSousTraitant(documents).map((d) => {
            const alerte = echeanceDocumentSousTraitant(d.dateValidite, aujourdHui, seuils.documentLegal);
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="flex-1">📑 {d.type ?? d.nom}</span>
                <span className="text-xs text-muted-foreground">{d.dateValidite ? `Expire le ${formatDateFr(d.dateValidite)}` : "Sans date d'expiration"}</span>
                {alerte && <Badge variant={alerte.niveau === "expire" ? "danger" : "alerte"}>{alerte.niveau === "expire" ? "EXPIRÉ" : `DANS ${alerte.jours} J`}</Badge>}
                <BoutonPiece chemin={d.fichierChemin} libelle="📎 voir" />
                <BoutonConfirme libelle="✕" question={`Retirer « ${d.type ?? d.nom} » ?`} onConfirmer={() => gerer.supprimerDocument.mutate(d)} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
