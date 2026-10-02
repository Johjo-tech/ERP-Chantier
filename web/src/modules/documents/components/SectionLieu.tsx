import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { STATUTS_LOGEMENT } from "../domain/logement";
import type { ChampsLieu } from "../domain/logement";

type ValeursLieu = Record<ChampsLieu, string>;

interface Props {
  valeurs: ValeursLieu;
  changer: (champ: ChampsLieu, v: string) => void;
  lectureSeule: boolean;
  /** Les factures n'ont pas de colonne pour le téléphone sur place. */
  sansTelephone?: boolean;
}

/** Lieu d'intervention et logement : seuls les champs utiles au statut choisi s'affichent. */
export function SectionLieu({ valeurs, changer, lectureSeule, sansTelephone = false }: Props) {
  const s = valeurs.logement_statut;
  const t = (champ: ChampsLieu, libelle: string) => (
    <ChampTexte libelle={libelle} valeur={valeurs[champ]} onChange={(v) => changer(champ, v)} desactive={lectureSeule} />
  );
  return (
    <fieldset className="grid gap-3 sm:grid-cols-3">
      <legend className="mb-2 text-sm font-semibold">Lieu d'intervention</legend>
      <div className="sm:col-span-3">{t("adresse_locataire", "Adresse du lieu")}</div>
      {t("code_postal", "Code postal")}
      {t("ville", "Ville")}
      {!sansTelephone && t("telephone_locataire", "Téléphone sur place")}
      <ChampChoix
        libelle="Logement"
        valeur={s}
        desactive={lectureSeule}
        onChange={(v) => changer("logement_statut", v)}
        options={[{ valeur: "", libelle: "—" }, ...STATUTS_LOGEMENT.map((x) => ({ valeur: x.code, libelle: x.libelle }))]}
      />
      {s === "occupé" && t("occupant", "Occupant")}
      {(s === "occupé" || s === "vacant") && t("etage", "Étage")}
      {(s === "occupé" || s === "vacant") && t("numero_logement", "N° de logement")}
      {s === "vacant" && t("ancien_locataire", "Ancien locataire")}
      {s === "commune" && t("precision_commune", "Précision (cave, hall…)")}
    </fieldset>
  );
}
