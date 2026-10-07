import { formatDateFr, todayISO } from "@/lib/dates";
import { etatVisite } from "../domain/visites";

/**
 * Le suivi médical en un coup d'œil (`badgeVisiteMedicaleListe`). Quatre états,
 * pas trois : « aucun suivi » n'est pas « à jour » — c'est le cas le plus
 * fréquent, et il vaut manquement pour l'inspection du travail.
 */
export function BadgeVisite({ prochaine, seuil }: { prochaine: string | null; seuil: number }) {
  const { etat, jours } = etatVisite(prochaine, todayISO(), seuil);
  const style = { marginLeft: "6px" };
  if (etat === "depassee") return <span className="badge danger" style={style} title={`Visite médicale dépassée depuis le ${formatDateFr(prochaine)}`}>🩺 Visite expirée</span>;
  if (etat === "bientot") return <span className="badge warn" style={style} title={`Prochaine visite médicale le ${formatDateFr(prochaine)}`}>🩺 À renouveler ({jours} j)</span>;
  if (etat === "aJour") return <span className="badge success" style={style} title={`Prochaine visite médicale le ${formatDateFr(prochaine)}`}>🩺 À jour</span>;
  return <span className="badge danger" style={style} title="Aucune échéance connue : rien ne préviendra">🩺 Aucun suivi</span>;
}

/** L'échéance dans le registre (`etatVisiteBadge`). */
export function EcheanceVisite({ prochaine, seuil }: { prochaine: string | null; seuil: number }) {
  const { etat, jours } = etatVisite(prochaine, todayISO(), seuil);
  if (etat === "depassee") return <span className="badge danger">Dépassée depuis le {formatDateFr(prochaine)}</span>;
  if (etat === "bientot") return <span className="badge warn">À prévoir dans {jours} j</span>;
  if (etat === "aJour") return <span className="card-sub">Prochaine le {formatDateFr(prochaine)}</span>;
  return <span className="badge danger" title="Aucune échéance connue : rien ne préviendra">Aucun suivi</span>;
}
