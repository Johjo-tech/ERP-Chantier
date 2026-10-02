import type { ReactNode } from "react";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { formatDateFr } from "@/lib/dates";
import { POSTE_AUTRE, TYPES_CONTRAT, type Salarie, type valeursFormulaire } from "../domain/salarie";
import { BadgeVisite } from "./BadgeVisite";

type Valeurs = ReturnType<typeof valeursFormulaire>;

interface Props {
  valeurs: Valeurs;
  changer: (champ: keyof Valeurs, v: string) => void;
  referentiel: readonly string[];
  equipes: readonly { valeur: string; libelle: string }[];
  salarie: Salarie | null;
  seuilVisite: number;
  /** « Rôle dans l'entreprise » et « Compte utilisateur » : l'ancien les pose entre l'équipe et le contrat. */
  role: ReactNode;
  compte: ReactNode;
}

const GRISE = { background: "var(--surface-2)" } as const;

/**
 * Les champs de la fiche (RH-05), dans l'ordre et la grille `.field-grid` de
 * `salarieForm` (app.js l. 16275). Le poste se choisit dans le référentiel des
 * métiers, ou « Autre… » pour un poste libre ; les deux dates médicales sont
 * en LECTURE seule : la base les tient d'après le registre des visites.
 */
export function ChampsSalarie({ valeurs, changer, referentiel, equipes, salarie, seuilVisite, role, compte }: Props) {
  const c = (champ: keyof Valeurs) => ({ valeur: valeurs[champ], onChange: (v: string) => changer(champ, v) });
  return (
    <div className="field-grid">
      <ChampTexte libelle="Prénom" {...c("prenom")} />
      <ChampTexte libelle="Nom" {...c("nom")} />
      <ChampChoix libelle="Poste / métier" {...c("posteChoix")} options={[{ valeur: "", libelle: "—" }, ...referentiel.map((m) => ({ valeur: m, libelle: m })), { valeur: POSTE_AUTRE, libelle: "Autre…" }]} />
      {valeurs.posteChoix === POSTE_AUTRE && <ChampTexte libelle="Lequel ?" {...c("posteLibre")} placeholder="Ex : Chef d'équipe, Apprenti, Conducteur de travaux" />}
      <ChampTexte libelle="Date de naissance" type="date" {...c("dateNaissance")} />
      <ChampTexte libelle="Nationalité" {...c("nationalite")} placeholder="Ex : Française" />
      <ChampChoix libelle="Sexe" {...c("sexe")} options={[{ valeur: "", libelle: "—" }, { valeur: "F", libelle: "Femme" }, { valeur: "M", libelle: "Homme" }]} />
      <ChampChoix libelle="Équipe" {...c("technicienId")} options={[{ valeur: "", libelle: "— Aucune —" }, ...equipes]} />
      {role}
      {compte}
      <ChampChoix libelle="Type de contrat" {...c("typeContrat")} options={TYPES_CONTRAT.map((t) => ({ valeur: t, libelle: t }))} />
      <ChampTexte libelle="Coût horaire chargé (HT, salaire + charges)" type="number" {...c("coutHoraireCharge")} placeholder="Ex : 32.50" />
      <ChampTexte libelle="Salaire mensuel net" type="number" {...c("salaireMensuelNet")} placeholder="Ex : 1850" />
      <ChampTexte libelle="Date de début de contrat" type="date" {...c("dateEntree")} />
      <ChampTexte libelle="Date de fin de contrat (si applicable)" type="date" {...c("dateSortie")} />
      <ChampTexte libelle="Téléphone" {...c("telephone")} />
      <ChampTexte libelle="Email" type="email" {...c("email")} />
      <ChampTexte libelle="N° Carte BTP" {...c("carteBtpNumero")} />
      <ChampTexte libelle="Validité carte BTP" type="date" {...c("carteBtpValidite")} />
      {/* En texte et non en date : vide et grisé, un champ date se lit comme un champ cassé. */}
      <div className="field">
        <label htmlFor="sal_visiteMedicaleDate">Dernière visite médicale</label>
        <input type="text" id="sal_visiteMedicaleDate" value={salarie?.visiteMedicaleDate ? formatDateFr(salarie.visiteMedicaleDate) : "Aucune visite au registre"} disabled style={GRISE} />
      </div>
      <div className="field">
        <label htmlFor="sal_visiteMedicaleProchaine">Prochaine visite médicale</label>
        <input
          type="text"
          id="sal_visiteMedicaleProchaine"
          value={salarie?.visiteMedicaleProchaine ? formatDateFr(salarie.visiteMedicaleProchaine) : "Aucune échéance — enregistrez une visite ci-dessous"}
          disabled
          style={GRISE}
        />
        <div style={{ marginTop: "6px" }}>
          {salarie ? (
            <BadgeVisite prochaine={salarie.visiteMedicaleProchaine} seuil={seuilVisite} />
          ) : (
            <span className="card-sub">Saisissez la première visite dans « Suivi médical », ci-dessous : elle sera enregistrée avec la fiche.</span>
          )}
        </div>
        <div className="card-sub" style={{ marginTop: "4px" }}>
          Tenues par le registre des visites, plus bas — la base les réécrit à chaque enregistrement. L&apos;échéance proposée suit le régime de suivi (art. R.4624-16 et suivants), et reste modifiable : c&apos;est le médecin du
          travail qui arrête la date.
        </div>
      </div>
    </div>
  );
}
