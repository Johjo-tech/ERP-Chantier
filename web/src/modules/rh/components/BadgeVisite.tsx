import { Badge } from "@/components/ui/badge";
import { formatDateFr, todayISO } from "@/lib/dates";
import { etatVisite } from "../domain/visites";

/**
 * Le suivi médical en un coup d'œil (`badgeVisiteMedicaleListe`). Quatre états,
 * pas trois : « aucun suivi » n'est pas « à jour » — c'est le cas le plus
 * fréquent, et il vaut manquement pour l'inspection du travail.
 */
export function BadgeVisite({ prochaine, seuil }: { prochaine: string | null; seuil: number }) {
  const { etat, jours } = etatVisite(prochaine, todayISO(), seuil);
  if (etat === "depassee") return <Badge variant="danger" title={`Visite médicale dépassée depuis le ${formatDateFr(prochaine)}`}>🩺 Visite expirée</Badge>;
  if (etat === "bientot") return <Badge variant="alerte" title={`Prochaine visite médicale le ${formatDateFr(prochaine)}`}>🩺 À renouveler ({jours} j)</Badge>;
  if (etat === "aJour") return <Badge variant="succes" title={`Prochaine visite médicale le ${formatDateFr(prochaine)}`}>🩺 À jour</Badge>;
  return <Badge variant="danger" title="Aucune échéance connue : rien ne préviendra">🩺 Aucun suivi</Badge>;
}

/** L'échéance dans le registre (`etatVisiteBadge`). */
export function EcheanceVisite({ prochaine, seuil }: { prochaine: string | null; seuil: number }) {
  const { etat, jours } = etatVisite(prochaine, todayISO(), seuil);
  if (etat === "depassee") return <Badge variant="danger">Dépassée depuis le {formatDateFr(prochaine)}</Badge>;
  if (etat === "bientot") return <Badge variant="alerte">À prévoir dans {jours} j</Badge>;
  if (etat === "aJour") return <span className="text-sm text-muted-foreground">Prochaine le {formatDateFr(prochaine)}</span>;
  return <Badge variant="danger" title="Aucune échéance connue : rien ne préviendra">Aucun suivi</Badge>;
}
