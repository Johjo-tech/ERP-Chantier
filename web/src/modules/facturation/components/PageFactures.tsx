import { useState } from "react";
import { useNavigate } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { useModeDiscret } from "@/lib/modeDiscret";
import { useEntreeDefile, useRechercheDifferee } from "@/lib/useRecherche";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { estAvoir } from "@/modules/documents/domain/totaux";
import { motifRoleFacture } from "../domain/actions";
import { syntheseListe } from "../domain/carte";
import { criteresDeLaVue, filtrageActif, retenu } from "../domain/filtresEcran";
import { useCartesFactures } from "../hooks/useCartesFactures";
import { useFiltresFacturation } from "../hooks/useEcranFactures";
import { ActionsCarteFacture } from "./ActionsCarteFacture";
import { BarreFiltresFactures } from "./BarreFiltresFactures";
import { CarteFacture } from "./CarteFacture";
import { OngletsFacturation } from "./OngletsFacturation";
import { ApercuFactureParId } from "./PageApercuFacture";

type Vue = "factures" | "avoirs";

/**
 * Facturation › Factures et › Avoirs (`renderFactures`, app.js l. 5162) : les
 * sous-onglets en tête, le titre et ses deux boutons, la barre de filtres,
 * puis les cartes. Les avoirs restent AUSSI dans la liste des factures : ce
 * sont des pièces de la même suite ; l'onglet Avoirs ne les isole pas, il les
 * rend trouvables.
 */
export function PageFactures({ vue = "factures" }: { vue?: Vue }) {
  useModeDiscret();
  const navigate = useNavigate();
  const { cartes, soldes, chargement, erreur, reessayer, droits, aujourdhui } = useCartesFactures();
  const peutCreer = usePermission("factures", "creer");
  const peutModifier = usePermission("factures", "modifier");
  // `peutImporterFactures` : créer ET modifier — une pièce importée est émise d'emblée.
  const peutImporter = peutCreer && peutModifier;
  const [filtres, changer] = useFiltresFacturation();
  const saisie = useRechercheDifferee(filtres.recherche, (q) => changer({ recherche: q }));
  const [apercu, setApercu] = useState<string | null>(null);
  const cle = vue === "avoirs" ? "avoirs" : "liste";
  const criteres = criteresDeLaVue(filtres, cle);
  const actif = filtrageActif(criteres);

  const dansLaVue = vue === "avoirs" ? cartes.filter((c) => estAvoir(c.f.type_document)) : cartes;
  const retenues = dansLaVue.filter((c) => retenu(c.filtrable, criteres));
  const defile = useEntreeDefile("facture-card", retenues.map((c) => c.f.id), criteres.recherche, saisie);
  const motifRole = motifRoleFacture(droits);
  const synthese = syntheseListe(retenues.length, dansLaVue.length, "facture", actif);

  const liste = () => {
    if (vue === "avoirs" && !dansLaVue.length) {
      return <div className="empty">Aucun avoir pour cette société. Un avoir s'établit depuis une facture émise, par le bouton « ↩ Établir un avoir ».</div>;
    }
    if (!retenues.length) {
      // Une recherche infructueuse n'est pas une société vide : les confondre enverrait chercher une panne.
      return <div className="empty">{dansLaVue.length && actif ? "Aucune facture ne correspond à vos filtres." : "Aucune facture pour cette société."}</div>;
    }
    return (
      <>
        {synthese && <div className="card-sub" style={{ marginBottom: "10px" }}>{synthese}</div>}
        {retenues.map((c) => (
          <CarteFacture
            key={c.f.id}
            f={c.f}
            ht={c.ht}
            ttc={c.ttc}
            etat={c.etat}
            numerosBC={c.numerosBC}
            origines={c.origines}
            requete={criteres.recherche}
            cherchables={c.cherchables}
            apports={c.apports}
            enEvidence={defile.enEvidence === c.f.id}
            aujourdhui={aujourdhui}
            ouvrir={() => setApercu(c.f.id)}
            refusImpression={c.actions.peutImprimer ? null : c.refusImpression}
            actions={
              <ActionsCarteFacture
                f={c.f}
                ttc={c.ttc}
                actions={c.actions}
                verrou={c.verrou}
                plateforme={c.plateforme}
                imputable={c.imputable}
                solde={c.solde}
                soldes={soldes}
                destinataire={c.destinataire}
                avoirEtabli={() => void navigate("/factures/avoirs")}
              />
            }
          />
        ))}
      </>
    );
  };

  return (
    <>
      <OngletsFacturation />
      <div className="page-head">
        <h1>{vue === "avoirs" ? "Avoirs" : "Factures"}</h1>
        {vue === "factures" && (
          <div style={{ display: "flex", gap: "8px" }}>
            {peutImporter && <button type="button" className="btn" onClick={() => void navigate("/factures/import")}>📥 Reprendre un historique</button>}
            {peutCreer && <button type="button" className="btn primary" onClick={() => void navigate("/factures/nouvelle")}>+ Nouvelle facture</button>}
          </div>
        )}
      </div>
      {motifRole && <div className="card-sub" style={{ margin: "0 0 12px" }}>{motifRole}</div>}
      <BarreFiltresFactures vue={cle} filtres={filtres} changer={changer} saisie={saisie.saisie} onSaisie={saisie.setSaisie} onEntree={defile.surTouche} />
      {vue === "avoirs" && (
        <div className="card-sub" style={{ marginBottom: "14px" }}>
          Les avoirs rectifient une facture émise. Ils portent leur propre série « AV » et comptent en négatif ; leurs montants s'enregistrent positifs, le type dit le sens.
        </div>
      )}
      <div id="formZoneFacture" />
      <div id="factureListZone">
        {chargement && <Chargement />}
        {erreur && <Erreur erreur={erreur} reessayer={reessayer} />}
        {!chargement && !erreur && liste()}
      </div>
      {apercu && <ApercuFactureParId id={apercu} fermer={() => setApercu(null)} />}
    </>
  );
}
