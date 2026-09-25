import { Link } from "react-router";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { delaiHorsPlafond, libelleDelaiPaiement, MODES_REGLEMENT, type DelaiPaiement } from "@/modules/clients/domain/delais";
import type { ValeursFacture } from "../domain/facture";
import { ChampDelai } from "./ChampDelai";

interface Props {
  valeurs: ValeursFacture;
  changer: (champ: keyof ValeursFacture, valeur: string) => void;
  delai: DelaiPaiement;
  setDelai: (d: DelaiPaiement) => void;
  echeance: string;
  lectureSeule: boolean;
  devisId: string | null;
}

/**
 * Conditions de paiement, échéance (calculée ou saisie), mode, références de
 * commande et de marché, fin d'exécution, devis d'origine (FAC-04).
 */
export function ChampsReglementFacture({ valeurs, changer, delai, setDelai, echeance, lectureSeule, devisId }: Props) {
  const hors = delaiHorsPlafond(delai);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <ChampDelai delai={delai} onChange={setDelai} desactive={lectureSeule} />
        <ChampTexte
          libelle="Échéance"
          type="date"
          valeur={echeance}
          desactive={lectureSeule}
          aide={valeurs.echeance_manuelle === "oui" ? "Saisie à la main." : `Calculée : ${libelleDelaiPaiement(delai)}.`}
          onChange={(v) => {
            changer("echeance", v);
            changer("echeance_manuelle", v ? "oui" : "non");
          }}
        />
        <ChampChoix
          libelle="Mode de paiement"
          valeur={valeurs.mode_paiement}
          desactive={lectureSeule}
          onChange={(v) => changer("mode_paiement", v)}
          options={[{ valeur: "", libelle: "Celui du client (virement par défaut)" }, ...MODES_REGLEMENT.map((m) => ({ valeur: m.code, libelle: m.libelle }))]}
        />
        <ChampTexte libelle="Réf. bon de commande client" valeur={valeurs.ref_bon_commande_client} desactive={lectureSeule} onChange={(v) => changer("ref_bon_commande_client", v)} />
        <ChampTexte libelle="Réf. marché" valeur={valeurs.ref_marche} desactive={lectureSeule} onChange={(v) => changer("ref_marche", v)} />
        <ChampTexte libelle="Fin d'exécution" type="date" valeur={valeurs.date_fin_execution} desactive={lectureSeule} onChange={(v) => changer("date_fin_execution", v)} />
      </div>
      {devisId && (
        <p className="text-sm text-muted-foreground">
          Devis d'origine : <Link className="text-primary hover:underline" to={`/devis/${devisId}`}>ouvrir le devis</Link>
        </p>
      )}
      {hors && <Alert>{hors} Signalé, jamais bloqué.</Alert>}
    </>
  );
}
