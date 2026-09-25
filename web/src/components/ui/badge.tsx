import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * La pastille de statut de l'ancien écran (`.badge` et ses couleurs — ancien.css
 * l. 982 ; `badgeClass`, app.js l. 159 : brouillon gris, envoyé bleu, accepté
 * vert, refusé rouge, en cours jaune). Les noms de variantes restent ceux que
 * les écrans emploient déjà.
 */
const VARIANTES = {
  default: "info",
  info: "info",
  neutre: "gray",
  succes: "success",
  alerte: "warn",
  jaune: "yellow",
  danger: "danger",
} as const;

export type BadgeVariant = keyof typeof VARIANTES;

export function Badge({ className, variant, ...props }: ComponentProps<"span"> & { variant?: BadgeVariant | null }) {
  return <span className={cn("badge", VARIANTES[variant ?? "default"], className)} {...props} />;
}
