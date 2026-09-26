import { useId, type ChangeEvent } from "react";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { refusPieceJointe } from "@/modules/commandes/domain/pieceJointe";
import type { Pastille } from "../domain/documents";
import { useLienPiece } from "../hooks/useRh";

const PASTILLES: Record<Pastille, { signe: string; titre: string; classe: string }> = {
  ok: { signe: "✓", titre: "Au dossier", classe: "ok" },
  bientot: { signe: "~", titre: "Expire bientôt", classe: "bientot" },
  sansDate: { signe: "?", titre: "Sans date de fin de validité", classe: "bientot" },
  expire: { signe: "!", titre: "Expiré", classe: "expire" },
  manquant: { signe: "✕", titre: "Manquant", classe: "manquant" },
};

/** Une case du tableau de conformité (`.doc-rh-pastille` de l'ancien) : le signe se lit, le titre se dit. */
export function PastilleRh({ etat, titre }: { etat: Pastille; titre?: string }) {
  const p = PASTILLES[etat];
  return (
    <span role="img" aria-label={titre ?? p.titre} title={titre ?? p.titre} className={`doc-rh-pastille ${p.classe}`}>
      {p.signe}
    </span>
  );
}

/**
 * Choisir un fichier, au geste de l'ancien écran : un `<label class="btn small">📎 …`
 * qui porte l'`<input type=file>` caché, le nom retenu à côté (`.card-sub`). Les règles
 * sont celles de toute pièce jointe (PDF, JPEG, PNG ou WebP) ; un refus se dit par la
 * bulle, comme `verifierPieceJointe` + `showToast`.
 */
export function ChoixFichier({
  libelle,
  onFichiers,
  multiple = false,
  nomActuel,
  primaire = false,
  sansNom = false,
}: {
  libelle: string;
  onFichiers: (f: File[]) => void;
  multiple?: boolean;
  nomActuel?: string | null | undefined;
  primaire?: boolean;
  /** Le bouton seul, sans le nom à côté (habilitations). */
  sansNom?: boolean;
}) {
  const id = useId();
  function choisir(e: ChangeEvent<HTMLInputElement>) {
    const fichiers = Array.from(e.target.files ?? []);
    e.target.value = "";
    const acceptes: File[] = [];
    for (const f of fichiers) {
      const motif = refusPieceJointe(f);
      if (motif) afficherToast(motif);
      else acceptes.push(f);
    }
    // En un seul appel : plusieurs appels successifs liraient chacun la liste d'avant.
    if (acceptes.length) onFichiers(acceptes);
  }
  return (
    <>
      <label htmlFor={id} className={`btn small${primaire ? " primary" : ""}`} style={{ cursor: "pointer" }}>
        📎 {libelle}
        <input id={id} type="file" accept=".pdf,image/*" multiple={multiple} style={{ display: "none" }} onChange={choisir} />
      </label>
      {!sansNom && <span className="card-sub">{nomActuel || "PDF, JPEG, PNG ou WebP"}</span>}
    </>
  );
}

/** Ouvrir une pièce du seau privé (`📎 Ouvrir`, bouton fantôme de l'ancien) : la fenêtre s'ouvre pendant le clic, le lien signé la remplit ensuite. */
export function BoutonPiece({ chemin, libelle = "📎 Ouvrir", absent = "sans fichier" }: { chemin: string | null; libelle?: string; absent?: string }) {
  const lien = useLienPiece();
  if (!chemin) {
    return (
      <span className="card-sub" title="Ligne enregistrée sans fichier joint">
        {absent}
      </span>
    );
  }
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
        afficherToast(`Le document n'a pas pu être ouvert : ${messageErreur(e)}`);
      },
    });
  }
  return (
    <button type="button" className="btn small ghost" onClick={ouvrir} disabled={lien.isPending}>
      {libelle}
    </button>
  );
}

/**
 * Les cases des métiers (`metierCheckboxesHTML`, app.js l. 18730) : `.metier-checkbox-list`
 * de `.metier-checkbox-item`. Un métier coché mais retiré du référentiel depuis reste
 * proposé — le décocher sans le voir l'effacerait au premier enregistrement.
 */
export function CasesMetiers({ legende, referentiel, coches, onChange }: { legende: string; referentiel: readonly string[]; coches: readonly string[]; onChange: (m: string[]) => void }) {
  const tous = [...referentiel, ...coches.filter((c) => !referentiel.includes(c))];
  if (!tous.length) return <div className="empty">Aucun métier créé pour l&apos;instant (Réglages → Métiers).</div>;
  return (
    <div className="metier-checkbox-list" role="group" aria-label={legende}>
      {tous.map((m) => (
        <label key={m} className="metier-checkbox-item">
          <input type="checkbox" value={m} checked={coches.includes(m)} onChange={(e) => onChange(e.target.checked ? [...coches, m] : coches.filter((c) => c !== m))} />
          <span>{m}</span>
        </label>
      ))}
    </div>
  );
}

/** Ce qui n'a pas suivi la fiche : l'encadré d'alerte de l'ancien écran (`.wf-banner.alerte`). */
export function Avertissements({ messages }: { messages: readonly string[] }) {
  if (!messages.length) return null;
  return (
    <div role="alert" className="wf-banner alerte" style={{ marginTop: "12px" }}>
      {messages.map((m) => (
        <div key={m}>{m}</div>
      ))}
    </div>
  );
}

export function BadgeEcheance({ niveau, jours, date }: { niveau: "expire" | "bientot"; jours: number; date?: string }) {
  return niveau === "expire" ? <span className="badge danger">Expiré{date ? ` le ${date}` : ""}</span> : <span className="badge warn">Expire dans {jours} j</span>;
}
