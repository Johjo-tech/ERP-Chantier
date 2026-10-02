import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Le tableau de lecture de l'ancien écran (`.stats-table` dans son cadre
 * arrondi `.stats-table-wrap` — statistiques, dossiers RH) : en-têtes en
 * petites capitales sur fond gris, lignes séparées d'un filet, survol grisé.
 * La saisie de lignes, elle, garde `.lignes-table`, posée par l'écran.
 */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="stats-table-wrap">
      <table className={cn("stats-table", className)} {...props} />
    </div>
  );
}
export function THead(props: ComponentProps<"thead">) {
  return <thead {...props} />;
}
export function TBody(props: ComponentProps<"tbody">) {
  return <tbody {...props} />;
}
export function Tr(props: ComponentProps<"tr">) {
  return <tr {...props} />;
}
export function Th(props: ComponentProps<"th">) {
  return <th scope="col" {...props} />;
}
export function Td(props: ComponentProps<"td">) {
  return <td {...props} />;
}
