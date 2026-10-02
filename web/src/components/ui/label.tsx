import type { ComponentProps } from "react";

/** Un libellé nu : dans un `.field`, l'ancienne feuille le pose en petites capitales au-dessus de la saisie. */
export function Label(props: ComponentProps<"label">) {
  return <label {...props} />;
}
