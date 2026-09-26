import { useId, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import type { Article } from "../domain/article";
import { useSuggestionsArticles, useTrouverParCode } from "../hooks/useArticles";
import { useDiffere } from "../hooks/useDiffere";

interface Props {
  /** Nom accessible du champ (« Code article, ligne 3 »). */
  libelle: string;
  /** Ce qui est tapé : la référence libre de la ligne, qu'un article soit choisi ou non. */
  valeur: string;
  onSaisie: (texte: string) => void;
  onChoisir: (article: Article) => void;
  /** Proposé quand rien ne correspond : créer l'article au catalogue depuis la ligne (ART-10). */
  onCreer?: (code: string) => void;
  desactive?: boolean;
}

/**
 * Chercher un article depuis une ligne de document (DEV-10, ART-10) : une
 * « combobox » ARIA — ↑ ↓ parcourent, Entrée (ou Tab) choisit, Échap ferme.
 *
 * Entrée sans suggestion active valide le CODE EXACT d'abord : on tape une
 * référence qu'on connaît et la ligne se remplit, même si la liste n'est pas
 * encore arrivée ou si une correspondance partielle passe devant. À défaut, la
 * première proposition ; à défaut encore, la référence reste libre — on ne
 * devine rien à la place de l'utilisateur.
 */
export function ChoixArticle({ libelle, valeur, onSaisie, onChoisir, onCreer, desactive = false }: Props) {
  useModeDiscret();
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const terme = useDiffere(valeur);
  const suggestions = useSuggestionsArticles(ouvert ? terme : "");
  const trouverParCode = useTrouverParCode();
  const liste = suggestions.data ?? [];
  const visible = ouvert && valeur.trim() !== "" && terme === valeur && !suggestions.isPending;

  function choisir(a: Article) {
    setOuvert(false);
    setActif(-1);
    onChoisir(a);
  }

  async function valider() {
    const active = visible ? liste[actif] : undefined;
    if (active) return choisir(active);
    try {
      const exact = await trouverParCode(valeur);
      if (exact) return choisir(exact);
    } catch (e) {
      // Le catalogue injoignable n'empêche pas la saisie manuelle : on se rabat sur la liste.
      console.error("Recherche du code exact impossible :", e);
    }
    const premier = visible ? liste[0] : undefined;
    if (premier) choisir(premier);
    else setOuvert(false);
  }

  function clavier(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") return setOuvert(false);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOuvert(true);
      if (liste.length) setActif((i) => (e.key === "ArrowDown" ? (i + 1) % liste.length : (i <= 0 ? liste.length : i) - 1));
      return;
    }
    if ((e.key === "Enter" || e.key === "Tab") && valeur.trim()) {
      // Tab laisse le focus avancer : la ligne se remplit au passage, sans détour par la liste.
      if (e.key === "Enter") e.preventDefault();
      void valider();
    }
  }

  const idListe = `${id}-suggestions`;
  const idOption = (i: number) => `${id}-option-${i}`;
  return (
    <div className="relative">
      {/* Le champ de l'ancien (`art-pick`, app.js `ligneRow`) : sans `type="text"` l'ancienne feuille ne l'habille pas. */}
      <Input
        type="text"
        className="art-pick"
        placeholder="Code…"
        title="Tapez un code ou un mot de la désignation"
        role="combobox"
        aria-label={libelle}
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={idListe}
        aria-activedescendant={visible && actif >= 0 ? idOption(actif) : undefined}
        autoComplete="off"
        value={valeur}
        disabled={desactive}
        onChange={(e) => {
          onSaisie(e.target.value);
          setOuvert(true);
          setActif(-1);
        }}
        onKeyDown={clavier}
        onBlur={() => setOuvert(false)}
      />
      <ul id={idListe} role="listbox" aria-label={`Articles proposés — ${libelle}`} hidden={!visible}
        className="absolute z-20 mt-1 max-h-72 w-full min-w-72 overflow-auto rounded-md border border-border bg-background shadow-md">
        {suggestions.isError && <li className="p-2 text-sm text-muted-foreground">Catalogue injoignable — saisie manuelle possible.</li>}
        {liste.map((a, i) => (
          <li key={a.id} id={idOption(i)} role="option" aria-selected={i === actif}
            className="cursor-pointer px-3 py-1.5 text-sm aria-selected:bg-muted"
            // mousedown, pas click : le clic arriverait après le blur qui ferme la liste.
            onMouseDown={(e) => {
              e.preventDefault();
              choisir(a);
            }}
          >
            <span className="font-mono text-xs font-semibold">{a.code}</span>{" "}
            <span className="text-muted-foreground">{a.designation} — {formatEurosEcran(montant(a.prix_unitaire))}{a.unite ? ` / ${a.unite}` : ""}</span>
          </li>
        ))}
        {suggestions.isSuccess && liste.length === 0 && (
          <li className="p-2 text-sm text-muted-foreground">
            Aucun article — saisie manuelle possible.
            {onCreer && (
              <button type="button" className="ml-2 underline" onMouseDown={(e) => { e.preventDefault(); setOuvert(false); onCreer(valeur.trim()); }}>
                Créer « {valeur.trim()} » dans le catalogue
              </button>
            )}
          </li>
        )}
      </ul>
    </div>
  );
}
