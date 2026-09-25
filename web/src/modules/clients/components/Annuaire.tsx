import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { rechercherAdresse, CARACTERES_MINIMUM_ADRESSE, type SuggestionAdresse } from "../api/adresses";
import { rechercherEntreprise } from "../api/annuaire";
import { estUnNumero, etablissementsDe, rechercheParNomPossible, type EtablissementTrouve, type ResultatEntreprise } from "../domain/annuaire";

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

function ListeEtablissements({ titre, etablissements, onChoisir }: { titre: string; etablissements: readonly EtablissementTrouve[]; onChoisir: (e: EtablissementTrouve) => void }) {
  return (
    <ul aria-label={titre} className="flex flex-col rounded-md border border-border bg-card text-sm">
      {etablissements.map((e) => (
        <li key={`${e.siret}-${e.nom}`}>
          <button type="button" className="flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none" onClick={() => onChoisir(e)}>
            <b>{e.nom}</b>
            <small className="text-muted-foreground">{lieuDe(e)}{e.siret ? ` · SIRET ${e.siret}` : ""}</small>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Sous le nom : les entreprises de l'annuaire qui répondent à la saisie
 * (CLI-02). Rien tant que l'utilisateur n'a pas tapé — ouvrir une fiche
 * existante n'interroge personne — et rien pour un particulier (CLI-40 :
 * « laurent johan » ramenait cinq SIRET).
 */
export function SuggestionsEntreprise({ saisie, actif, onChoisir }: { saisie: string; actif: boolean; onChoisir: (e: EtablissementTrouve) => void }) {
  const q = useDiffere(saisie.trim(), DELAI_ANNUAIRE_MS);
  const possible = actif && rechercheParNomPossible(q);
  const r = useQuery({ queryKey: ["annuaire", q], queryFn: () => rechercherEntreprise(q), enabled: possible, staleTime: FRAICHEUR_MS });
  if (!possible) return null;
  if (r.isPending) return <p role="status" className="text-xs text-muted-foreground sm:col-span-2">Recherche dans l'annuaire des entreprises…</p>;
  const res: ResultatEntreprise | undefined = r.data;
  const liste = res ? etablissementsDe(res) : [];
  if (!liste.length) {
    const pourquoi = res?.type === "erreur" ? res.message : "Aucun résultat";
    return <p role="status" className="text-xs text-muted-foreground sm:col-span-2">{pourquoi} — saisie manuelle possible.</p>;
  }
  return (
    <div className="sm:col-span-2">
      <ListeEtablissements titre="Entreprises de l'annuaire" etablissements={liste} onChoisir={onChoisir} />
    </div>
  );
}

/**
 * « Rechercher » à côté du SIRET : 14 chiffres remplissent directement, 9
 * chiffres proposent les établissements OUVERTS de l'entreprise (`chercherSiret`).
 */
export function RechercheSiret({ numero, onChoisir, message }: { numero: string; onChoisir: (e: EtablissementTrouve) => void; message: { texte: string; alerte: boolean } | null }) {
  const [refus, setRefus] = useState<string | null>(null);
  const chercher = useMutation({ mutationFn: (n: string) => rechercherEntreprise(n) });
  const lancer = () => {
    if (!estUnNumero(numero)) return setRefus("Saisissez 9 chiffres (SIREN) ou 14 chiffres (SIRET).");
    setRefus(null);
    chercher.mutate(numero.replace(/[^0-9]/g, ""), {
      onSuccess: (r) => {
        const liste = etablissementsDe(r);
        if (r.type === "siret" || liste.length === 1) onChoisir(liste[0] as EtablissementTrouve);
      },
    });
  };
  const r = chercher.data;
  const aChoisir = r && r.type !== "siret" && r.type !== "erreur" && r.etablissements.length > 1 ? r.etablissements : [];
  return (
    <div className="flex flex-col gap-1 sm:col-span-2">
      <div>
        <Button type="button" variant="outline" size="sm" onClick={lancer} disabled={chercher.isPending}>
          {chercher.isPending ? "Recherche…" : "🔍 Rechercher dans l'annuaire"}
        </Button>
      </div>
      {refus && <p role="alert" className="text-xs text-destructive">{refus}</p>}
      {r?.type === "erreur" && <p role="alert" className="text-xs text-destructive">{r.message}</p>}
      {aChoisir.length > 0 && !message && (
        <>
          <p className="text-xs text-muted-foreground">{aChoisir.length} établissements ouverts — choisissez :</p>
          <ListeEtablissements titre="Établissements de l'entreprise" etablissements={aChoisir} onChoisir={onChoisir} />
        </>
      )}
    </div>
  );
}

/** Sous l'adresse : les adresses de la BAN, à choisir d'un clic ; jamais imposées. */
export function SuggestionsAdresse({ saisie, actif, onChoisir }: { saisie: string; actif: boolean; onChoisir: (a: SuggestionAdresse) => void }) {
  const q = useDiffere(saisie.trim(), DELAI_ADRESSE_MS);
  const possible = actif && q.length >= CARACTERES_MINIMUM_ADRESSE;
  const r = useQuery({ queryKey: ["adresses", q], queryFn: ({ signal }) => rechercherAdresse(q, signal), enabled: possible, staleTime: FRAICHEUR_MS });
  if (!possible || r.isPending) return null;
  if (!r.data?.length) return <p className="text-xs text-muted-foreground sm:col-span-2">Aucune adresse trouvée — saisie manuelle possible.</p>;
  return (
    <ul aria-label="Adresses proposées" className="flex flex-col rounded-md border border-border bg-card text-sm sm:col-span-2">
      {r.data.map((a) => (
        <li key={a.label}>
          <button type="button" className="flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none" onClick={() => onChoisir(a)}>
            <b>{a.adresse}</b>
            <small className="text-muted-foreground">{a.codePostal} {a.ville}</small>
          </button>
        </li>
      ))}
    </ul>
  );
}
