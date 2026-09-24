import { useId, type ReactNode } from "react";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function Cadre({ id, libelle, erreur, aide, requis, className, children }: Commun & { id: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {libelle}
        {requis && <span aria-hidden="true" className="text-destructive"> *</span>}
      </Label>
      {children}
      {aide && !erreur && <p id={`${id}-aide`} className="text-xs text-muted-foreground">{aide}</p>}
      {erreur && (
        <p id={`${id}-erreur`} className="text-xs text-destructive">
          {erreur}
        </p>
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
