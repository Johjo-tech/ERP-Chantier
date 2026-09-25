import { useState, type FormEvent } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { messageErreur } from "@/lib/erreurs";
import { ROLES_LIBELLES, type RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { useDroitsChantier } from "../hooks/useDroitsChantier";
import { useAffecter, useAffectations, useMembres, useRetirerAffectation } from "../hooks/useFiche";

const libelleRole = (r: string) => ROLES_LIBELLES[r as RoleMembre] ?? r;

/**
 * Les intervenants du chantier. Pour un technicien ou un sous-traitant,
 * l'affectation ouvre la vue du chantier (RLS `est_affecte_au_chantier`) ;
 * la poser est un acte de conduite de travaux (« chantiers / modifier »).
 */
export function BlocAffectations({ chantierId }: { chantierId: string }) {
  const affectations = useAffectations(chantierId);
  const membres = useMembres();
  const droits = useDroitsChantier();
  const affecter = useAffecter(chantierId);
  const retirer = useRetirerAffectation(chantierId);
  const [profil, setProfil] = useState("");
  const [role, setRole] = useState("");

  if (affectations.isPending) return <Chargement />;
  if (affectations.isError) return <Erreur erreur={affectations.error} reessayer={() => void affectations.refetch()} />;
  const deja = new Set(affectations.data.map((a) => a.profile_id));
  const nom = (id: string) => {
    const m = membres.data?.find((x) => x.profile_id === id);
    return m?.profiles?.nom || m?.profiles?.email || "Compte inconnu";
  };
  const candidats = (membres.data ?? []).filter((m) => m.actif && !deja.has(m.profile_id));

  function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!profil) return;
    affecter.mutate({ profileId: profil, role: role.trim() || null }, { onSuccess: () => { setProfil(""); setRole(""); } });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Intervenants</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {(affecter.isError || retirer.isError) && <Alert variant="erreur">{messageErreur(affecter.error ?? retirer.error)}</Alert>}
        {affectations.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Personne n'est affecté : le terrain (techniciens, sous-traitants) ne voit pas ce chantier.</p>
        ) : (
          <ul className="divide-y divide-border">
            {affectations.data.map((a) => {
              const m = membres.data?.find((x) => x.profile_id === a.profile_id);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                  <span className="font-medium">{nom(a.profile_id)}</span>
                  {m && <Badge variant="neutre">{libelleRole(m.role)}</Badge>}
                  {a.role_sur_chantier && <span className="text-muted-foreground">{a.role_sur_chantier}</span>}
                  {droits.gere && (
                    <span className="ml-auto">
                      <BoutonConfirme libelle="Retirer" question={`Retirer ${nom(a.profile_id)} du chantier ?`} onConfirmer={() => retirer.mutate(a.id)} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {droits.gere && (
          <form onSubmit={soumettre} aria-label="Affecter un intervenant" className="grid gap-2 border-t border-border pt-2 sm:grid-cols-3">
            <ChampChoix
              libelle="Intervenant"
              valeur={profil}
              onChange={setProfil}
              options={[{ valeur: "", libelle: membres.isPending ? "Chargement…" : "— Choisir —" }, ...candidats.map((m) => ({ valeur: m.profile_id, libelle: `${m.profiles?.nom || m.profiles?.email || m.profile_id} (${libelleRole(m.role)})` }))]}
            />
            <ChampTexte libelle="Rôle sur le chantier (facultatif)" valeur={role} onChange={setRole} />
            <div className="flex items-end">
              <Button type="submit" size="sm" variant="secondary" disabled={!profil || affecter.isPending}>Affecter</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
