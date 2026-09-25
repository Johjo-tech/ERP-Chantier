import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { formatDateFr } from "@/lib/dates";
import { POSTE_AUTRE, TYPES_CONTRAT, type Salarie, type valeursFormulaire } from "../domain/salarie";

type Valeurs = ReturnType<typeof valeursFormulaire>;

interface Props {
  valeurs: Valeurs;
  erreurs: Record<string, string>;
  changer: (champ: keyof Valeurs, v: string) => void;
  referentiel: readonly string[];
  equipes: readonly { valeur: string; libelle: string }[];
  salarie: Salarie | null;
}

/**
 * Les champs de la fiche (RH-05). Le poste se choisit dans le référentiel des
 * métiers, ou « Autre… » pour un poste libre ; les deux dates médicales sont
 * en LECTURE seule : la base les tient d'après le registre des visites.
 */
export function ChampsSalarie({ valeurs, erreurs, changer, referentiel, equipes, salarie }: Props) {
  const c = (champ: keyof Valeurs) => ({ valeur: valeurs[champ], onChange: (v: string) => changer(champ, v), erreur: erreurs[champ] });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ChampTexte libelle="Prénom" {...c("prenom")} />
      <ChampTexte libelle="Nom" {...c("nom")} requis />
      <ChampChoix libelle="Poste / métier" {...c("posteChoix")} options={[{ valeur: "", libelle: "—" }, ...referentiel.map((m) => ({ valeur: m, libelle: m })), { valeur: POSTE_AUTRE, libelle: "Autre…" }]} />
      {valeurs.posteChoix === POSTE_AUTRE && <ChampTexte libelle="Lequel ?" {...c("posteLibre")} placeholder="Ex : Chef d'équipe, Apprenti, Conducteur de travaux" />}
      <ChampTexte libelle="Date de naissance" type="date" {...c("dateNaissance")} />
      <ChampTexte libelle="Nationalité" {...c("nationalite")} placeholder="Ex : Française" />
      <ChampChoix libelle="Sexe" {...c("sexe")} options={[{ valeur: "", libelle: "—" }, { valeur: "F", libelle: "Femme" }, { valeur: "M", libelle: "Homme" }]} />
      <ChampChoix libelle="Équipe" {...c("technicienId")} options={[{ valeur: "", libelle: "— Aucune —" }, ...equipes]} />
      <ChampChoix libelle="Type de contrat" {...c("typeContrat")} options={TYPES_CONTRAT.map((t) => ({ valeur: t, libelle: t }))} />
      <ChampTexte libelle="Coût horaire chargé (HT, salaire + charges)" inputMode="decimal" {...c("coutHoraireCharge")} placeholder="Ex : 32,50" />
      <ChampTexte libelle="Salaire mensuel net" inputMode="decimal" {...c("salaireMensuelNet")} placeholder="Ex : 1 850" />
      <ChampTexte libelle="Date de début de contrat" type="date" {...c("dateEntree")} />
      <ChampTexte libelle="Date de fin de contrat (si applicable)" type="date" {...c("dateSortie")} />
      <ChampTexte libelle="Téléphone" type="tel" {...c("telephone")} />
      <ChampTexte libelle="E-mail" type="email" {...c("email")} />
      <ChampTexte libelle="N° carte BTP" {...c("carteBtpNumero")} />
      <ChampTexte libelle="Validité carte BTP" type="date" {...c("carteBtpValidite")} />
      <ChampTexte libelle="Solde de CP acquis (jours)" inputMode="decimal" {...c("soldeCpInitial")} placeholder="Ex : 25" />
      {/* En texte et non en date : vide et grisé, un champ date se lit comme un champ cassé. */}
      <ChampTexte libelle="Dernière visite médicale" desactive valeur={salarie?.visiteMedicaleDate ? formatDateFr(salarie.visiteMedicaleDate) : "Aucune visite au registre"} onChange={() => undefined} />
      <ChampTexte
        libelle="Prochaine visite médicale"
        desactive
        valeur={salarie?.visiteMedicaleProchaine ? formatDateFr(salarie.visiteMedicaleProchaine) : "Aucune échéance — enregistrez une visite ci-dessous"}
        onChange={() => undefined}
        aide="Tenues par le registre des visites, plus bas — la base les réécrit à chaque enregistrement."
      />
    </div>
  );
}
