import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { formatDateFr } from "@/lib/dates";
import { afficherToast } from "@/lib/toast";
import { rechercherAdresse, CARACTERES_MINIMUM_ADRESSE, type SuggestionAdresse } from "../api/adresses";
import { rechercherEntreprise } from "../api/annuaire";
import { estUnNumero, etablissementsDe, messageApresRemplissage, rechercheParNomPossible, type EtablissementTrouve, type ResultatEntreprise } from "../domain/annuaire";

/** Le délai de l'ancien écran avant d'interroger l'annuaire (400 ms) et la BAN (350 ms) : pas une requête par lettre. */
const DELAI_ANNUAIRE_MS = 400;
const DELAI_ADRESSE_MS = 350;
/** Une entreprise ne change pas d'adresse d'une minute à l'autre. */
const FRAICHEUR_MS = 5 * 60_000;

function useDiffere(valeur: string, delai: number): string {
  const [differee, setDifferee] = useState(valeur);
  useEffect(() => {
    const minuteur = setTimeout(() => setDifferee(valeur), delai);
    return () => clearTimeout(minuteur);
  }, [valeur, delai]);
  return differee;
}

const lieuDe = (e: Pick<EtablissementTrouve, "adresse" | "codePostal" | "ville">) => [e.adresse, e.codePostal, e.ville].filter(Boolean).join(" ");

/**
 * Une ligne de suggestion de l'ancien (`.suggest-item` : le nom en gras, le
 * lieu dessous). Un <button> plutôt qu'un <div> cliquable : il se prend au
 * clavier. `onMouseDown` empêché : le champ garde le focus, et sa perte ne
 * referme pas la boîte avant le clic.
 */
function Suggestion({ titre, detail, onChoisir }: { titre: string; detail: string; onChoisir: () => void }) {
  return (
    <button
      type="button"
      className="suggest-item"
      style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--border)", font: "inherit" }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onChoisir}
    >
      <b>{titre}</b>
      <small>{detail}</small>
    </button>
  );
}

/**
 * Sous le nom : les entreprises de l'annuaire qui répondent à la saisie
 * (CLI-02), dans la boîte de l'ancien (`#clientSuggestions`). Rien tant que
 * l'utilisateur n'a pas tapé — ouvrir une fiche existante n'interroge
 * personne — et rien pour un particulier (CLI-40).
 */
export function SuggestionsEntreprise({ saisie, actif, onChoisir }: { saisie: string; actif: boolean; onChoisir: (e: EtablissementTrouve) => void }) {
  const q = useDiffere(saisie.trim(), DELAI_ANNUAIRE_MS);
  const possible = actif && rechercheParNomPossible(q);
  const r = useQuery({ queryKey: ["annuaire", q], queryFn: () => rechercherEntreprise(q), enabled: possible, staleTime: FRAICHEUR_MS });
  let contenu = null;
  if (possible && r.isPending) contenu = <div className="suggest-empty">Recherche…</div>;
  else if (possible) {
    const res: ResultatEntreprise | undefined = r.data;
    const liste = res ? etablissementsDe(res) : [];
    contenu = liste.length ? (
      liste.map((e) => <Suggestion key={`${e.siret}-${e.nom}`} titre={e.nom} detail={`${lieuDe(e)}${e.siret ? ` · SIRET ${e.siret}` : ""}`} onChoisir={() => onChoisir(e)} />)
    ) : (
      <div className="suggest-empty">{res?.type === "erreur" ? res.message : "Aucun résultat"} — saisie manuelle possible</div>
    );
  }
  return (
    <div id="clientSuggestions" className="suggest-box" role="group" aria-label="Entreprises de l'annuaire" style={{ display: contenu ? "block" : "none" }}>
      {contenu}
    </div>
  );
}

/**
 * « SIRET / SIREN » et « 🔍 Rechercher » (`champSiretHTML`) : 14 chiffres
 * remplissent directement, 9 chiffres proposent les établissements OUVERTS de
 * l'entreprise (`chercherSiret`). Le résultat s'affiche sous le champ.
 */
