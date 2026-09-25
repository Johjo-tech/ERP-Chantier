import { useId, useState, type ChangeEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { refusPieceJointe } from "@/modules/commandes/domain/pieceJointe";
import type { Pastille } from "../domain/documents";
import { useLienPiece } from "../hooks/useRh";

const PASTILLES: Record<Pastille, { signe: string; titre: string; classe: string }> = {
  ok: { signe: "✓", titre: "Au dossier", classe: "bg-success/15 text-success" },
  bientot: { signe: "~", titre: "Expire bientôt", classe: "bg-warning/25 text-foreground" },
  sansDate: { signe: "?", titre: "Sans date de fin de validité", classe: "bg-warning/25 text-foreground" },
  expire: { signe: "!", titre: "Expiré", classe: "bg-destructive/15 text-destructive" },
  manquant: { signe: "✕", titre: "Manquant", classe: "bg-destructive/15 text-destructive" },
};

/** Une case du tableau de conformité : le signe se lit, le titre se dit (lecteur d'écran). */
export function PastilleRh({ etat, titre }: { etat: Pastille; titre?: string }) {
  const p = PASTILLES[etat];
  return (
    <span role="img" aria-label={titre ?? p.titre} title={titre ?? p.titre} className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold ${p.classe}`}>
      {p.signe}
    </span>
  );
}

/**
 * Choisir un fichier : PDF, JPEG, PNG ou WebP (mêmes règles que toute pièce
 * jointe — un seul refus possible, les mêmes mots pour l'expliquer).
 */
export function ChoixFichier({ libelle, onFichiers, multiple = false, nomActuel }: { libelle: string; onFichiers: (f: File[]) => void; multiple?: boolean; nomActuel?: string | null | undefined }) {
  const id = useId();
  const [refus, setRefus] = useState<string | null>(null);
  function choisir(e: ChangeEvent<HTMLInputElement>) {
    const fichiers = Array.from(e.target.files ?? []);
    e.target.value = "";
    const motifs: string[] = [];
    const acceptes: File[] = [];
    for (const f of fichiers) {
      const motif = refusPieceJointe(f);
      if (motif) motifs.push(`${f.name} : ${motif}`);
      else acceptes.push(f);
    }
    setRefus(motifs.length ? motifs.join(" ") : null);
    // En un seul appel : plusieurs appels successifs liraient chacun la liste d'avant.
    if (acceptes.length) onFichiers(acceptes);
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="inline-flex h-8 cursor-pointer items-center rounded-md bg-secondary px-3 text-xs font-medium hover:bg-secondary/80">
        📎 {libelle}
      </label>
      <input id={id} type="file" accept=".pdf,image/*" multiple={multiple} className="sr-only" onChange={choisir} />
      <span className="text-xs text-muted-foreground">{nomActuel || "PDF, JPEG, PNG ou WebP"}</span>
      {refus && (
        <span role="alert" className="text-xs text-destructive">
          {refus}
        </span>
      )}
    </span>
  );
}

/** Ouvrir une pièce du seau privé : la fenêtre s'ouvre pendant le clic (sinon bloquée), le lien signé la remplit ensuite. */
export function BoutonPiece({ chemin, libelle = "📎 Ouvrir" }: { chemin: string | null; libelle?: string }) {
  const lien = useLienPiece();
  if (!chemin) return <span className="text-xs text-muted-foreground">sans fichier</span>;
  function ouvrir() {
    if (!chemin) return;
    const fenetre = window.open("", "_blank");
    lien.mutate(chemin, {
      onSuccess: (u) => {
        if (fenetre) fenetre.location.href = u;
        else window.location.assign(u);
      },
      onError: (e) => {
        console.error("Pièce illisible", chemin, e);
        fenetre?.close();
      },
    });
  }
  return (
    <span className="inline-flex flex-col">
      <Button size="sm" variant="ghost" onClick={ouvrir} disabled={lien.isPending}>
        {libelle}
      </Button>
      {lien.isError && <span role="alert" className="text-xs text-destructive">Le document n'a pas pu être ouvert : {messageErreur(lien.error)}</span>}
    </span>
  );
}

/** Cases à cocher des métiers du référentiel (équipes, sous-traitants), en conservant un métier retiré depuis. */
export function CasesMetiers({ legende, referentiel, coches, onChange }: { legende: string; referentiel: readonly string[]; coches: readonly string[]; onChange: (m: string[]) => void }) {
  const tous = [...referentiel, ...coches.filter((c) => !referentiel.includes(c))];
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-medium">{legende}</legend>
      {tous.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun métier au référentiel (Réglages › Listes de choix).</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {tous.map((m) => (
            <label key={m} className="inline-flex items-center gap-1 text-sm">
              <input type="checkbox" checked={coches.includes(m)} onChange={(e) => onChange(e.target.checked ? [...coches, m] : coches.filter((c) => c !== m))} />
              {m}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

/** Un bandeau d'avertissements rédigés (ce qui n'a pas suivi la fiche). */
export function Avertissements({ messages }: { messages: readonly string[] }) {
  if (!messages.length) return null;
  return (
    <Alert variant="erreur">
      <ul className="list-disc pl-4">
        {messages.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </Alert>
  );
}

export function BadgeEcheance({ niveau, jours, date }: { niveau: "expire" | "bientot"; jours: number; date?: string }) {
  return niveau === "expire" ? (
    <Badge variant="danger">Expiré{date ? ` le ${date}` : ""}</Badge>
  ) : (
    <Badge variant="alerte">Expire dans {jours} j</Badge>
  );
}
