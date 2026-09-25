import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateFr, todayISO } from "@/lib/dates";
import type { CartePlanning } from "../domain/cartes";
import { ajouterTentative, heureDeParis, refusRappel, retirerTentative } from "../domain/contacts";
import { useContacts } from "../hooks/usePlanning";
import { usePlanningContexte } from "./contexte";

const arreter = (e: { stopPropagation: () => void }) => e.stopPropagation();

/** La trace seule — tentatives, rappel prévu — sur une carte déjà posée : on ne relance plus quelqu'un qu'on a joint. */
export function TraceContacts({ carte }: { carte: CartePlanning }) {
  if (!carte.tentatives.length && !carte.bon.rappel_date) return null;
  return (
    <div className="flex flex-wrap gap-1 text-[11px]">
      {carte.bon.rappel_date && <span className="rounded bg-amber-100 px-1">🔄 Rappeler le {formatDateFr(carte.bon.rappel_date)}</span>}
      {carte.tentatives.map((t) => (
        <span key={t.id} className="rounded bg-muted px-1">{t.type === "appel" ? "📞" : "💬"} {formatDateFr(t.date)} {t.heure}</span>
      ))}
    </div>
  );
}

function FormulaireRappel({ onValider, onAnnuler }: { onValider: (date: string) => void; onAnnuler: () => void }) {
  const [date, setDate] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Programmer un rappel">
      <Input aria-label="Date du rappel" type="date" min={todayISO()} className="h-7 w-36 px-1 text-xs" value={date} onChange={(e) => setDate(e.target.value)} />
      <Button
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => {
          const refus = refusRappel(date, todayISO());
          if (refus) setErreur(refus);
          else onValider(date);
        }}
      >
        Programmer
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onAnnuler}>Annuler</Button>
      {erreur && <span role="alert" className="text-xs text-destructive">{erreur}</span>}
    </div>
  );
}

/**
 * Le suivi des contacts (PLN-07) : on joint un locataire, un gardien, un
 * syndic — la zone se montre donc quel que soit le logement. Les gestes
 * s'écrivent sur le bon : seulement pour qui peut le modifier.
 */
export function ZoneContacts({ carte }: { carte: CartePlanning }) {
  const { peutContacter, signaler } = usePlanningContexte();
  const { tentatives, rappel } = useContacts();
  const [rappelOuvert, setRappelOuvert] = useState(false);
  if (!peutContacter) return <TraceContacts carte={carte} />;
  const noter = (type: "appel" | "sms") => {
    const maintenant = new Date();
    tentatives.mutate(
      { bcId: carte.bcId, tentatives: ajouterTentative(carte.tentatives, type, todayISO(), heureDeParis(maintenant), crypto.randomUUID()) },
      { onSuccess: () => signaler(type === "appel" ? "Tentative d'appel enregistrée." : "SMS enregistré."), onError: (e) => signaler("", e) }
    );
  };
  const suite = { onError: (e: unknown) => signaler("", e) };
  return (
    <div className="flex flex-col gap-1 text-xs" onClick={arreter}>
      <div className="flex flex-wrap items-center gap-1">
        <Button size="sm" variant="outline" className="h-7 px-2" title="Enregistrer une tentative d'appel (maintenant)" onClick={() => noter("appel")}>📞 Appel</Button>
        <Button size="sm" variant="outline" className="h-7 px-2" title="Enregistrer un SMS envoyé (maintenant)" onClick={() => noter("sms")}>💬 SMS</Button>
        <Button size="sm" variant="outline" className="h-7 px-2" title="Programmer un rappel" onClick={() => setRappelOuvert(true)}>📅 Rappel</Button>
      </div>
      {rappelOuvert && (
        <FormulaireRappel
          onAnnuler={() => setRappelOuvert(false)}
          onValider={(date) => {
            setRappelOuvert(false);
            rappel.mutate({ bcId: carte.bcId, date }, { onSuccess: () => signaler(`Rappel programmé pour le ${formatDateFr(date)}.`), ...suite });
          }}
        />
      )}
      <div className="flex flex-wrap gap-1">
        {carte.bon.rappel_date && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1">
            🔄 Rappeler le {formatDateFr(carte.bon.rappel_date)}
            <button type="button" aria-label="Annuler le rappel" onClick={() => rappel.mutate({ bcId: carte.bcId, date: null }, suite)}>✕</button>
          </span>
        )}
        {carte.tentatives.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1 rounded bg-muted px-1">
            {t.type === "appel" ? "📞" : "💬"} {formatDateFr(t.date)} {t.heure}
            <button type="button" aria-label="Retirer cette tentative" onClick={() => tentatives.mutate({ bcId: carte.bcId, tentatives: retirerTentative(carte.tentatives, t.id) }, suite)}>✕</button>
          </span>
        ))}
      </div>
    </div>
  );
}
