import type { Chantier } from "./chantier";

/**
 * « + Nouveau devis » depuis la fiche (CHA-13) : l'ancien écran ouvrait le
 * formulaire prérempli du client, de l'adresse, du code postal, de la ville et
 * du chantier (app.js l. 14413). Les valeurs passent par l'URL, que le
 * formulaire de devis lit à la création.
 */
export function lienDevisComplementaire(c: Pick<Chantier, "id" | "client_id" | "adresse" | "code_postal" | "ville">): string {
  const p = new URLSearchParams({ chantier: c.id });
  if (c.client_id) p.set("client", c.client_id);
  if (c.adresse) p.set("adresse", c.adresse);
  if (c.code_postal) p.set("cp", c.code_postal);
  if (c.ville) p.set("ville", c.ville);
  return `/devis/nouveau?${p.toString()}`;
}
