import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { CARACTERES_MINIMUM_ADRESSE, rechercherAdresse } from "@/modules/clients/api/adresses";

/**
 * Les champs du formulaire d'un bon, dans l'habit exact de l'ancien
 * (`<div class="field"><label>…</label><input id="bc_…"></div>`) : le libellé
 * PUIS la saisie, pour que la feuille pose le libellé dans la case. Les
 * identifiants sont ceux de l'ancien (`bc_client`, `bc_adresse`…), ce qui
 * associe aussi le libellé à sa saisie pour les lecteurs d'écran.
 */
interface Commun {
  id: string;
  libelle: ReactNode;
  valeur: string;
  onChange: (v: string) => void;
  className?: string;
  style?: CSSProperties;
  desactive?: boolean;
  erreur?: string | undefined;
  enfants?: ReactNode;
}

function Erreur({ id, erreur }: { id: string; erreur?: string | undefined }) {
  return erreur ? <small id={`${id}-erreur`} className="champ-erreur">{erreur}</small> : null;
}

export function Champ({ id, libelle, valeur, onChange, className, style, desactive, erreur, enfants, type = "text", placeholder, maxLength, inputMode, lectureSeule, classeSaisie, onInput }: Commun & { type?: string; placeholder?: string; maxLength?: number; inputMode?: "numeric" | "decimal"; lectureSeule?: boolean; classeSaisie?: string; onInput?: (v: string) => void }) {
  return (
    <div className={className ? `field ${className}` : "field"} style={style}>
      <label htmlFor={id}>{libelle}</label>
      <input
        type={type}
        id={id}
        autoComplete="off"
        value={valeur}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        readOnly={lectureSeule}
        className={classeSaisie}
        disabled={desactive}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={erreur ? `${id}-erreur` : undefined}
        onChange={(e) => { onChange(e.target.value); onInput?.(e.target.value); }}
      />
      {enfants}
      <Erreur id={id} erreur={erreur} />
    </div>
  );
}

export function ChampListe({ id, libelle, valeur, onChange, className, style, desactive, erreur, options }: Commun & { options: readonly { valeur: string; libelle: string }[] }) {
  return (
    <div className={className ? `field ${className}` : "field"} style={style}>
      <label htmlFor={id}>{libelle}</label>
      <select id={id} value={valeur} disabled={desactive} aria-invalid={erreur ? true : undefined} aria-describedby={erreur ? `${id}-erreur` : undefined} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
      </select>
      <Erreur id={id} erreur={erreur} />
    </div>
  );
}

export function ChampZone({ id, libelle, valeur, onChange, className, desactive, placeholder, style, enfants, erreur }: Commun & { placeholder?: string }) {
  return (
    <div className={className ? `field ${className}` : "field"}>
      <label htmlFor={id}>{libelle}</label>
      <textarea id={id} value={valeur} placeholder={placeholder} style={style} disabled={desactive} onChange={(e) => onChange(e.target.value)} />
      {enfants}
      <Erreur id={id} erreur={erreur} />
    </div>
  );
}

/** Le délai de l'ancien `searchAdresse` : on n'interroge la BAN qu'une fois la frappe posée. */
const DELAI_ADRESSE_MS = 350;
/** Celui de son `onblur` : le temps qu'un clic sur une proposition arrive. */
const DELAI_FERMETURE_MS = 150;

/**
 * L'adresse d'intervention et ses propositions (Base Adresse Nationale), comme
 * `searchAdresse` : trois caractères au moins, puis une liste sous le champ ;
 * choisir remplit l'adresse, le code postal et la ville. Un service muet ne
 * gêne jamais la saisie à la main.
 */
export function ChampAdresse({ valeur, onChange, onChoisir, desactive, erreur }: { valeur: string; onChange: (v: string) => void; onChoisir: (a: { adresse: string; codePostal: string; ville: string }) => void; desactive?: boolean; erreur?: string | undefined }) {
  const [requete, setRequete] = useState("");
  const [ouverte, setOuverte] = useState(false);
  useEffect(() => {
    const q = valeur.trim();
    const minuteur = setTimeout(() => setRequete(q), DELAI_ADRESSE_MS);
    return () => clearTimeout(minuteur);
  }, [valeur]);
  const possible = ouverte && requete.length >= CARACTERES_MINIMUM_ADRESSE;
  const r = useQuery({ queryKey: ["adresses", requete], queryFn: ({ signal }) => rechercherAdresse(requete, signal), enabled: possible });
  return (
    <div className="field" style={{ position: "relative" }}>
      <label htmlFor="bc_adresse">Adresse d&apos;intervention *</label>
      <input
        type="text"
        id="bc_adresse"
        autoComplete="off"
        value={valeur}
        disabled={desactive}
        placeholder="Où les travaux ont lieu — pas l'adresse du client"
        aria-invalid={erreur ? true : undefined}
        onChange={(e) => { onChange(e.target.value); setOuverte(e.target.value.trim().length >= CARACTERES_MINIMUM_ADRESSE); }}
        onBlur={() => setTimeout(() => setOuverte(false), DELAI_FERMETURE_MS)}
      />
      <div id="bcAdresseSuggestions" className="suggest-box" style={{ display: possible ? "block" : "none" }}>
        {possible && (r.isPending ? (
          <div className="suggest-empty">Recherche…</div>
        ) : r.data?.length ? (
          r.data.map((a) => (
            <div key={a.label} className="suggest-item" onMouseDown={() => { onChoisir(a); setOuverte(false); }}>
              <b>{a.adresse}</b>
              <small>{a.codePostal} {a.ville}</small>
            </div>
          ))
        ) : (
          <div className="suggest-empty">Aucune adresse trouvée — saisie manuelle possible</div>
        ))}
      </div>
      <Erreur id="bc_adresse" erreur={erreur} />
    </div>
  );
}
