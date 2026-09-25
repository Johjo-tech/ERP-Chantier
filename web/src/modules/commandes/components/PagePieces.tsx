import { useState } from "react";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { messageErreur } from "@/lib/erreurs";
import { correspond } from "@/lib/recherche";
import { ongletDe, ongletVoisin, parFournisseur, type OngletPieces, type PieceDuBon } from "../domain/pieces";
import { usePieces } from "../hooks/useBons";
import { CartePiece } from "./CartePiece";

const ONGLETS: { cle: OngletPieces; libelle: string; vide: string }[] = [
  { cle: "a_commander", libelle: "À commander", vide: "Aucune pièce en attente de commande." },
  { cle: "commandees", libelle: "Commandées", vide: "Aucune pièce commandée pour l'instant." },
  { cle: "recues", libelle: "Reçues", vide: "Aucune pièce reçue." },
];

function Liste({ pieces, onResultat }: { pieces: PieceDuBon[]; onResultat: (m: string, e?: unknown) => void }) {
  return <ul className="flex flex-col gap-2">{pieces.map((p) => <CartePiece key={p.bon.id} piece={p} onResultat={onResultat} />)}</ul>;
}

/** Les commandées se rangent en dossiers par fournisseur : c'est ainsi qu'on relance un fournisseur (BC-20). */
function Dossiers({ pieces, onResultat }: { pieces: PieceDuBon[]; onResultat: (m: string, e?: unknown) => void }) {
  return (
    <div className="flex flex-col gap-4">
      {parFournisseur(pieces).map((d) => (
        <section key={d.fournisseur} aria-label={`Fournisseur ${d.fournisseur}`}>
          <h2 className="mb-2 text-sm font-semibold">{d.fournisseur} <span className="text-muted-foreground">({d.pieces.length})</span></h2>
          <Liste pieces={d.pieces} onResultat={onResultat} />
        </section>
      ))}
    </div>
  );
}

export function PagePieces() {
  const pieces = usePieces();
  const [onglet, setOnglet] = useState<OngletPieces>("a_commander");
  const [recherche, setRecherche] = useState("");
  const [resultat, setResultat] = useState<{ message: string; erreur?: unknown } | null>(null);
  const onResultat = (message: string, erreur?: unknown) => setResultat({ message, erreur });
  // Une seule recherche pour les trois onglets : on cherche la pièce, pas son moment.
  const trouvees = (pieces.data ?? []).filter((p) => correspond(recherche, p.description, p.fournisseur, p.bon.client_nom, p.bon.numero_interne, p.bon.numero_bc));
  const courant = ONGLETS.find((o) => o.cle === onglet) ?? ONGLETS[0];
  const liste = trouvees.filter((p) => ongletDe(p) === onglet);

  return (
    <>
      <EnTetePage titre="Pièces en commande" />
      <label htmlFor="recherche-pieces" className="sr-only">Rechercher une pièce</label>
      <Input id="recherche-pieces" type="search" className="mb-3 max-w-sm" placeholder="Pièce, fournisseur, client, n° BC…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      {/* Onglets ARIA complets : panneau, aria-controls, flèches et Début/Fin, un seul onglet dans l'ordre de tabulation (relecture 3, M8). */}
      <div role="tablist" aria-label="État des pièces" className="mb-3 flex flex-wrap gap-2" onKeyDown={(e) => {
        const cible = ongletVoisin(ONGLETS.map((o) => o.cle), onglet, e.key);
        if (!cible) return;
        e.preventDefault();
        setOnglet(cible);
        document.getElementById(`onglet-${cible}`)?.focus();
      }}>
        {ONGLETS.map((o) => (
          <Button key={o.cle} id={`onglet-${o.cle}`} role="tab" aria-selected={o.cle === onglet} aria-controls="panneau-pieces" tabIndex={o.cle === onglet ? 0 : -1} variant={o.cle === onglet ? "default" : "outline"} onClick={() => setOnglet(o.cle)}>
            {o.libelle} ({trouvees.filter((p) => ongletDe(p) === o.cle).length})
          </Button>
        ))}
      </div>
      <div id="panneau-pieces" role="tabpanel" aria-labelledby={`onglet-${onglet}`} tabIndex={0}>
        {resultat && <Alert variant={resultat.erreur ? "erreur" : "succes"}>{resultat.erreur ? messageErreur(resultat.erreur) : resultat.message}</Alert>}
        {pieces.isPending && <Chargement />}
        {pieces.isError && <Erreur erreur={pieces.error} reessayer={() => void pieces.refetch()} />}
        {pieces.isSuccess && liste.length === 0 && <Vide message={recherche ? "Aucune pièce ne correspond." : (courant?.vide ?? "")} />}
        {liste.length > 0 && (onglet === "commandees" ? <Dossiers pieces={liste} onResultat={onResultat} /> : <Liste pieces={liste} onResultat={onResultat} />)}
      </div>
    </>
  );
}
