import { ChampTexte, ChampZone } from "@/components/formulaire/Champ";
import { Button } from "@/components/ui/button";
import type { ValeursBon } from "../domain/bon";
import { LIBELLES_MODE, type ModeBon } from "../domain/regles";

const MODES = Object.keys(LIBELLES_MODE) as ModeBon[];

/** Les trois modes ne se choisissent qu'à la création ; ensuite, c'est la saisie d'un numéro qui fait sortir du mode (BC-04, BC-31). */
export function SelecteurMode({ mode, onChange }: { mode: ModeBon; onChange: (m: ModeBon) => void }) {
  return (
    <div role="group" aria-label="Mode du bon de commande" className="flex flex-wrap gap-2">
      {MODES.map((m) => (
        <Button key={m} variant={m === mode ? "default" : "outline"} aria-pressed={m === mode} onClick={() => onChange(m)}>
          {LIBELLES_MODE[m]}
        </Button>
      ))}
    </div>
  );
}

const AIDES: Record<ModeBon, string | undefined> = {
  normal: "Numéro indiqué sur le BC du client — passez à la ligne pour en ajouter un autre.",
  attente_bc: "Dès qu'il arrive, saisissez-le ici : le bon devient un bon de commande standard, et le numéro part sur la facture.",
  sans_bc: "Ce client travaille sans bon de commande. Si l'un arrive malgré tout, saisissez-le ici.",
};

interface Props {
  valeurs: ValeursBon;
  erreurs: Record<string, string>;
  changer: (champ: keyof ValeursBon, v: string) => void;
  mode: ModeBon;
  sav: boolean;
  lectureSeule: boolean;
}

/**
 * Le numéro reste saisissable même en attente ou sans BC (BC-74) : sinon un
 * bon en attente n'aurait aucune issue. Seul un SAV le masque — il porte sa
 * propre numérotation.
 */
export function SectionBon({ valeurs, erreurs, changer, mode, sav, lectureSeule }: Props) {
  const t = (champ: keyof ValeursBon, libelle: string, type = "text") => (
    <ChampTexte libelle={libelle} type={type} valeur={valeurs[champ]} erreur={erreurs[champ]} onChange={(v) => changer(champ, v)} desactive={lectureSeule} />
  );
  const suffixe = mode === "normal" ? "" : ` — ${LIBELLES_MODE[mode].toLowerCase()}`;
  return (
    <fieldset className="grid gap-3 sm:grid-cols-3">
      <legend className="mb-2 text-sm font-semibold">{sav ? "SAV" : "Bon de commande"}</legend>
      {!sav && (
        <ChampZone
          className="sm:col-span-2"
          libelle={`N° du bon de commande${suffixe}`}
          valeur={valeurs.numero_bc}
          aide={AIDES[mode]}
          onChange={(v) => changer("numero_bc", v)}
          desactive={lectureSeule}
        />
      )}
      {!sav && t("reference_chantier", "Référence chantier")}
      {!sav && t("date_reception", "Date de réception du BC", "date")}
      {t("date_fin_travaux", "Date de fin de travaux", "date")}
      {t("nature_travaux", "Nature des travaux")}
      <div className="sm:col-span-3">{t("notes", "Notes")}</div>
    </fieldset>
  );
}
