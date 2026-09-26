import { useState, type CSSProperties } from "react";
import { messageErreur } from "@/lib/erreurs";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { afficherToast } from "@/lib/toast";
import { useSession, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import { COULEUR_TRAVAIL_SUPPLEMENTAIRE, peutEcrireTerrain } from "../domain/circuit";
import { lirePrixTravail, QUANTITE_DEFAUT, UNITE_DEFAUT, type Travail } from "../domain/prefacture";
import { useAjouterTravail, useChiffrerTravail, useSupprimerTravail } from "../hooks/useBons";

const echec = (e: unknown) => afficherToast(messageErreur(e));

/** Le ✕ et le 💶 d'une ligne : le prix se demande par `prompt`, comme `demanderPrixTravailSupplementaire`. */
function GestesTravail({ travail, prix }: { travail: Travail; prix: boolean }) {
  useModeDiscret();
  const chiffrer = useChiffrerTravail();
  const supprimer = useSupprimerTravail();
  function demanderPrix() {
    const saisie = window.prompt("Prix de vente HT :");
    if (saisie === null) return;
    const p = lirePrixTravail(saisie);
    if (!p.ok || p.prix === null) return afficherToast(p.ok ? "Montant invalide." : p.message);
    chiffrer.mutate(
      { id: travail.id, prix: p.prix, quantite: travail.quantite ?? QUANTITE_DEFAUT, unite: travail.unite || UNITE_DEFAUT },
      { onSuccess: () => afficherToast("Travail chiffré.", "success"), onError: echec }
    );
  }
  return (
    <>
      {travail.statut !== "chiffre" && prix && (
        <button type="button" className="btn small" aria-label={`Chiffrer « ${travail.libelle} »`} disabled={chiffrer.isPending} onClick={demanderPrix}>💶</button>
      )}
      <button type="button" className="btn small danger" aria-label={`Retirer « ${travail.libelle} »`} disabled={supprimer.isPending} onClick={() => supprimer.mutate(travail.id, { onError: echec })}>✕</button>
    </>
  );
}

/**
 * Les travaux constatés en plus du bon (`renderTravauxSupplementairesListe`) :
 * une `achat-row` violette par travail, son prix s'il est chiffré et visible.
 * Les gestes suivent `peut_ecrire()` ; un travail repris au bon n'y figure plus.
 */
export function ListeTravaux({ travaux, ecrit }: { travaux: readonly Travail[]; ecrit: boolean }) {
  useModeDiscret();
  const prix = useVoitLesPrix();
  const visibles = travaux.filter((t) => t.statut !== "integre");
  if (!visibles.length) return <div className="empty">Aucun travail supplémentaire.</div>;
  const style = { "--cat-color": COULEUR_TRAVAIL_SUPPLEMENTAIRE } as CSSProperties;
  return (
    <>
      {visibles.map((t) => {
        const chiffre = t.statut === "chiffre";
        const detail = chiffre && prix && t.prix_vente_ht !== null ? `${formatEurosEcran(montant(t.prix_vente_ht))} HT` : chiffre ? "chiffré" : "à chiffrer";
        return (
          <div key={t.id} className="achat-row" style={style}>
            <div className="achat-row-icon" style={{ background: `${COULEUR_TRAVAIL_SUPPLEMENTAIRE}22`, color: COULEUR_TRAVAIL_SUPPLEMENTAIRE }} aria-hidden="true">➕</div>
            <div className="achat-row-main">
              <div className="achat-designation">{t.libelle}</div>
              <div className="achat-date">{detail} · constaté par {t.origine || "—"}</div>
            </div>
            {ecrit && t.statut !== "refuse" && <GestesTravail travail={t} prix={prix} />}
          </div>
        );
      })}
    </>
  );
}

/** La saisie d'un travail en plus (`entretien-add-row`) : il part « à chiffrer », sans prix. */
export function AjoutTravail({ bonId }: { bonId: string }) {
  useModeDiscret();
  const ajouter = useAjouterTravail();
  const [libelle, setLibelle] = useState("");
  return (
    <form
      className="entretien-add-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!libelle.trim()) return;
        ajouter.mutate(
          { bonId, tacheId: null, libelle },
          { onSuccess: () => { setLibelle(""); afficherToast("Travail supplémentaire consigné — à chiffrer.", "success"); }, onError: echec }
        );
      }}
    >
      <input type="text" aria-label="Nouveau travail supplémentaire" placeholder="Ex : Remplacement d'un raccord non prévu…" style={{ flex: 1 }} value={libelle} onChange={(e) => setLibelle(e.target.value)} />
      <button type="submit" className="btn primary" disabled={ajouter.isPending}>+ Ajouter</button>
    </form>
  );
}

/** Les travaux supplémentaires dans le panneau du circuit : titre de section, saisie, liste — l'ordre de la fenêtre conducteur. */
export function TravauxSupplementaires({ bonId, travaux, circuitOuvert }: { bonId: string; travaux: readonly Travail[]; circuitOuvert: boolean }) {
  useModeDiscret();
  const { roleEffectif } = useSession();
  const ecrit = peutEcrireTerrain(roleEffectif) && circuitOuvert;
  return (
    <section aria-label="Travaux supplémentaires">
      <div className="section-title" style={{ marginTop: "16px" }}>➕ Travaux supplémentaires</div>
      {ecrit && <AjoutTravail bonId={bonId} />}
      <div style={{ marginTop: "8px" }}>
        <ListeTravaux travaux={travaux} ecrit={ecrit} />
      </div>
    </section>
  );
}
