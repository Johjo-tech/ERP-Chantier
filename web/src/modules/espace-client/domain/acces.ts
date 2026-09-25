import { z } from "zod";
import type { IssueOuvertureAcces } from "@/lib/database.propositions";

/**
 * Les accès à l'espace client, vus par l'administrateur (Réglages › Accès
 * clients). Un accès relie un COMPTE (qui n'est membre d'aucune société, D-008)
 * à une fiche client, éventuellement restreint à un interlocuteur (D-FAC-10).
 */
export const schemaAccesClient = z.object({
  id: z.string(),
  client_id: z.string(),
  client_nom: z.string(),
  profile_id: z.string(),
  compte_nom: z.string(),
  compte_email: z.string().nullable(),
  interlocuteur: z.string().nullable(),
  actif: z.boolean(),
  cree_le: z.string(),
});
export type AccesClient = z.infer<typeof schemaAccesClient>;

export const schemaOuvertureAcces = z.object({
  clientId: z.string().min(1, "Choisissez le client."),
  email: z.string().trim().min(1, "Saisissez l'adresse du compte.").pipe(z.email("Adresse électronique mal formée.")),
  // Vide = tout le client ; sinon ses seuls documents à cet interlocuteur.
  interlocuteur: z.string().trim(),
});
export type SaisieOuvertureAcces = z.infer<typeof schemaOuvertureAcces>;

export const schemaIssueOuverture = z.enum(["ouvert", "rouvert", "deja_ouvert", "compte_absent", "compte_membre"]);

/** Ce que l'administrateur lit après « Ouvrir l'accès ». Seules les deux premières issues ont écrit. */
export function messageOuverture(issue: IssueOuvertureAcces, email: string): { texte: string; succes: boolean } {
  switch (issue) {
    case "ouvert":
      return { texte: `Accès ouvert : ${email} voit désormais ce client dans son espace.`, succes: true };
    case "rouvert":
      return { texte: `Accès rouvert pour ${email}.`, succes: true };
    case "deja_ouvert":
      return { texte: `${email} a déjà accès à ce client : rien n'a changé.`, succes: true };
    case "compte_absent":
      return { texte: `Aucun compte n'existe pour ${email}. Le client doit d'abord créer son compte avec cette adresse, puis vous ouvrez l'accès.`, succes: false };
    case "compte_membre":
      return { texte: `${email} est un compte de la société : il voit déjà tout, un accès client ne le restreindrait pas. Utilisez une adresse propre au client.`, succes: false };
  }
}

/** Les accès groupés par client, clients dans l'ordre alphabétique (la fonction de base trie déjà). */
export function accesParClient(acces: readonly AccesClient[]): { clientId: string; clientNom: string; acces: AccesClient[] }[] {
  const groupes = new Map<string, { clientId: string; clientNom: string; acces: AccesClient[] }>();
  for (const a of acces) {
    const g = groupes.get(a.client_id) ?? { clientId: a.client_id, clientNom: a.client_nom, acces: [] };
    g.acces.push(a);
    groupes.set(a.client_id, g);
  }
  return [...groupes.values()];
}
