import { useState } from "react";
import { Modale } from "@/components/ui/modale";
import { formatDateFr, todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import type { EnteteBon } from "../domain/bon";
import { nouvelleTentative, tentativesDuBon, type Tentative } from "../domain/contacts";
import { useContacts } from "../hooks/useBons";

/** Le toast bref de l'ancien `logTentativeContact` : on enchaîne souvent plusieurs appels. */
const DUREE_TOAST_TENTATIVE_MS = 1800;

const arreter = (e: { stopPropagation: () => void }) => e.stopPropagation();

/** « Programmer un rappel » (`#rappelModal` de l'ancien index.html). */
function ModaleRappel({ onValider, onFermer }: { onValider: (date: string) => void; onFermer: () => void }) {
  const [date, setDate] = useState("");
  return (
    <Modale titre="Programmer un rappel" onFermer={onFermer} largeurMax="360px">
      <p className="card-sub">Ex : le locataire est en congés et revient à cette date — un rappel apparaîtra ce jour-là.</p>
      <div className="field">
        <label htmlFor="rappelDateInput">Rappeler le</label>
        <input type="date" id="rappelDateInput" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
        <button type="button" className="btn primary" onClick={() => (date ? onValider(date) : afficherToast("Choisissez une date de rappel."))}>✓ Programmer</button>
        <button type="button" className="btn ghost" onClick={onFermer}>Annuler</button>
      </div>
    </Modale>
  );
}

/**
 * Les trois gestes de contact, à droite de l'identité du bon (`contactBoutonsHTML`) :
 * c'est le premier geste sur un bon dont l'occupant ne répond pas. Un compteur
 * résume les tentatives ; le détail est dans la carte dépliée.
 */
export function ContactsBon({ bon }: { bon: EnteteBon }) {
  const contacts = useContacts();
  const [rappelOuvert, setRappelOuvert] = useState(false);
  const tentatives = tentativesDuBon(bon.tentatives_contact);
  const echec = (e: unknown) => afficherToast(messageErreur(e));
  function noter(type: Tentative["type"]) {
    const t = nouvelleTentative(type, crypto.randomUUID(), todayISO(), new Date());
    contacts.mutate(
      { id: bon.id, contacts: { tentatives_contact: [...tentatives, t] } },
      { onSuccess: () => afficherToast(type === "appel" ? "📞 Tentative d'appel enregistrée !" : "💬 SMS enregistré !", "success", DUREE_TOAST_TENTATIVE_MS), onError: echec }
    );
  }
  function programmer(date: string) {
    contacts.mutate(
      { id: bon.id, contacts: { rappel_date: date } },
      { onSuccess: () => { setRappelOuvert(false); afficherToast(`🔄 Rappel programmé pour le ${formatDateFr(date)}.`, "success"); }, onError: echec }
    );
  }
  const n = tentatives.length;
  // Autant de boutons que de cartes : leur nom accessible cite le bon, le titre visible reste celui de l'ancien.
  const ref = bon.numero_interne ?? bon.client_nom;
  return (
    <div className="planning-contact-zone" onClick={arreter}>
      <button type="button" className="btn-contact btn-contact-appel" aria-label={`Enregistrer une tentative d'appel — ${ref}`} onClick={() => noter("appel")} title="Enregistrer une tentative d'appel (maintenant)">📞</button>
      <button type="button" className="btn-contact btn-contact-sms" aria-label={`Enregistrer un SMS envoyé — ${ref}`} onClick={() => noter("sms")} title="Enregistrer un SMS envoyé (maintenant)">💬</button>
      <button type="button" className="btn-contact btn-contact-rappel" aria-label={`Programmer un rappel — ${ref}`} onClick={() => setRappelOuvert(true)} title="Programmer un rappel (ex : le locataire revient de congés)">📅</button>
      {n > 0 && <span className="contact-compteur" title={`${n} tentative(s) — le détail est dans la carte dépliée`}>{n}</span>}
      {bon.rappel_date && <span className="contact-tag contact-tag-rappel" title="Rappel programmé">🔄 {formatDateFr(bon.rappel_date)}</span>}
      {rappelOuvert && <ModaleRappel onValider={programmer} onFermer={() => setRappelOuvert(false)} />}
    </div>
  );
}

/**
 * Le détail des contacts dans la carte dépliée (`planningContactZoneHTML(b, true)`) :
 * en lecture, muet tant qu'il n'y a rien à dire.
 */
export function TraceContactsBon({ bon }: { bon: EnteteBon }) {
  const tentatives = tentativesDuBon(bon.tentatives_contact);
  if (!tentatives.length && !bon.rappel_date) return null;
  return (
    <div className="planning-contact-zone" onClick={arreter}>
      {bon.rappel_date && <span className="contact-tag contact-tag-rappel">🔄 Rappeler le {formatDateFr(bon.rappel_date)}</span>}
      {tentatives.map((t) => (
        <span key={t.id} className={`contact-tag contact-tag-${t.type}`}>{t.type === "appel" ? "📞" : "💬"} {formatDateFr(t.date)} {t.heure}</span>
      ))}
    </div>
  );
}
