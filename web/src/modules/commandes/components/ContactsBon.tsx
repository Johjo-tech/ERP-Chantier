import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateFr, todayISO } from "@/lib/dates";
import type { EnteteBon } from "../domain/bon";
import { nouvelleTentative, tentativesDuBon, type Tentative } from "../domain/contacts";
import { useContacts } from "../hooks/useBons";

/**
 * Les trois gestes de contact, à droite de l'identité du bon (BC-02) : c'est le
 * premier geste sur un bon dont l'occupant ne répond pas. Un compteur résume
 * les tentatives ; le rappel programmé s'affiche.
 */
export function ContactsBon({ bon, onResultat }: { bon: EnteteBon; onResultat: (m: string, e?: unknown) => void }) {
  const contacts = useContacts();
  const [rappel, setRappel] = useState<string | null>(null);
  const tentatives = tentativesDuBon(bon.tentatives_contact);
  const reference = bon.numero_interne ?? bon.client_nom;
  function noter(type: Tentative["type"]) {
    const t = nouvelleTentative(type, crypto.randomUUID(), todayISO(), new Date());
    contacts.mutate(
      { id: bon.id, contacts: { tentatives_contact: [...tentatives, t] } },
      { onSuccess: () => onResultat(type === "appel" ? "📞 Tentative d'appel enregistrée." : "💬 SMS enregistré."), onError: (e) => onResultat("", e) }
    );
  }
  function programmer(date: string | null) {
    contacts.mutate(
      { id: bon.id, contacts: { rappel_date: date } },
      { onSuccess: () => { setRappel(null); onResultat(date ? `🔄 Rappel programmé pour le ${formatDateFr(date)}.` : "Rappel annulé."); }, onError: (e) => onResultat("", e) }
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Button size="icon" variant="ghost" aria-label={`Noter une tentative d'appel — ${reference}`} title="Enregistrer une tentative d'appel (maintenant)" disabled={contacts.isPending} onClick={() => noter("appel")}>📞</Button>
      <Button size="icon" variant="ghost" aria-label={`Noter un SMS envoyé — ${reference}`} title="Enregistrer un SMS envoyé (maintenant)" disabled={contacts.isPending} onClick={() => noter("sms")}>💬</Button>
      <Button size="icon" variant="ghost" aria-label={`Programmer un rappel — ${reference}`} aria-expanded={rappel !== null} onClick={() => setRappel(rappel === null ? "" : null)}>📅</Button>
      {tentatives.length > 0 && <span className="text-xs text-muted-foreground" title="Tentatives de contact">{tentatives.length}</span>}
      {bon.rappel_date && (
        <span className="text-xs">
          🔄 {formatDateFr(bon.rappel_date)}{" "}
          <Button size="sm" variant="link" onClick={() => programmer(null)} aria-label={`Annuler le rappel — ${reference}`}>✕</Button>
        </span>
      )}
      {rappel !== null && (
        <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); if (rappel) programmer(rappel); }}>
          <label htmlFor={`rappel-${bon.id}`} className="sr-only">Date du rappel — {reference}</label>
          <Input id={`rappel-${bon.id}`} type="date" className="h-8 w-40" min={todayISO()} value={rappel} onChange={(e) => setRappel(e.target.value)} />
          <Button type="submit" size="sm" disabled={!rappel || contacts.isPending}>Programmer</Button>
        </form>
      )}
    </span>
  );
}
