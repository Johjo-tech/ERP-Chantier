import { useId, useState, type FormEvent } from "react";
import { Erreur } from "@/components/etats/Etats";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { ROLES_LIBELLES, type RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { useDroitsChantier } from "../hooks/useDroitsChantier";
import { useAffecter, useAffectations, useMembres, useRetirerAffectation } from "../hooks/useFiche";

const libelleRole = (r: string) => ROLES_LIBELLES[r as RoleMembre] ?? r;
const signaler = (err: unknown) => afficherToast(messageErreur(err));

/**
 * Les intervenants du chantier — une section que l'ancienne fiche n'avait pas,
 * dans ses habits (D-ECR-CHA-09). Pour un technicien ou un sous-traitant,
 * l'affectation ouvre la vue du chantier (RLS `est_affecte_au_chantier`) ; la
 * poser est un acte de conduite de travaux (« chantiers / modifier »).
 */
export function BlocAffectations({ chantierId }: { chantierId: string }) {
  const affectations = useAffectations(chantierId);
  const membres = useMembres();
  const droits = useDroitsChantier();
  const affecter = useAffecter(chantierId);
  const retirer = useRetirerAffectation(chantierId);
  const [profil, setProfil] = useState("");
  const [role, setRole] = useState("");
  const ids = { profil: useId(), role: useId() };

  const liste = affectations.data ?? [];
  const deja = new Set(liste.map((a) => a.profile_id));
  const nom = (id: string) => {
    const m = membres.data?.find((x) => x.profile_id === id);
    return m?.profiles?.nom || m?.profiles?.email || "Compte inconnu";
  };
  const candidats = (membres.data ?? []).filter((m) => m.actif && !deja.has(m.profile_id));

  function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!profil) return afficherToast("Choisissez un intervenant.");
    affecter.mutate(
      { profileId: profil, role: role.trim() || null },
      {
        onSuccess: () => {
          setProfil("");
          setRole("");
        },
        onError: signaler,
      }
    );
  }

  return (
    <div className="chantier-section" style={{ gridColumn: "1/-1" }}>
      <div className="section-title">👥 Intervenants</div>
      {affectations.isError && <Erreur erreur={affectations.error} reessayer={() => void affectations.refetch()} />}
      {affectations.isSuccess && liste.length === 0 && <div className="empty">Personne n'est affecté : le terrain (techniciens, sous-traitants) ne voit pas ce chantier.</div>}
      {liste.map((a) => {
        const m = membres.data?.find((x) => x.profile_id === a.profile_id);
        return (
          <div key={a.id} className="chantier-file-row">
            <span style={{ flex: 1 }}>
              <b>{nom(a.profile_id)}</b>
              {m && <span className="card-sub"> · {libelleRole(m.role)}</span>}
              {a.role_sur_chantier && <span className="card-sub"> · {a.role_sur_chantier}</span>}
            </span>
            {droits.gere && (
              <button
                type="button"
                className="btn small danger"
                aria-label={`Retirer ${nom(a.profile_id)} du chantier`}
                onClick={() => {
                  if (window.confirm(`Retirer ${nom(a.profile_id)} du chantier ?`)) retirer.mutate(a.id, { onError: signaler });
                }}
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
      {droits.gere && (
        <form onSubmit={soumettre} aria-label="Affecter un intervenant" className="field-grid" style={{ marginTop: "12px" }}>
          <div className="field">
            <label htmlFor={ids.profil}>Intervenant</label>
            <select id={ids.profil} value={profil} onChange={(e) => setProfil(e.target.value)}>
              <option value="">— Choisir —</option>
              {candidats.map((m) => (
                <option key={m.profile_id} value={m.profile_id}>
                  {m.profiles?.nom || m.profiles?.email || m.profile_id} ({libelleRole(m.role)})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={ids.role}>Rôle sur le chantier (facultatif)</label>
            <input type="text" id={ids.role} value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
          <div>
            <button type="submit" className="btn small primary" disabled={affecter.isPending}>
              Affecter
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
