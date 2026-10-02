import { formatEuros, type Montant } from "@/lib/money";
import type { StatutLogement } from "./logement";

/**
 * Le courriel qui accompagne un devis ou une facture — port de
 * `envoyerDocumentEmail` et `lignesLogementPourEmail` (app.js l. 11918-11949).
 * L'ancienne app n'envoyait rien elle-même : elle préparait le texte, ouvrait
 * la messagerie (`mailto:`) et faisait télécharger le PDF à joindre. Même
 * chemin ici — aucun service d'envoi, aucune clé.
 */
export interface LieuEmail {
  adresse_locataire: string | null;
  adresse?: string | null;
  code_postal: string | null;
  ville: string | null;
  logement_statut: StatutLogement | null;
  occupant: string | null;
  ancien_locataire: string | null;
  numero_logement: string | null;
}

const avecVille = (adresse: string | null | undefined, cp: string | null, ville: string | null) =>
  [adresse, [cp, ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");

export function lignesLogementPourEmail(doc: LieuEmail): string[] {
  const lignes: string[] = [];
  const adresse = avecVille(doc.adresse_locataire || doc.adresse, doc.code_postal, doc.ville);
  if (adresse) lignes.push(`Adresse : ${adresse}`);
  if (doc.logement_statut === "occupé" && doc.occupant) lignes.push(`Locataire : ${doc.occupant}`);
  else if (doc.logement_statut === "vacant" && doc.ancien_locataire) lignes.push(`Ancien locataire : ${doc.ancien_locataire}`);
  if (doc.numero_logement) lignes.push(`N° de logement : ${doc.numero_logement}`);
  return lignes;
}

export interface BrouillonEmail {
  destinataire: string;
  objet: string;
  corps: string;
}

/**
 * « Notre facture » sur un avoir, avec un montant négatif dans la phrase : le
 * client lisait l'inverse de ce qu'il recevait (FAC-13). Le mot suit le type,
 * le montant s'annonce en valeur absolue, « en votre faveur » porte le sens.
 */
export function brouillonEmail(p: {
  nature: "devis" | "facture";
  avoir: boolean;
  numero: string;
  ttc: Montant;
  societeNom: string;
  destinataire: string | null;
  lieu: LieuEmail;
}): BrouillonEmail {
  const titre = p.nature === "devis" ? "devis" : p.avoir ? "avoir" : "facture";
  const logement = lignesLogementPourEmail(p.lieu);
  const blocLogement = logement.length ? `\n${logement.join("\n")}\n` : "";
  return {
    destinataire: p.destinataire ?? "",
    objet: `${titre.charAt(0).toUpperCase()}${titre.slice(1)} ${p.numero} — ${p.societeNom}`,
    corps: `Bonjour,\n${blocLogement}\nVeuillez trouver ci-joint notre ${titre} n° ${p.numero} d'un montant de ${formatEuros(p.ttc.abs())} TTC${p.avoir ? " en votre faveur" : ""}.\n\nN'hésitez pas à nous contacter pour toute question.\n\nCordialement,\n${p.societeNom}`,
  };
}

/** L'adresse `mailto:` ; le corps encodé (les retours à la ligne survivent). */
export function lienMailto(b: BrouillonEmail): string {
  return `mailto:${b.destinataire}?subject=${encodeURIComponent(b.objet)}&body=${encodeURIComponent(b.corps)}`;
}

/** Ce que « Copier le texte » met dans le presse-papiers, pour un webmail. */
export function texteACopier(b: BrouillonEmail): string {
  return `À : ${b.destinataire}\nObjet : ${b.objet}\n\n${b.corps}`;
}
