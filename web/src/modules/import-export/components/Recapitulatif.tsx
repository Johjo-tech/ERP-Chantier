import { Link } from "react-router";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ModuleId } from "@/modules/auth-roles/domain/permissions";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";

export function Chiffre({ valeur, libelle, alerte = false }: { valeur: number | string; libelle: string; alerte?: boolean }) {
  return (
    <div>
      <div className={`text-2xl font-semibold tabular-nums ${alerte ? "text-destructive" : ""}`}>{valeur}</div>
      <div className="text-xs text-muted-foreground">{libelle}</div>
    </div>
  );
}

/** Une liste de motifs, tronquée : l'aperçu montre assez pour juger, le rapport dit tout. */
export function ListeMotifs({ titre, lignes, max, variant = "info" }: { titre: string; lignes: readonly string[]; max: number; variant?: "info" | "erreur" }) {
  if (!lignes.length) return null;
  return (
    <Alert variant={variant}>
      <p className="font-semibold">{titre}</p>
      <ul className="list-disc pl-5">
        {lignes.slice(0, max).map((l, i) => (
          <li key={`${i}-${l}`}>{l}</li>
        ))}
      </ul>
      {lignes.length > max && <p className="mt-1 text-xs">…et {lignes.length - max} autre(s), dans le rapport.</p>}
    </Alert>
  );
}

/**
 * Le bouton d'import d'une liste : un import CRÉE et MET À JOUR, il faut donc
 * les deux droits (CLI-08, IMP-23) — la RLS refuserait de toute façon le reste.
 */
export function BoutonImport({ module, vers, libelle }: { module: ModuleId; vers: string; libelle: string }) {
  const creer = usePermission(module, "creer");
  const modifier = usePermission(module, "modifier");
  if (!creer || !modifier) return null;
  return (
    <Button variant="outline" asChild>
      <Link to={vers}>{libelle}</Link>
    </Button>
  );
}
