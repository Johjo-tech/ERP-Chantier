import Big from "big.js";
import { z } from "zod";
import { formatDateFr, todayISO } from "@/lib/dates";
import { schemaNombreFr } from "@/lib/nombres";
import type { LigneAEnregistrer } from "@/modules/documents/domain/lignes";
import { libelleVehicule, type Vehicule } from "./vehicule";

/**
 * Vente d'un véhicule (VEH-04, FAC-96 renvoyé par la facturation — D-VEH-06).
 *
 * L'ancien écran émettait une facture d'emblée, à un acheteur en TEXTE LIBRE,
 * TVA 20 ou 0. Retenu : l'acheteur est une fiche du répertoire (une facture
 * émise doit pouvoir être relancée, lettrée, portée au dossier du client), le
 * taux se choisit dans la liste des réglages (20 ou 0 proposés par défaut
 * selon « TVA sur ce véhicule »), la facture est créée en brouillon puis émise
 * — numéro posé par la base.
 */

/** Le taux proposé : 0 pour un véhicule « sans TVA », 20 sinon (app.js l. 15360). */
export const TVA_VENTE_AVEC = 20;
export const TVA_VENTE_SANS = 0;

export function tvaVenteParDefaut(v: Pick<Vehicule, "tva_applicable">): number {
  return v.tva_applicable === false ? TVA_VENTE_SANS : TVA_VENTE_AVEC;
}

/** Les taux du menu : ceux des réglages, plus le taux par défaut s'il en manque. */
export function tauxProposes(tauxReglages: readonly number[], parDefaut: number): number[] {
  return [...new Set([...tauxReglages, parDefaut])].sort((a, b) => a - b);
}

/** La désignation de la ligne, mot pour mot celle de l'ancien écran (`confirmVendreVehicule`). */
export function designationVente(v: Pick<Vehicule, "immatriculation" | "marque" | "modele" | "nom" | "motorisation" | "taille_pneus" | "kilometrage" | "date_achat">): string {
  const details = [
    v.immatriculation ? `immatriculation ${v.immatriculation}` : null,
    v.motorisation ? `motorisation ${v.motorisation}` : null,
    v.taille_pneus ? `pneus ${v.taille_pneus}` : null,
    v.kilometrage ? `${Number(v.kilometrage).toLocaleString("fr-FR")} km` : null,
    v.date_achat ? `acheté le ${formatDateFr(v.date_achat)}` : null,
  ]
    .filter(Boolean)
    .join(" — ");
  return `Vente du véhicule ${libelleVehicule(v)}${details ? ` (${details})` : ""}`;
}


export const schemaSaisieVente = z.object({
  client_id: z.string().trim().min(1, "Choisissez l'acheteur dans le répertoire des clients."),
  date: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? todayISO() : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")),
  prix: z
    .string()
    .pipe(schemaNombreFr)
    .refine((n) => n > 0, "Indiquez un prix de vente supérieur à 0."),
  tva: z.string().pipe(schemaNombreFr).pipe(z.number().min(0, "Taux négatif.").max(100, "Taux au-delà de 100 %.")),
});
export type SaisieVente = z.infer<typeof schemaSaisieVente>;

/** La ligne unique de la facture : 1 × prix, au taux choisi. */
export function ligneDeVente(designation: string, prix: number, tva: number): LigneAEnregistrer {
  return {
    id: null,
    position: 0,
    type: "ligne",
    designation,
    quantite: 1,
    prix_unitaire: prix,
    // Sans unité, comme la ligne de l'ancien écran.
    unite: null,
    tva,
    article_reference: null,
    commentaire: null,
    metier: null,
    montant_ht: Number(new Big(prix).toString()),
  };
}
