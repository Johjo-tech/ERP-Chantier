import { formatDateFr } from "@/lib/dates";
import { adresseComplete, type Chantier } from "./chantier";

/**
 * Le PPSPS (plan particulier de sécurité et de protection de la santé) d'un
 * chantier, décrit comme une suite de blocs neutres (CHA-05). Le contenu est
 * celui de l'ancien générateur Word (app.js l. 13538-13736), mot pour mot, y
 * compris les organismes de prévention de l'Isère qu'il citait en dur ; seul le
 * rendu (fichier .docx) vit ailleurs (`fichiers/docx.ts`).
 */
export type Bloc =
  | { type: "titre"; texte: string }
  | { type: "sous-titre"; texte: string }
  | { type: "paragraphe"; morceaux: { texte: string; gras?: boolean; italique?: boolean }[]; centre?: boolean; taille?: number }
  | { type: "tableau"; entetes: string[]; lignes: string[][]; largeurs: number[] }
  | { type: "saut-de-page" };

export interface IdentitePpsps {
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  siret: string | null;
  gerant: string | null;
  gerantTelephone: string | null;
}

const P = (texte: string): Bloc => ({ type: "paragraphe", morceaux: [{ texte }] });
const PB = (texte: string): Bloc => ({ type: "paragraphe", morceaux: [{ texte, gras: true }] });
const etiquette = (libelle: string, valeur: string): Bloc => ({ type: "paragraphe", morceaux: [{ texte: libelle, gras: true }, { texte: valeur }] });
const lignesDe = (texte: string | null): Bloc[] => (texte ?? "").split("\n").filter(Boolean).map(P);
const centre = (texte: string, taille: number): Bloc => ({ type: "paragraphe", centre: true, taille, morceaux: [{ texte, gras: true }] });

/** « 03/2026 » : le mois et l'année du début ou de la fin des travaux. */
export function moisAnnee(iso: string | null): string {
  if (!iso) return "";
  const [annee, mois] = iso.split("-");
  return annee && mois ? `${mois}/${annee}` : "";
}

export function nomFichierPpsps(nomChantier: string): string {
  return `PPSPS_${(nomChantier || "chantier").replace(/[^a-z0-9]+/gi, "_")}.docx`;
}

function periode(c: Chantier): string {
  if (!c.date_debut && !c.date_fin) return "";
  return `Du ${c.date_debut ? formatDateFr(c.date_debut) : "?"} au ${c.date_fin ? formatDateFr(c.date_fin) : "?"}`;
}

function pageDeGarde(c: Chantier, s: IdentitePpsps, aujourdhui: string): Bloc[] {
  return [
    centre(s.nom, 28),
    centre("PLAN PARTICULIER DE SECURITE ET DE PROTECTION DE LA SANTE", 22),
    centre("P.P.S.P.S.", 40),
    centre("Chantier :", 22),
    centre(c.nom, 28),
    etiquette("Adresse du chantier : ", adresseComplete(c)),
    etiquette("Période d'exécution : ", periode(c)),
    etiquette("Lot : ", c.ppsps_lot ?? ""),
    PB("Maître de l'ouvrage : "),
    ...lignesDe(c.ppsps_maitre_ouvrage || c.client_nom),
    PB("Maître d'œuvre : "),
    ...lignesDe(c.ppsps_maitre_oeuvre),
    PB("Coordonnateur S.P.S. : "),
    ...lignesDe(c.ppsps_coordinateur_sps),
    {
      type: "tableau",
      entetes: ["Indice", "Date", "Nature de la modification", "Rédacteur"],
      lignes: [["00", formatDateFr(aujourdhui), "Emission initiale", s.gerant ?? ""], ["", "", "", ""]],
      largeurs: [1200, 1500, 4800, 1500],
    },
    { type: "saut-de-page" },
  ];
}

