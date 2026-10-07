import { z } from "zod";
import { formatDateFr } from "@/lib/dates";
import { correspond } from "@/lib/recherche";

/**
 * Le suivi des bons, vu par le CLIENT (ESP-01 à ESP-03, port de
 * `statutClientBC` et `CHAMPS_CHERCHES_PORTAIL`, app.js l. 6529-6552).
 * Les données viennent de `v_espace_client_bons` : ni montant, ni note interne.
 */
export const schemaBonClient = z.object({
  id: z.string(),
  societe_id: z.string(),
  numero_bc: z.string().nullable(),
  interlocuteur: z.string().nullable(),
  adresse: z.string().nullable(),
  adresse_locataire: z.string().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  numero_logement: z.string().nullable(),
  etage: z.string().nullable(),
  precision_commune: z.string().nullable(),
  occupant: z.string().nullable(),
  ancien_locataire: z.string().nullable(),
  nature_travaux: z.string().nullable(),
  date_planifiee: z.string().nullable(),
  heure_planifiee: z.string().nullable(),
  date_planification_initiale: z.string().nullable(),
  date_intervention_terminee: z.string().nullable(),
  rappel_date: z.string().nullable(),
  tentatives_contact: z.unknown(),
  travaux_faits: z.boolean(),
  piece_a_commander: z.boolean(),
  piece_a_commander_detail: z.string().nullable(),
  piece_date_commande: z.string().nullable(),
});
export type BonClient = z.infer<typeof schemaBonClient>;

export type CouleurBon = "rouge" | "orange" | "jaune" | "vert";

export const TUILES: readonly { cle: CouleurBon; libelle: string }[] = [
  { cle: "rouge", libelle: "À planifier" },
  { cle: "orange", libelle: "Planifiés" },
  { cle: "jaune", libelle: "Pièce en commande" },
  { cle: "vert", libelle: "Réalisés" },
];

/** Vert (fait) > jaune (pièce attendue) > orange (planifié) > rouge : le premier qui s'applique. */
export function statutClientBon(b: Pick<BonClient, "travaux_faits" | "date_intervention_terminee" | "piece_a_commander" | "date_planifiee" | "heure_planifiee">): { cle: CouleurBon; libelle: string } {
  if (b.travaux_faits || b.date_intervention_terminee) return { cle: "vert", libelle: "Travaux réalisés" };
  if (b.piece_a_commander) return { cle: "jaune", libelle: "Pièce en commande" };
  if (b.date_planifiee) return { cle: "orange", libelle: `Planifié le ${formatDateFr(b.date_planifiee)}${b.heure_planifiee ? ` à ${b.heure_planifiee}` : ""}` };
  return { cle: "rouge", libelle: "Pas encore planifié" };
}

const ORDRE: Record<CouleurBon, number> = { rouge: 0, jaune: 1, orange: 2, vert: 3 };

/** Rouge, jaune, orange, vert, puis par numéro de bon : ce qui attend d'abord. */
export function trierBonsClient<B extends Parameters<typeof statutClientBon>[0] & { numero_bc: string | null }>(bons: readonly B[]): B[] {
  return [...bons].sort((a, b) => ORDRE[statutClientBon(a).cle] - ORDRE[statutClientBon(b).cle] || (a.numero_bc ?? "").localeCompare(b.numero_bc ?? ""));
}

/**
 * Ce qu'un client peut chercher dans ses bons — VOLONTAIREMENT plus étroit que
 * la recherche interne : filtrer n'affiche rien, mais la présence ou l'absence
 * d'une carte EST une réponse. Nos notes, le problème décrit, le statut interne
 * et le conducteur n'y sont pas.
 */
export const CHAMPS_CHERCHES_PORTAIL = [
  "numero_bc", "adresse", "adresse_locataire", "code_postal", "ville", "numero_logement", "etage",
  "precision_commune", "occupant", "ancien_locataire", "interlocuteur", "nature_travaux", "piece_a_commander_detail",
] as const satisfies readonly (keyof BonClient)[];

export function chercherBonsClient<B extends Pick<BonClient, (typeof CHAMPS_CHERCHES_PORTAIL)[number]>>(bons: readonly B[], recherche: string): B[] {
  if (!recherche.trim()) return [...bons];
  return bons.filter((b) => correspond(recherche, ...CHAMPS_CHERCHES_PORTAIL.map((c) => b[c])));
}

const schemaTentative = z.object({ type: z.string().optional(), date: z.string().optional(), heure: z.string().optional() });

/** Les tentatives de joindre le locataire (« injoignable »), lues avec tolérance : le JSON vient de l'ancienne app. */
export function tentativesDe(b: Pick<BonClient, "tentatives_contact">): { type: string; date: string; heure: string }[] {
  const lu = z.array(schemaTentative).safeParse(b.tentatives_contact);
  return lu.success ? lu.data.map((t) => ({ type: t.type ?? "", date: t.date ?? "", heure: t.heure ?? "" })) : [];
}
