import { useId, type ReactNode } from "react";
import { Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Commun {
  libelle: string;
  valeur: string;
  onChange: (v: string) => void;
  erreur?: string | undefined;
  aide?: ReactNode;
  requis?: boolean;
  className?: string;
  desactive?: boolean;
}

/**
 * Le champ de l'ancien écran (`.field` : le libellé, PUIS la saisie). Cet
 * ordre n'est pas un détail : la feuille (`.field:has(> label + input)`) pose
 * alors le libellé en petites capitales DANS la case, en haut à gauche. L'aide
 * et l'erreur viennent après, pour ne pas le rompre. `className="full"` fait
 * courir le champ sur toute la largeur d'une `.field-grid`, comme avant.
 */
function Cadre({ id, libelle, erreur, aide, requis, className, children }: Commun & { id: string; children: ReactNode }) {
  return (
    <div className={cn("field", className)}>
      <label htmlFor={id}>
        {libelle}
        {requis && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {aide && !erreur && (
        <small id={`${id}-aide`} className="champ-aide">
          {aide}
        </small>
      )}
      {erreur && (
        <small id={`${id}-erreur`} className="champ-erreur">
          {erreur}
        </small>
      )}
    </div>
  );
}

function descripteur(id: string, erreur?: string, aide?: ReactNode) {
  if (erreur) return `${id}-erreur`;
  return aide ? `${id}-aide` : undefined;
}

/** Un champ texte accessible : libellé associé, erreur annoncée, `aria-invalid`. */
export function ChampTexte(props: Commun & { type?: string; inputMode?: "decimal" | "numeric" | "text" | "email" | "tel"; placeholder?: string }) {
  const id = useId();
  return (
    <Cadre {...props} id={id}>
      <Input
        id={id}
        type={props.type ?? "text"}
        inputMode={props.inputMode}
        placeholder={props.placeholder}
        value={props.valeur}
        disabled={props.desactive}
        required={props.requis}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={!!props.erreur}
        aria-describedby={descripteur(id, props.erreur, props.aide)}
      />
    </Cadre>
  );
}

export function ChampZone(props: Commun) {
  const id = useId();
  return (
    <Cadre {...props} id={id}>
      <Textarea
        id={id}
        value={props.valeur}
        disabled={props.desactive}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={!!props.erreur}
        aria-describedby={descripteur(id, props.erreur, props.aide)}
      />
    </Cadre>
  );
}

export function ChampChoix(props: Commun & { options: readonly { valeur: string; libelle: string }[] }) {
  const id = useId();
  return (
    <Cadre {...props} id={id}>
      <Select
        id={id}
        value={props.valeur}
        disabled={props.desactive}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={!!props.erreur}
        aria-describedby={descripteur(id, props.erreur, props.aide)}
      >
        {props.options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </Select>
    </Cadre>
  );
}