function renseignementsGeneraux(c: Chantier, s: IdentitePpsps): Bloc[] {
  return [
    { type: "titre", texte: "I - RENSEIGNEMENTS GENERAUX" },
    { type: "sous-titre", texte: "1.1 - L'entreprise :" },
    P(`Nom ou Raison Sociale : ${s.nom}`),
    P(`Téléphone : ${s.telephone ?? ""}    mail : ${s.email ?? ""}`),
    P("Qualité : "),
    P("Nom et qualités du représentant de l’entreprise présent sur le chantier"),
    P(`Nom : ${s.gerant ?? ""}`),
    P(`Téléphone : ${s.gerantTelephone || s.telephone || ""}    mail : ${s.email ?? ""}`),
    { type: "sous-titre", texte: "1.2 - Le chantier :" },
    P(`Adresse du chantier : ${adresseComplete(c)}`),
    P("Téléphone :        mail :"),
    P("Sous-traitance :"),
    { type: "sous-titre", texte: "1.3 - Le planning et l’organisation horaire :" },
    P("Période prévisible d’exécution des travaux : "),
    P("- Durée prévisible des travaux : "),
    P(`- Début des travaux : ${moisAnnee(c.date_debut)}`),
    P(`- Fin des travaux : ${moisAnnee(c.date_fin)}`),
    P("Effectif prévisible du chantier :"),
    P(`Pour l'entreprise : effectif moyen : ${c.ppsps_effectif_moyen ?? ""}    effectif de pointe :`),
    P("Pour les sous-traitants : effectif moyen :     effectif de pointe : "),
    P("Horaires de travail du chantier :"),
    {
      type: "tableau",
      entetes: ["JOURS", "MATIN", "APRES-MIDI"],
      lignes: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"].map((j) => [j, "", ""]),
      largeurs: [2250, 3375, 3375],
    },
    { type: "sous-titre", texte: "1.4 – Les organismes de préventions" },
    {
      type: "tableau",
      entetes: ["Organisme", "Adresse", "Contact", "Téléphone"],
      lignes: [
        ["DREETS de l’Isère", "1 Avenue Marie Reynoard, 38029 Grenoble Cedex", "Mme Martres-Guguenheim", "04 56 58 38 84"],
        ["Médecine du Travail — BTP Santé au Travail", "18 Rue de la Tuilerie, 38170 Seyssinet-Pariset", "Dr PHAM", "04 76 21 76 84"],
        ["CARSAT — Service Prévention des risques professionnels", "159 route de Closon, 74330 Poisy", "Cécile Verset", "39 60"],
        ["OPPBTP", "3 Rue Méridiens, 38130 Echirolles", "", "04 76 46 92 68"],
      ],
      largeurs: [2200, 2900, 2200, 1700],
    },
    { type: "saut-de-page" },
  ];
}

