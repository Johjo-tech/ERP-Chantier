/** La pastille du statut d'un chantier, classes de l'ancien : terminé = success, en cours = warn, sinon info. */
export function classeStatut(statut: string | null): string {
  if (statut === "terminé") return "success";
  if (statut === "en cours") return "warn";
  return "info";
}
