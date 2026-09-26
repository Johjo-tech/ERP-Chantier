import { useState } from "react";
import { Erreur } from "@/components/etats/Etats";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { afficherToast } from "@/lib/toast";
import { categorieDe, categoriesAchat, totauxParCategorie, trierAchats } from "../domain/achats";
import { useAchats, useCategoriesAchat, useSupprimerAchat } from "../hooks/useFiche";
import { FormulaireAchat } from "./FormulaireAchat";

/**
 * « 💰 Achats » (`chantierAchatsHTML`, CHA-11) : totaux par catégorie avec leur
 * part du total — un clic filtre —, ajout, liste. Réservé à qui gère le
 * chantier (lecture et écriture « chantiers / modifier »).
 */
export function BlocAchats({ chantierId }: { chantierId: string }) {
  useModeDiscret();
  const achats = useAchats(chantierId);
  const referentiel = useCategoriesAchat();
  const supprimer = useSupprimerAchat(chantierId);
  const [filtre, setFiltre] = useState("");
  const categories = categoriesAchat(referentiel.data ?? []);
  const liste = achats.data ?? [];
  const { parCategorie, total } = totauxParCategorie(categories, liste);
  const visibles = trierAchats(filtre ? liste.filter((a) => a.categorie === filtre) : liste);

  return (
    <div className="chantier-section" style={{ gridColumn: "1/-1" }}>
      <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>💰 Achats</span>
        <span className="achats-grand-total">
          {formatEurosEcran(total)}{" "}
          <span className="card-sub" style={{ fontWeight: 400 }}>
            au total
          </span>
        </span>
      </div>
      {achats.isError && <Erreur erreur={achats.error} reessayer={() => void achats.refetch()} />}
      <div className="achats-totals" role="group" aria-label="Totaux par catégorie">
        {parCategorie.map(({ categorie: cat, montant: m, pourcentage }) => (
          <div
            key={cat.code}
            className={`achats-total-card${filtre === cat.code ? " is-active" : ""}`}
            role="button"
            tabIndex={0}
            aria-pressed={filtre === cat.code}
            style={{ "--cat-color": cat.couleur } as React.CSSProperties}
            onClick={() => setFiltre(cat.code)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setFiltre(cat.code);
              }
            }}
          >
            <div className="achats-total-icon" style={{ background: `${cat.couleur}22`, color: cat.couleur }}>
              {cat.icone}
            </div>
            <div className="achats-total-info">
              <div className="achats-total-label">{cat.libelle}</div>
              <div className="achats-total-montant">{formatEurosEcran(m)}</div>
            </div>
            <div className="achats-total-bar-wrap">
              <div className="achats-total-bar" style={{ width: `${pourcentage}%`, background: cat.couleur }} />
            </div>
          </div>
        ))}
      </div>
      {filtre && (
        <button type="button" className="btn small ghost" style={{ marginBottom: "10px" }} onClick={() => setFiltre("")}>
          ✕ Retirer le filtre "{categorieDe(categories, filtre).libelle}"
        </button>
      )}
      <FormulaireAchat chantierId={chantierId} categories={categories} />
      <div className="achats-list">
        {visibles.length ? (
          visibles.map((a) => {
            const cat = categorieDe(categories, a.categorie);
            return (
              <div key={a.id} className="achat-row" style={{ "--cat-color": cat.couleur } as React.CSSProperties}>
                <div className="achat-row-icon" style={{ background: `${cat.couleur}22`, color: cat.couleur }}>
                  {cat.icone}
                </div>
                <div className="achat-row-main">
                  <div className="achat-designation">
                    {a.designation}
                    {a.heures ? (
                      <>
                        {" "}
                        <span className="card-sub">({a.heures}h)</span>
                      </>
                    ) : null}
                  </div>
                  <div className="achat-date">
                    {cat.libelle} · {formatDateFr(a.date_achat)}
                    {a.fournisseur ? ` · ${a.fournisseur}` : ""}
                  </div>
                </div>
                <div className="achat-montant">{formatEurosEcran(montant(a.montant))}</div>
                <button
                  type="button"
                  className="todo-remove"
                  title="Supprimer"
                  aria-label={`Supprimer l'achat « ${a.designation} »`}
                  onClick={() => supprimer.mutate(a.id, { onError: (err) => afficherToast(messageErreur(err)) })}
                >
                  ✕
                </button>
              </div>
            );
          })
        ) : (
          <div className="empty">Aucun achat enregistré pour l'instant.</div>
        )}
      </div>
    </div>
  );
}