function organisationEtMesures(): Bloc[] {
  return [
    { type: "titre", texte: "II - RENSEIGNEMENTS CONCERNANT L’ORGANISATION DU CHANTIER" },
    { type: "sous-titre", texte: "2.1. - Hygiène et conditions de travail du personnel de chantier :" },
    P("Parking véhicules du personnel : "),
    P("Sanitaires : "),
    P("Réfectoire : "),
    { type: "sous-titre", texte: "2.2 - Surveillance médicale spéciale :" },
    P(""),
    { type: "titre", texte: "III - MESURES DE SECURITE APPLICABLES AUX INTERVENTIONS DE L’ENTREPRISE SUR LE CHANTIER" },
    { type: "sous-titre", texte: "3.1. - Moyens matériels utilisés par l’entreprise :" },
    PB("- ELECTRICITE"),
    P("Nous utiliserons l’électricité du chantier"),
    PB("- EAU"),
    P("Nous utiliserons l’eau du chantier"),
    PB("- TELEPHONE"),
    { type: "sous-titre", texte: "3.2. - Installation générale de chantier :" },
    P("BASE VIE CHANTIER"),
    { type: "sous-titre", texte: "3.3. - Effectif du personnel :" },
    P("Donnez l’effectif prévisible du personnel de l’entreprise en fonction de la planification des travaux."),
    {
      type: "tableau",
      entetes: ["N°", "Enumération des tâches", "Effectif"],
      lignes: ["Préparation et protection chantier", "Ragréage / Préparation des supports", "Réalisation des travaux", "Nettoyage et repli du chantier"].map((t, i) => [String(i + 1), t, ""]),
      largeurs: [900, 5400, 2700],
    },
    { type: "saut-de-page" },
    { type: "sous-titre", texte: "3.6. - Analyse et prévention des risques propres à l’entreprise :" },
    ...Array.from({ length: 10 }, (_, i) => P(`Fiche de tâche n°${String(i + 1).padStart(2, "0")} :`)),
    P(""),
    {
      type: "tableau",
      entetes: ["Activités interférentes", "Risques", "Prévention"],
      lignes: [
        ["Travail en hauteur", "Risque de chute", "Equipement de protection, Echafaudage sécurisé, Formation interne, Casques de protection, Balisage, PIR"],
        ["Manutention / Approvisionnement", "Risque de coupure\nRisque d’écrasements", "Gants anti-coupures, TMS, port du casque et jugulaire\nPort des genouillères, gants et chaussures de sécurité, manutention au diable"],
      ],
      largeurs: [3000, 3000, 3000],
    },
    { type: "saut-de-page" },
    { type: "sous-titre", texte: "3.9. - Analyse et prévention des risques inhérents au chantier et à son environnement :" },
    {
      type: "tableau",
      entetes: ["Environnement", "Risques", "Prévention"],
      lignes: [
        ["Peintures / Revêtements", "Coupures\nTMS\nIntoxication\nEcrasements", "Port du casque + jugulaire, gants anti coupures, lunettes étanches et chaussures de sécurité, genouillères, 1/2 masque à filtre antiparticules. Fiches de sécurité des produits transmises à l’entreprise générale."],
        ["Installation d’un échafaudage", "Risques de chutes", "Port des EPI, Formation interne à l’installation d’échafaudage, Balisage, PIR"],
      ],
      largeurs: [2500, 3000, 3500],
    },
    { type: "saut-de-page" },
  ];
}

function secoursEtSignatures(s: IdentitePpsps, aujourdhui: string): Bloc[] {
  return [
    { type: "titre", texte: "4 - Mesures de sécurité et de secours" },
    { type: "sous-titre", texte: "4.1 Consignes générales de sécurité :" },
    P("Port des EPI individuels / Mise en place et port des EPI collectifs"),
    { type: "sous-titre", texte: "4.2 Consignes particulières au chantier :" },
    P(""),
    { type: "sous-titre", texte: "4.3 - Dispositions en matière de secours et d’évacuation des personnels de chantier en cas d’accident :" },
    P("Identification et localisation du (des) secouriste(s) : fiche renseignée et affichée sur chaque site"),
    P("Localisation de la trousse de secours : "),
    P("Consignes Premiers secours :"),
    P("• Alerter par téléphone les secours : POMPIERS 18 | SAMU 15 | POLICE 17"),
    P("• En cas de projection de produits dans les yeux ou sur le corps : laver à grande eau pendant 15 minutes après avoir enlevé les vêtements souillés."),
    { type: "saut-de-page" },
    centre("5 - AVIS / COMMENTAIRES / SIGNATURES", 24),
    { type: "paragraphe", morceaux: [{ texte: "Etabli le : ", gras: true }, { texte: formatDateFr(aujourdhui), italique: true }] },
    P(`Rédigé par : ${s.gerant ?? ""}`),
    P(s.gerant ?? ""),
    P("Gérant"),
    PB(s.nom),
    ...(s.adresse ? [P(s.adresse)] : []),
    ...(s.code_postal || s.ville ? [P([s.code_postal, s.ville].filter(Boolean).join(" "))] : []),
    ...(s.telephone ? [P(`Tél : ${s.telephone}`)] : []),
    ...(s.siret ? [P(`Siret : ${s.siret}`)] : []),
  ];
}

export function contenuPpsps(c: Chantier, s: IdentitePpsps, aujourdhui: string): Bloc[] {
  return [...pageDeGarde(c, s, aujourdhui), ...renseignementsGeneraux(c, s), ...organisationEtMesures(), ...secoursEtSignatures(s, aujourdhui)];
}
