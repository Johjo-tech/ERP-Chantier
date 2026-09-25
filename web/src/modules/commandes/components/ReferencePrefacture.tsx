import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { formatDateFr } from "@/lib/dates";
import type { Bon } from "../api/bons";
import { comptesRendus } from "../domain/prefacture";
import type { TacheBon } from "../domain/workflow";
import { ApercuPieceJointe } from "./PieceJointe";

type Reference = "bonClient" | "fiche";

function FicheInterne({ bon }: { bon: Bon }) {
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <div><dt className="text-xs text-muted-foreground">Client</dt><dd>{bon.client_nom}</dd></div>
      <div><dt className="text-xs text-muted-foreground">N° BC client</dt><dd className="whitespace-pre-line">{bon.numero_bc ?? "—"}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Lieu</dt><dd>{[bon.adresse, bon.code_postal, bon.ville].filter(Boolean).join(" ") || "—"}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Réception</dt><dd>{formatDateFr(bon.date_reception ?? bon.date)}</dd></div>
      <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Nature des travaux</dt><dd>{bon.nature_travaux ?? "—"}</dd></div>
      {bon.devis_id && <div><dt className="text-xs text-muted-foreground">Devis</dt><dd><Link to={`/devis/${bon.devis_id}`} className="text-primary hover:underline">Ouvrir le devis lié</Link></dd></div>}
    </dl>
  );
}

/**
 * La pièce qui fait foi au moment de facturer (app.js l. 7861-7992) : le bon
 * SIGNÉ du client dès qu'il existe, sinon la fiche interne ; en plein écran
 * sur demande, refermé par Échap. Et les comptes-rendus du terrain, tous.
 */
export function ReferencePrefacture({ bon, taches }: { bon: Bon; taches: readonly TacheBon[] }) {
  const [reference, setReference] = useState<Reference>(bon.piece_jointe_chemin ? "bonClient" : "fiche");
  const [pleinEcran, setPleinEcran] = useState(false);
  useEffect(() => {
    if (!pleinEcran) return;
    const touche = (e: KeyboardEvent) => e.key === "Escape" && setPleinEcran(false);
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [pleinEcran]);
  const doc = { chemin: bon.piece_jointe_chemin, nom: bon.piece_jointe_nom, mime: bon.piece_jointe_mime };
  const contenu = reference === "bonClient" ? <ApercuPieceJointe doc={doc} grand={pleinEcran} /> : <FicheInterne bon={bon} />;
  const cr = comptesRendus(taches);
  return (
    <aside aria-labelledby="titre-reference" className="flex flex-col gap-3">
      <h2 id="titre-reference" className="text-base font-semibold">Pièce de référence</h2>
      <div role="group" aria-label="Pièce affichée" className="flex flex-wrap gap-2">
        {bon.piece_jointe_chemin && <Button size="sm" variant={reference === "bonClient" ? "default" : "outline"} aria-pressed={reference === "bonClient"} onClick={() => setReference("bonClient")}>Bon du client</Button>}
        <Button size="sm" variant={reference === "fiche" ? "default" : "outline"} aria-pressed={reference === "fiche"} onClick={() => setReference("fiche")}>Fiche interne</Button>
        <Button size="sm" variant="ghost" onClick={() => setPleinEcran(true)}>Plein écran</Button>
      </div>
      {pleinEcran ? (
        <div role="dialog" aria-modal="true" aria-label="Pièce de référence en plein écran" className="fixed inset-0 z-50 flex flex-col gap-2 bg-background p-4">
          <Button className="self-end" variant="outline" onClick={() => setPleinEcran(false)} autoFocus>Fermer (Échap)</Button>
          <div className="flex-1 overflow-auto">{contenu}</div>
        </div>
      ) : (
        contenu
      )}
      <section aria-labelledby="titre-cr" className="flex flex-col gap-1">
        <h3 id="titre-cr" className="text-sm font-semibold">Comptes-rendus du terrain</h3>
        {!cr.length && <p className="text-sm text-muted-foreground">Aucun compte-rendu.</p>}
        {cr.map((c) => (
          <blockquote key={c.tacheId} className="border-l-2 pl-2 text-sm">
            <span className="text-xs text-muted-foreground">{[c.metier, c.date && formatDateFr(c.date)].filter(Boolean).join(" · ")}</span>
            <p>{c.commentaire}</p>
          </blockquote>
        ))}
      </section>
    </aside>
  );
}
