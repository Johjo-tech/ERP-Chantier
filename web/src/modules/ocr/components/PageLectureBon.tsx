import { Navigate, useLocation } from "react-router";
import { Alert } from "@/components/ui/alert";
import { useFonctionnalite } from "@/modules/societes/hooks/useFonctionnalite";

/**
 * L'ancienne adresse de la lecture automatique. Comme dans l'ancien écran, la
 * lecture se mène désormais DANS le formulaire du bon neuf (D-ECR-BC-10) : on
 * y conduit, avec le document s'il a été confié. L'URL directe ne contourne
 * pas l'abonnement (relecture 3, M6).
 */
export function PageLectureBon() {
  const ouverte = useFonctionnalite("ocr");
  const { state } = useLocation();
  if (!ouverte) return <Alert>La lecture automatique des bons n&apos;est pas incluse dans l&apos;abonnement de cette société.</Alert>;
  const fichier = typeof state === "object" && state !== null && "fichier" in state && state.fichier instanceof File ? state.fichier : null;
  return <Navigate to="/commandes/nouveau" replace state={fichier ? { lire: fichier } : undefined} />;
}
