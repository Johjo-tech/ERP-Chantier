import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { libelleDepuisNomFichier, TYPE_HABILITATION, type DocumentRh } from "../domain/documents";
import { useDroitsRh, useGererDossier, useSeuilsRh, type HabilitationEnAttente } from "../hooks/useRh";
import { ChoixFichier } from "./communs";
import { LigneDocument } from "./SectionDossier";

interface Props {
  salarieId: string | null;
  documents: readonly DocumentRh[];
  enAttente: HabilitationEnAttente[];
  onEnAttente: (h: HabilitationEnAttente[]) => void;
}

/**
 * Habilitations et certifications (CACES, habilitation électrique, AIPR).
 * L'ancien bloc écrivait un tableau sans colonne : tout se perdait au
 * rechargement. Elles vont au dossier (type `habilitation`) ; choisies avant
 * l'enregistrement, elles attendent et partent avec la fiche.
 */
export function SectionHabilitations({ salarieId, documents, enAttente, onEnAttente }: Props) {
  const droits = useDroitsRh();
  const seuils = useSeuilsRh();
  const gerer = useGererDossier();
  const deja = documents.filter((d) => d.type === TYPE_HABILITATION);
  const maj = (cle: string, champ: "nom" | "dateExpiration", valeur: string) => onEnAttente(enAttente.map((h) => (h.cle === cle ? { ...h, [champ]: valeur } : h)));
  const ajouter = (fichiers: (File | null)[]) =>
    onEnAttente([...enAttente, ...fichiers.map((fichier) => ({ cle: crypto.randomUUID(), nom: fichier ? libelleDepuisNomFichier(fichier.name) : "", dateExpiration: "", fichier }))]);

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-muted-foreground">Joignez l'attestation (PDF ou image) et sa date de fin de validité : sans elle, aucune alerte ne préviendra de son expiration.</p>
      {deja.length > 0 && (
        <ul className="divide-y divide-border">
          {deja.map((d) => (
            <LigneDocument key={d.id} doc={d} seuil={seuils.habilitation} modifier={null} retirer={droits.supprimer ? () => gerer.supprimerDocument.mutate(d) : null} />
          ))}
        </ul>
      )}
      {enAttente.length > 0 && (
        <ul className="flex flex-col gap-1">
          {enAttente.map((h, i) => (
            <li key={h.cle} className="flex flex-wrap items-center gap-2">
              <Input aria-label={`Intitulé de l'habilitation ${i + 1}`} className="min-w-48 flex-1" value={h.nom} placeholder="Ex : CACES R486, Habilitation électrique B1V…" onChange={(e) => maj(h.cle, "nom", e.target.value)} />
              <Input aria-label={`Fin de validité de l'habilitation ${i + 1}`} type="date" className="w-auto" value={h.dateExpiration} onChange={(e) => maj(h.cle, "dateExpiration", e.target.value)} />
              <span className="text-xs text-muted-foreground">{h.fichier ? `📎 ${h.fichier.name}` : "sans fichier"}</span>
              <Badge variant="alerte" title="Sera déposée à l'enregistrement de la fiche">à déposer</Badge>
              <Button size="sm" variant="ghost" aria-label={`Retirer l'habilitation ${i + 1}`} onClick={() => onEnAttente(enAttente.filter((x) => x.cle !== h.cle))}>✕</Button>
            </li>
          ))}
        </ul>
      )}
      {!deja.length && !enAttente.length && <p className="text-muted-foreground">Aucune habilitation renseignée.</p>}
      {droits.modifier && (
        <div className="flex flex-wrap items-center gap-2">
          <ChoixFichier libelle="Joindre des habilitations" multiple onFichiers={(f) => ajouter(f)} />
          <Button size="sm" variant="outline" onClick={() => ajouter([null])}>+ Sans fichier</Button>
          {!salarieId && <span className="text-xs text-muted-foreground">Elles seront déposées à l'enregistrement de la fiche.</span>}
        </div>
      )}
    </div>
  );
}
