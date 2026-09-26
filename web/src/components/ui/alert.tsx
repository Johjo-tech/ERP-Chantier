import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Props = ComponentProps<"div"> & { variant?: "info" | "erreur" | "succes" };

/**
 * Un message dans le flux d'un écran, dans les habits de l'ancien : les
 * bandeaux du circuit (`.wf-banner.ok` / `.wf-banner.alerte`) pour une
 * réussite ou un refus, l'encadré orangé (`.card` sur `--accent-soft`, celui
 * du tableau de bord du conducteur) pour une information.
 */
export function Alert({ className, variant = "info", style, ...props }: Props) {
  const role = variant === "erreur" ? "alert" : "status";
  if (variant === "info") {
    return <div role={role} className={cn("card", className)} style={{ borderColor: "var(--accent)", background: "var(--accent-soft)", ...style }} {...props} />;
  }
  return <div role={role} className={cn("wf-banner", variant === "erreur" ? "alerte" : "ok", className)} style={style} {...props} />;
}