export function ChampSiret({
  id,
  valeur,
  onChange,
  rempli,
  onChoisir,
  onEffacer,
}: {
  id: string;
  valeur: string;
  onChange: (v: string) => void;
  /** L'établissement qui vient de remplir la fiche — d'ici ou des suggestions du nom : le mot « Champs remplis » (ou la radiation) s'affiche ici. */
  rempli: EtablissementTrouve | null;
  onChoisir: (e: EtablissementTrouve) => void;
  onEffacer: () => void;
}) {
  const chercher = useMutation({ mutationFn: (n: string) => rechercherEntreprise(n) });
  const choisir = onChoisir;
  const lancer = () => {
    if (!estUnNumero(valeur)) return afficherToast("Saisissez 9 chiffres (SIREN) ou 14 chiffres (SIRET).");
    onEffacer();
    chercher.mutate(valeur.replace(/[^0-9]/g, ""), {
      onSuccess: (r) => {
        const liste = etablissementsDe(r);
        if (r.type === "siret" || liste.length === 1) choisir(liste[0] as EtablissementTrouve);
      },
    });
  };
  const r = chercher.data;
  let resultat = null;
  if (chercher.isPending) resultat = <div className="suggest-empty">Recherche…</div>;
  else if (rempli) {
    const m = messageApresRemplissage(rempli, formatDateFr);
    resultat = (
      <div role="status" className="suggest-empty" style={m.alerte ? { color: "var(--danger)", fontWeight: 600 } : { color: "var(--success,#1E6B37)" }}>
        {m.texte}
      </div>
    );
  } else if (r?.type === "erreur") {
    resultat = (
      <div role="alert" className="suggest-empty" style={{ color: "var(--danger)" }}>
        {r.message}
      </div>
    );
  } else if (r && r.type !== "siret") {
    resultat = (
      <>
        <div className="suggest-empty">{r.etablissements.length} établissements ouverts — choisissez :</div>
        {r.etablissements.map((e) => (
          <Suggestion key={e.siret} titre={e.nom} detail={`${lieuDe(e)} · ${e.siret}`} onChoisir={() => choisir(e)} />
        ))}
      </>
    );
  }
  return (
    <div className="field full" style={{ position: "relative" }}>
      <label htmlFor={id}>SIRET / SIREN</label>
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="text"
          id={id}
          value={valeur}
          placeholder="14 chiffres (SIRET) ou 9 chiffres (SIREN)"
          inputMode="numeric"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              lancer();
            }
          }}
        />
        <button type="button" className="btn" onClick={lancer}>
          🔍 Rechercher
        </button>
      </div>
      <div className="suggest-box" style={{ position: "static", marginTop: "6px", display: resultat ? "block" : "none" }}>
        {resultat}
      </div>
    </div>
  );
}

/** Sous l'adresse : les adresses de la BAN (`#clientAdresseSuggestions`), à choisir d'un clic ; jamais imposées. */
export function SuggestionsAdresse({ saisie, actif, onChoisir }: { saisie: string; actif: boolean; onChoisir: (a: SuggestionAdresse) => void }) {
  const q = useDiffere(saisie.trim(), DELAI_ADRESSE_MS);
  const possible = actif && q.length >= CARACTERES_MINIMUM_ADRESSE;
  const r = useQuery({ queryKey: ["adresses", q], queryFn: ({ signal }) => rechercherAdresse(q, signal), enabled: possible, staleTime: FRAICHEUR_MS });
  let contenu = null;
  if (possible && r.isPending) contenu = <div className="suggest-empty">Recherche…</div>;
  else if (possible) {
    contenu = r.data?.length ? (
      r.data.map((a) => <Suggestion key={a.label} titre={a.adresse} detail={`${a.codePostal} ${a.ville}`} onChoisir={() => onChoisir(a)} />)
    ) : (
      <div className="suggest-empty">Aucune adresse trouvée — saisie manuelle possible</div>
    );
  }
  return (
    <div id="clientAdresseSuggestions" className="suggest-box" role="group" aria-label="Adresses proposées" style={{ display: contenu ? "block" : "none" }}>
      {contenu}
    </div>
  );
}
