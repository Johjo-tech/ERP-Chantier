import { useState } from "react";
import { useNavigate } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { useFiltresAdresse } from "@/lib/useFiltresAdresse";
import { useEntreeDefile, useRechercheDifferee } from "@/lib/useRecherche";
import { useModeDiscret } from "@/lib/modeDiscret";
import { Can } from "@/modules/auth-roles/components/Can";
import { useClients } from "@/modules/clients/hooks/useClients";
import { useCroisement } from "@/modules/facturation/hooks/useCroisement";
import { useConducteurs } from "@/modules/societes/hooks/useConducteurs";
import { useFonctionnalite } from "@/modules/societes/hooks/useFonctionnalite";
import type { BonDeLaListe } from "../api/bons";
import { useLiensDesBons } from "../hooks/useLiensDesBons";
import { syntheseListe } from "../domain/carte";
import { filtrerBons, FILTRES_VIDES } from "../domain/filtres";
import { optionsDesFiltres } from "../domain/optionsFiltres";
import { useBons, useMetiersDeclares } from "../hooks/useBons";
import { BarreFiltresBons } from "./BarreFiltresBons";
import { CarteBon } from "./CarteBon";

/** « 📄 Importer un BC (PDF ou photo) » : le fichier choisi part à la lecture automatique. */
function BoutonImporter() {
  const navigate = useNavigate();
  return (
    <label className="btn" style={{ cursor: "pointer" }}>
      📄 Importer un BC (PDF ou photo)
      <input
        type="file"
        accept="application/pdf,image/*,.heic,.heif"
        style={{ display: "none" }}
        onChange={(e) => {
          const fichier = e.target.files?.[0];
          e.target.value = "";
          if (fichier) void navigate("/commandes/lecture", { state: { fichier } });
        }}
      />
    </label>
  );
}

/**
 * La liste des bons de commande (`renderBonsCommande`) : l'en-tête et ses deux
 * boutons, les huit filtres, puis une carte repliable par bon — une seule
 * dépliée à la fois (D-ECR-BC-01).
 */
export function PageBonsCommande() {
  useModeDiscret();
  const navigate = useNavigate();
  const bons = useBons();
  const tous = bons.data ?? [];
  const { filtres, changer: setFiltres, changerUn } = useFiltresAdresse(FILTRES_VIDES);
  const saisie = useRechercheDifferee(filtres.recherche, (q) => changerUn("recherche", q));
  const croisement = useCroisement();
  const apportsDe = (b: BonDeLaListe) => croisement.apportsBon(b);
  const liste = filtrerBons(tous, filtres, (b) => apportsDe(b).map((a) => a.valeur));
  const defile = useEntreeDefile("bonCommande-card", liste.map((b) => b.id), filtres.recherche, saisie);
  const filtre = JSON.stringify(filtres) !== JSON.stringify(FILTRES_VIDES);
  const ocr = useFonctionnalite("ocr");
  const conducteurs = useConducteurs();
  const clients = useClients();
  const metiers = useMetiersDeclares();
  const liensDe = useLiensDesBons(tous);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [lienOuvert, setLienOuvert] = useState<string | null>(null);
  const options = optionsDesFiltres({ conducteurs: conducteurs.data ?? [], clients: clients.data ?? [], metiers: metiers.data ?? [] }, filtres);
  const synthese = syntheseListe(liste.length, tous.length, "bon de commande", filtre);

  return (
    <>
      <EnTetePage
        titre="Bons de commande"
        actions={
          <Can module="bons_commande" action="creer">
            {ocr && <BoutonImporter />}
            <button type="button" className="btn primary" onClick={() => void navigate("/commandes/nouveau")}>+ Nouveau bon de commande</button>
          </Can>
        }
      />
      <BarreFiltresBons
        filtres={filtres}
        onChange={setFiltres}
        conducteurs={options.conducteurs}
        valeurs={options}
        saisie={{ valeur: saisie.saisie, onChange: saisie.setSaisie, onKeyDown: defile.surTouche }}
      />
      <div id="formZoneBonCommande" />
      <div id="bonCommandeListZone">
        {bons.isPending && <Chargement />}
        {bons.isError && <Erreur erreur={bons.error} reessayer={() => void bons.refetch()} />}
        {bons.isSuccess && liste.length === 0 && <Vide message={tous.length && filtre ? "Aucun bon de commande ne correspond à vos filtres." : "Aucun bon de commande ni SAV pour cette société."} />}
        {synthese && liste.length > 0 && <div className="card-sub" style={{ marginBottom: "10px" }}>{synthese}</div>}
        {liste.map((b) => (
          <CarteBon
            key={b.id}
            bon={b}
            contexte="liste"
            ouverte={ouverte === b.id}
            onBasculer={() => setOuverte(ouverte === b.id ? null : b.id)}
            liens={liensDe(b)}
            lienOuvert={lienOuvert === b.id}
            onLien={(o) => setLienOuvert(o ? b.id : null)}
            recherche={{ requete: filtres.recherche, apports: apportsDe(b) }}
            idDom={defile.idDomDe(b.id)}
            enEvidence={defile.enEvidence === b.id}
          />
        ))}
      </div>
    </>
  );
}
