import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { STATUTS_LOGEMENT } from "@/modules/documents/domain/logement";
import type { ValeursDevis } from "../domain/devis";

interface Props {
  valeurs: ValeursDevis;
  changer: (champ: keyof ValeursDevis, v: string) => void;
  lectureSeule: boolean;
}

/** Lieu d'intervention et logement : seuls les champs utiles au statut choisi s'affichent. */
export function SectionLieu({ valeurs, changer, lectureSeule }: Props) {
  const s = valeurs.logement_statut;
  const t = (champ: keyof ValeursDevis, libelle: string) => (
    <ChampTexte libelle={libelle} valeur={valeurs[champ]} onChange={(v) => changer(champ, v)} desactive={lectureSeule} />
  );
  return (
    <fieldset className="grid gap-3 sm:grid-cols-3">
      <legend className="mb-2 text-sm font-semibold">Lieu d'intervention</legend>
      <div className="sm:col-span-3">{t("adresse_locataire", "Adresse du lieu")}</div>
      {t("code_postal", "Code postal")}
      {t("ville", "Ville")}
      {t("telephone_locataire", "Téléphone sur place")}
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
