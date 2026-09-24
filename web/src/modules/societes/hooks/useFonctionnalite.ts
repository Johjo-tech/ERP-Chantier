import { useSession } from "@/modules/auth-roles/hooks/useSession";
import { fonctionnaliteOuverte, type Fonctionnalite } from "../domain/abonnement";

export function useFonctionnalite(f: Fonctionnalite): boolean {
  const { societeActive } = useSession();
  return societeActive !== null && fonctionnaliteOuverte(f, societeActive.niveauAbonnement);
}
