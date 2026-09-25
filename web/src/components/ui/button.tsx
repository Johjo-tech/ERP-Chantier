import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Le bouton de l'ancien écran (`.btn`, `.btn.primary`, `.btn.ghost`,
 * `.btn.small`, `.btn.danger` — ancien.css l. 260). Les variantes gardent
 * leurs noms d'origine (façon shadcn) pour que les écrans n'aient pas à
 * changer ; elles ne produisent plus que les classes de l'ancienne feuille.
 */
const VARIANTES = {
  default: "btn primary",
  destructive: "btn danger",
  outline: "btn",
  secondary: "btn",
  ghost: "btn ghost",
  link: "section-link",
} as const;

const TAILLES = {
  default: "",
  sm: "small",
  lg: "",
  icon: "small",
} as const;

export type VarianteBouton = keyof typeof VARIANTES;
export type TailleBouton = keyof typeof TAILLES;

type Props = ComponentProps<"button"> & { variant?: VarianteBouton | null; size?: TailleBouton | null; asChild?: boolean };

export function Button({ className, variant, size, asChild = false, type, ...props }: Props) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(VARIANTES[variant ?? "default"], TAILLES[size ?? "default"], className)}
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    />
  );
}
