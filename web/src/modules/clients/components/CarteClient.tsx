import type { ClientListe } from "../api/clients";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { questionSuppression } from "../domain/client";
import { useLireUsagesClient, useSupprimerClient, useSupprimerInterlocuteur } from "../hooks/useClients";
import { FormulaireInterlocuteur, type InterlocuteurEdite } from "./FormulaireInterlocuteur";

/** La question de l'ancien (`deleteItem`) pour un interlocuteur. */
const QUESTION_SUPPRESSION = "Supprimer définitivement cet élément ?";
/** Un refus de la base se lit plus longtemps qu'une réussite (8 s, `showToast(…, 'danger', 8000)` de l'ancien). */
const BULLE_REFUS_MS = 8000;

type Interlocuteur = ClientListe["interlocuteurs"][number];

function ligneContact(i: Interlocuteur): string {
  return `👤 ${i.nom}${i.fonction ? ` — ${i.fonction}` : ""}${i.telephone ? ` · ${i.telephone}` : ""}${i.email ? ` · ${i.email}` : ""}`;
}

/**
 * Une carte de la liste des clients (`listeClientsHTML`) : le nom, téléphone ·
 * adresse, l'e-mail, les interlocuteurs, puis les trois boutons. Le
 * formulaire d'interlocuteur s'ouvre DANS la carte, comme avant.
 */
export function CarteClient({
  client: c,
  interlocuteur,
  onModifier,
  onInterlocuteur,
}: {
  client: ClientListe;
  /** L'interlocuteur en cours d'édition dans CETTE carte ; `undefined` : aucun. */
  interlocuteur: InterlocuteurEdite | null | undefined;
  onModifier: () => void;
  onInterlocuteur: (i: InterlocuteurEdite | null | undefined) => void;
}) {
  const peutModifier = usePermission("clients", "modifier");
  const peutSupprimer = usePermission("clients", "supprimer");
  const supprimer = useSupprimerClient();
  const supprimerContact = useSupprimerInterlocuteur(c.id);
  const lireUsages = useLireUsagesClient();
  const contacts = [...c.interlocuteurs].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  async function supprimerClient() {
    // Les pièces qui citent le client se disent AVANT de confirmer (CLI-51) : l'ancien supprimait sans le dire.
    const question = questionSuppression(await lireUsages(c.id).catch((err: unknown) => {
      console.error("Usages du client illisibles :", err);
      return undefined;
    }));
    if (!window.confirm(question)) return;
    supprimer.mutate(c.id, { onError: (err) => afficherToast(messageErreur(err), "error", BULLE_REFUS_MS) });
  }

  function supprimerInterlocuteur(id: string) {
    if (!window.confirm(QUESTION_SUPPRESSION)) return;
    supprimerContact.mutate(id, { onError: (err) => afficherToast(messageErreur(err), "error", BULLE_REFUS_MS) });
  }

  return (
    <div className="card">
      <div className="card-row">
        <div>
          <div className="card-title">{c.nom}</div>
          <div className="card-sub">
            {c.telephone ?? ""}
            {c.telephone && c.adresse ? " · " : ""}
            {c.adresse ?? ""}
          </div>
          {c.email && <div className="card-sub">{c.email}</div>}
        </div>
      </div>
      {contacts.length > 0 && (
        <div style={{ marginTop: "8px" }}>
          {contacts.map((i) => (
            <div key={i.id} className="card-sub" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
              <span>{ligneContact(i)}</span>
              {peutModifier && (
                <span style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <button type="button" className="btn small" style={{ padding: "2px 8px" }} title="Modifier cet interlocuteur" onClick={() => onInterlocuteur(i)}>
                    Modifier
                  </button>
                  <button type="button" className="btn small danger" style={{ padding: "2px 7px" }} aria-label={`Supprimer ${i.nom}`} onClick={() => supprimerInterlocuteur(i.id)}>
                    ✕
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {(peutModifier || peutSupprimer) && (
        <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {peutModifier && (
            <>
              <button type="button" className="btn small primary" onClick={onModifier}>
                Modifier le client
              </button>
              <button type="button" className="btn small" onClick={() => onInterlocuteur(null)}>
                + Ajouter un interlocuteur
              </button>
            </>
          )}
          {peutSupprimer && (
            <button type="button" className="btn small danger" disabled={supprimer.isPending} onClick={() => void supprimerClient()}>
              Supprimer le client
            </button>
          )}
        </div>
      )}
      {interlocuteur !== undefined && (
        <FormulaireInterlocuteur key={interlocuteur?.id ?? "nouveau"} client={c} edite={interlocuteur} onFermer={() => onInterlocuteur(undefined)} />
      )}
    </div>
  );
}
