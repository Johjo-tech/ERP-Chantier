import { useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { BarreRecherche } from "@/components/ui/barre-recherche";
import { todayISO } from "@/lib/dates";
import { correspond } from "@/lib/recherche";
import { useToastErreur } from "@/modules/materiel/components/communs";
import { echeanceDocumentSousTraitant, type SousTraitant } from "../domain/intervenants";
import { useDocumentsSousTraitants, useDroitsRh, useGererIntervenants, useSeuilsRh, useSousTraitants } from "../hooks/useRh";
import { FormulaireSousTraitant } from "./FormulaireSousTraitant";

/**
 * Les sous-traitants (PAR-06), au HTML de `renderSousTraitantsSection`
 * (app.js l. 18189) : rangés, comme dans l'ancien écran, sous Réglages ›
 * Intervenants (D-ECR-PAR-05). L'écriture suit `peut_ecrire()` ET la matrice
 * (D-RH-05). En plus de l'ancien, décidés : la pastille d'un document expiré
 * ou à renouveler, et « sans compte » quand l'entreprise n'a pas de compte relié.
 */
export function OngletSousTraitants() {
  const liste = useSousTraitants();
  const documents = useDocumentsSousTraitants();
  const droits = useDroitsRh();
  const seuils = useSeuilsRh();
  const gerer = useGererIntervenants();
  useToastErreur(gerer.supprimerSousTraitant.error);
  const [recherche, setRecherche] = useState("");
  const [edition, setEdition] = useState<SousTraitant | "nouveau" | null>(null);

  const tous = liste.data ?? [];
  const filtres = tous.filter((s) => correspond(recherche, s.nom, s.metier, s.metiers.join(" "), s.ville, s.siret));
  const docsDe = (id: string) => (documents.data ?? []).filter((d) => d.sousTraitantId === id);
  const aujourdHui = todayISO();

  return (
    <>
      <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "30px" }}>
        <span>Sous-traitants</span>
        {droits.intervenants && (
          <button type="button" className="btn small primary" onClick={() => setEdition("nouveau")}>
            + Nouveau sous-traitant
          </button>
        )}
      </div>
      <BarreRecherche id="sousTraitant" libelle="Rechercher un sous-traitant" valeur={recherche} onChange={setRecherche} placeholder="Rechercher : nom, métier, ville, SIRET…" affiches={filtres.length} total={tous.length} />
      <div id="formZoneSousTraitant">
        {edition && <FormulaireSousTraitant key={edition === "nouveau" ? "nouveau" : edition.id} fiche={edition === "nouveau" ? null : edition} fiches={tous} documents={edition === "nouveau" ? [] : docsDe(edition.id)} onFermer={() => setEdition(null)} />}
      </div>
      <div id="liste-sousTraitant">
        {liste.isPending && <Chargement />}
        {liste.isError && <Erreur erreur={liste.error} reessayer={() => void liste.refetch()} />}
        {liste.isSuccess && filtres.length === 0 && <div className="empty">{recherche.trim() ? "Aucun sous-traitant ne correspond à la recherche." : "Aucun sous-traitant enregistré pour cette société."}</div>}
        {filtres.map((s) => {
          const alertes = docsDe(s.id).map((d) => echeanceDocumentSousTraitant(d.dateValidite, aujourdHui, seuils.documentLegal)).filter((a) => a !== null);
          const metiers = s.metiers.length ? s.metiers.join(", ") : s.metier;
          const expire = alertes.some((a) => a.niveau === "expire");
          return (
            <div key={s.id} className="card">
              <div className="card-row">
                <div>
                  <div className="card-title">
                    {s.nom}
                    {expire && (
                      <span className="badge danger" style={{ marginLeft: "6px" }}>
                        document expiré
                      </span>
                    )}
                    {!expire && alertes.length > 0 && (
                      <span className="badge warn" style={{ marginLeft: "6px" }}>
                        document à renouveler
                      </span>
                    )}
                  </div>
                  {(s.telephone || s.email) && <div className="card-sub">{[s.telephone, s.email].filter(Boolean).join(" · ")}</div>}
                  {metiers && <div className="card-sub">🔧 {metiers}</div>}
                  {!s.contactProfileId && (
                    <div className="card-sub" title="Sans compte relié, l'entreprise ne voit pas ses tâches au planning">
                      ⚠ sans compte
                    </div>
                  )}
                </div>
              </div>
              {droits.intervenants && (
                <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
                  <button type="button" className="btn small" onClick={() => setEdition(s)}>
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="btn small danger"
                    onClick={() => {
                      if (window.confirm("Supprimer définitivement cet élément ?")) gerer.supprimerSousTraitant.mutate({ id: s.id, documents: docsDe(s.id) });
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
