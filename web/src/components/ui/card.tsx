import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * La carte de l'ancien écran (`.card` : fond blanc, bordure, rayon 12 px,
 * marge basse 10 px, ombre légère), son titre (`.card-title`) et sa ligne
 * secondaire (`.card-sub`). L'ancien titre était un <div> en gras, pas un
 * titre de section typographié : il le reste, annoncé comme titre aux
 * lecteurs d'écran.
 */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("card", className)} {...props} />;
}
export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(className)} style={{ marginBottom: "10px" }} {...props} />;
}
export function CardTitle({ className, ...props }: ComponentProps<"div">) {
  return <div role="heading" aria-level={2} className={cn("card-title", className)} {...props} />;
}
export function CardDescription({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("card-sub", className)} {...props} />;
}
export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(className)} {...props} />;
}
