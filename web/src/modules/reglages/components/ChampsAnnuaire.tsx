import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { formatDateFr } from "@/lib/dates";
import { afficherToast } from "@/lib/toast";
import { rechercherAdresse, CARACTERES_MINIMUM_ADRESSE, type SuggestionAdresse } from "@/modules/clients/api/adresses";
import { rechercherEntreprise } from "@/modules/clients/api/annuaire";
import { estUnNumero, etablissementsDe, messageApresRemplissage, type EtablissementTrouve } from "@/modules/clients/domain/annuaire";

/** Le délai de l'ancien `searchAdresse` avant d'interroger la Base Adresse Nationale. */
const DELAI_ADRESSE_MS = 350;
/** Le temps de cliquer une suggestion avant que la liste ne se referme (`onblur` de l'ancien). */
const DELAI_FERMETURE_MS = 150;

/**
 * L'adresse avec ses suggestions de la BAN (`searchAdresse`, `.suggest-box`
 * sous le champ, comme l'ancien écran) : jamais imposées, un clic remplit
 * adresse, code postal et ville.
 */
export function ChampAdresse({ valeur, onChange, onChoisir, desactive }: { valeur: string; onChange: (v: string) => void; onChoisir: (a: SuggestionAdresse) => void; desactive: boolean }) {
  const [suggestions, setSuggestions] = useState<SuggestionAdresse[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const saisie = useRef(false);
  useEffect(() => {
    if (!saisie.current || valeur.trim().length < CARACTERES_MINIMUM_ADRESSE) return undefined;
    const controle = new AbortController();
    const t = setTimeout(() => {
      rechercherAdresse(valeur, controle.signal)
        .then((r) => {
          setSuggestions(r);
          setOuvert(true);
        })
        .catch((e: unknown) => console.warn("Suggestions d'adresse indisponibles", e));
    }, DELAI_ADRESSE_MS);
    return () => {
      clearTimeout(t);
      controle.abort();
    };
  }, [valeur]);
  return (
    <div className="field full" style={{ position: "relative" }}>
      <label htmlFor="ie_adresse">Adresse</label>
      <input
        type="text"
        id="ie_adresse"
        autoComplete="off"
        value={valeur}
        disabled={desactive}
        onChange={(e) => {
          saisie.current = true;
          onChange(e.target.value);
        }}
        onBlur={() => setTimeout(() => setOuvert(false), DELAI_FERMETURE_MS)}
      />
      <div id="ieAdresseSuggestions" className="suggest-box" style={{ display: ouvert && suggestions.length ? "block" : "none" }}>
        {suggestions.map((a) => (
          <div
            key={a.label}
            className="suggest-item"
            role="button"
            tabIndex={0}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setOuvert(false);
              onChoisir(a);
            }}
          >
            <b>{a.adresse}</b>
            <small>
              {a.codePostal} {a.ville}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * « SIRET / SIREN » et « 🔍 Rechercher » (`champSiretHTML` + `chercherSiret`,
 * app.js l. 17438) : 14 chiffres remplissent, 9 chiffres proposent les
 * établissements ouverts. Le résultat s'écrit dans la boîte sous le champ.
 */
export function ChampSiret({ id = "ie_siret", valeur, onChange, onEtablissement, desactive }: { id?: string; valeur: string; onChange: (v: string) => void; onEtablissement: (e: EtablissementTrouve) => void; desactive: boolean }) {
  const chercher = useMutation({ mutationFn: (n: string) => rechercherEntreprise(n) });
  const [choisi, setChoisi] = useState<EtablissementTrouve | null>(null);
  const appliquer = (e: EtablissementTrouve) => {
    setChoisi(e);
    onEtablissement(e);
  };
  const lancer = () => {
    if (!estUnNumero(valeur)) {
      afficherToast("Saisissez 9 chiffres (SIREN) ou 14 chiffres (SIRET).");
      return;
    }
    setChoisi(null);
    chercher.mutate(valeur.replace(/[^0-9]/g, ""), {
      onSuccess: (r) => {
        const liste = etablissementsDe(r);
        if ((r.type === "siret" || liste.length === 1) && liste[0]) appliquer(liste[0]);
      },
    });
  };
  const r = chercher.data;
  const aChoisir = !choisi && r && r.type !== "erreur" ? etablissementsDe(r) : [];
  const message = choisi ? messageApresRemplissage(choisi, formatDateFr) : null;
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
          disabled={desactive}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              lancer();
            }
          }}
        />
        <button type="button" className="btn" disabled={desactive || chercher.isPending} onClick={lancer}>
          🔍 Rechercher
        </button>
      </div>
      <div id={`${id}_res`} className="suggest-box" role="status" style={{ position: "static", marginTop: "6px", display: chercher.isIdle ? undefined : "block" }}>
        {chercher.isPending && <div className="suggest-empty">Recherche…</div>}
        {r?.type === "erreur" && (
          <div className="suggest-empty" style={{ color: "var(--danger)" }}>
            {r.message}
          </div>
        )}
        {message && (
          <div className="suggest-empty" style={message.alerte ? { color: "var(--danger)", fontWeight: 600 } : { color: "var(--success,#1E6B37)" }}>
            {message.texte}
          </div>
        )}
        {aChoisir.length > 1 && (
          <>
            <div className="suggest-empty">{aChoisir.length} établissements ouverts — choisissez :</div>
            {aChoisir.map((e) => (
              <div key={`${e.siret}-${e.nom}`} className="suggest-item" role="button" tabIndex={0} onClick={() => appliquer(e)}>
                <b>{e.nom}</b>
                <small>
                  {[e.adresse, e.codePostal, e.ville].filter(Boolean).join(" ")} · {e.siret}
                </small>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
