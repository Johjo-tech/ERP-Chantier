import { formatDateFr, todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import type { CartePlanning } from "../domain/cartes";
import { ajouterTentative, heureDeParis, retirerTentative } from "../domain/contacts";
import { useContacts } from "../hooks/usePlanning";
import { usePlanningContexte } from "./contexte";

/** Le toast bref de l'ancien écran après une tentative (`showToast(…, 'success', 1800)`). */
const DUREE_TOAST_CONTACT_MS = 1800;

const arreter = (e: { stopPropagation: () => void }) => e.stopPropagation();
const echec = (e: unknown) => afficherToast(messageErreur(e));

/**
 * Le suivi des contacts (`planningContactZoneHTML`, PLN-07) : on joint un
 * locataire, un gardien, un syndic — la zone se montre quel que soit le
 * logement. Sur une carte déjà posée, ou pour qui ne peut pas modifier le bon
 * (D-PLN-13), il ne reste que la trace ; muette tant qu'il n'y a rien à dire.
 */
export function ZoneContacts({ carte, lectureSeule = false }: { carte: CartePlanning; lectureSeule?: boolean }) {
  const { peutContacter, demanderRappel } = usePlanningContexte();
  const { tentatives, rappel } = useContacts();
  const b = carte.bon;
  if (lectureSeule || !peutContacter) {
    if (!carte.tentatives.length && !b.rappel_date) return null;
    return (
      <div className="planning-contact-zone" onClick={arreter}>
        {b.rappel_date && <span className="contact-tag contact-tag-rappel">🔄 Rappeler le {formatDateFr(b.rappel_date)}</span>}
        {carte.tentatives.map((t) => (
          <span key={t.id} className={`contact-tag contact-tag-${t.type}`}>
            {t.type === "appel" ? "📞" : "💬"} {formatDateFr(t.date)} {t.heure}
          </span>
        ))}
      </div>
    );
  }
  const noter = (type: "appel" | "sms") =>
    tentatives.mutate(
      { bcId: carte.bcId, tentatives: ajouterTentative(carte.tentatives, type, todayISO(), heureDeParis(new Date()), crypto.randomUUID()) },
      { onSuccess: () => afficherToast(type === "appel" ? "📞 Tentative d'appel enregistrée !" : "💬 SMS enregistré !", "success", DUREE_TOAST_CONTACT_MS), onError: echec }
    );
  return (
    <div className="planning-contact-zone" onClick={arreter}>
      <button type="button" className="btn-contact btn-contact-appel" onClick={() => noter("appel")} title="Enregistrer une tentative d'appel (maintenant)">📞</button>
      <button type="button" className="btn-contact btn-contact-sms" onClick={() => noter("sms")} title="Enregistrer un SMS envoyé (maintenant)">💬</button>
      <button type="button" className="btn-contact btn-contact-rappel" onClick={() => demanderRappel(carte)} title="Programmer un rappel (ex : le locataire revient de congés)">📅</button>
      {b.rappel_date && (
        <span className="contact-tag contact-tag-rappel">
          🔄 Rappeler le {formatDateFr(b.rappel_date)}{" "}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              rappel.mutate({ bcId: carte.bcId, date: null }, { onError: echec });
            }}
            title="Annuler le rappel"
          >
            ✕
          </button>
        </span>
      )}
      {carte.tentatives.map((t) => (
        <span key={t.id} className={`contact-tag contact-tag-${t.type}`}>
          {t.type === "appel" ? "📞" : "💬"} {formatDateFr(t.date)} {t.heure}{" "}
          <button type="button" onClick={() => tentatives.mutate({ bcId: carte.bcId, tentatives: retirerTentative(carte.tentatives, t.id) }, { onError: echec })} title="Retirer">
            ✕
          </button>
        </span>
      ))}
    </div>
  );
}
