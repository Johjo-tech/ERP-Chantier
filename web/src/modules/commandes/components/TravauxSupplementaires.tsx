import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEuros, montant } from "@/lib/money";
import { useSession, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import { peutEcrireTerrain } from "../domain/circuit";
import { badgeOrigine, lirePrixTravail, QUANTITE_DEFAUT, UNITE_DEFAUT, type Travail } from "../domain/prefacture";
import { useAjouterTravail, useChiffrerTravail, useSupprimerTravail } from "../hooks/useBons";


const LIBELLES_STATUT: Record<Travail["statut"], string> = { a_chiffrer: "à chiffrer", chiffre: "chiffré", integre: "intégré au bon", refuse: "refusé" };

/** « Demander le prix » : un seul champ, virgule admise, négatif refusé (BC-46, BC-72). */
function ChiffrerTravail({ travail, onResultat }: { travail: Travail; onResultat: (m: string, e?: unknown) => void }) {
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const chiffrer = useChiffrerTravail();
  function envoyer() {
    const p = lirePrixTravail(saisie);
    if (!p.ok || p.prix === null) return setErreur(p.ok ? "Indiquez un prix." : p.message);
    setErreur(null);
    chiffrer.mutate(
      { id: travail.id, prix: p.prix, quantite: travail.quantite ?? QUANTITE_DEFAUT, unite: travail.unite || UNITE_DEFAUT },
      { onSuccess: () => onResultat("Travail chiffré."), onError: (e) => onResultat("", e) }
    );
  }
  return (
    <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); envoyer(); }}>
      <label htmlFor={`prix-${travail.id}`} className="sr-only">Prix de vente HT de « {travail.libelle} »</label>
      <Input id={`prix-${travail.id}`} className="h-8 w-28" inputMode="decimal" placeholder="Prix HT" value={saisie} onChange={(e) => setSaisie(e.target.value)} aria-invalid={!!erreur} />
      <Button type="submit" size="sm" variant="outline" disabled={chiffrer.isPending}>Chiffrer</Button>
      {erreur && <span className="text-xs text-destructive">{erreur}</span>}
    </form>
  );
}

interface Props {
  bonId: string;
  travaux: readonly Travail[];
  circuitOuvert: boolean;
  onResultat: (m: string, e?: unknown) => void;
}

/**
 * Les travaux constatés en plus du bon (BC-16, BC-46) : ajoutés « à chiffrer »,
 * retirés, chiffrés par qui voit les prix. L'écriture suit `peut_ecrire()`.
 */
export function TravauxSupplementaires({ bonId, travaux, circuitOuvert, onResultat }: Props) {
  const { roleEffectif } = useSession();
  const prix = useVoitLesPrix();
  const ecrit = peutEcrireTerrain(roleEffectif) && circuitOuvert;
  const ajouter = useAjouterTravail();
  const supprimer = useSupprimerTravail();
  const [libelle, setLibelle] = useState("");
  const visibles = travaux.filter((t) => t.statut !== "integre");
  return (
    <section aria-labelledby="titre-travaux" className="flex flex-col gap-2">
      <h3 id="titre-travaux" className="text-sm font-semibold">Travaux supplémentaires ({visibles.length})</h3>
      {!visibles.length && <p className="text-sm text-muted-foreground">Aucun travail supplémentaire.</p>}
      <ul className="flex flex-col gap-2">
        {visibles.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
            <span>
              {t.libelle} <Badge variant="neutre">{badgeOrigine(t.origine)}</Badge>{" "}
              <span className="text-xs text-muted-foreground">
                {t.statut === "chiffre" && prix && t.prix_vente_ht !== null ? `${formatEuros(montant(t.prix_vente_ht))} HT` : LIBELLES_STATUT[t.statut]}
              </span>
            </span>
            <span className="flex items-center gap-2">
              {ecrit && prix && t.statut === "a_chiffrer" && <ChiffrerTravail travail={t} onResultat={onResultat} />}
              {ecrit && t.statut !== "refuse" && (
                <Button size="sm" variant="ghost" aria-label={`Retirer « ${t.libelle} »`} disabled={supprimer.isPending} onClick={() => supprimer.mutate(t.id, { onError: (e) => onResultat("", e) })}>✕</Button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {ecrit && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!libelle.trim()) return;
            ajouter.mutate(
              { bonId, tacheId: null, libelle },
              { onSuccess: () => { setLibelle(""); onResultat("Travail supplémentaire consigné — à chiffrer."); }, onError: (e) => onResultat("", e) }
            );
          }}
        >
          <label htmlFor="nouveau-travail" className="sr-only">Nouveau travail supplémentaire</label>
          <Input id="nouveau-travail" className="h-8 max-w-md" placeholder="Travail constaté en plus du bon" value={libelle} onChange={(e) => setLibelle(e.target.value)} />
          <Button type="submit" size="sm" variant="secondary" disabled={ajouter.isPending || !libelle.trim()}>Ajouter</Button>
        </form>
      )}
    </section>
  );
}
