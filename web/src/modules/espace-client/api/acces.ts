import { z } from "zod";
import { clientTransversal, type Client } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { schemaAccesClient, schemaIssueOuverture, type AccesClient, type SaisieOuvertureAcces } from "../domain/acces";
import type { IssueOuvertureAcces } from "@/lib/database.propositions";

/**
 * Gestion des accès clients par l'administrateur (proposition 20260926106000).
 * La lecture et l'ouverture passent par deux fonctions de base, parce que
 * `profiles` ne montre pas à l'admin le compte d'un client (il n'est membre de
 * rien) ; fermer, rouvrir et retirer écrivent `acces_clients` directement
 * (politique « admin de la société »).
 */
export async function listerAccesClients(societeId: string, client?: Client): Promise<AccesClient[]> {
  const { data, error } = await clientTransversal(client).rpc("acces_clients_de_la_societe", { p_societe: societeId });
  if (error) throw error;
  return analyser(z.array(schemaAccesClient), data, "accès clients");
}

export async function ouvrirAccesClient(saisie: SaisieOuvertureAcces, client?: Client): Promise<IssueOuvertureAcces> {
  const { data, error } = await clientTransversal(client).rpc("ouvrir_acces_client", {
    p_client: saisie.clientId,
    p_email: saisie.email,
    p_interlocuteur: saisie.interlocuteur || null,
  });
  if (error) throw error;
  return analyser(schemaIssueOuverture, data, "ouverture d'accès");
}

/** Fermer garde la ligne (on peut rouvrir sans ressaisir) ; la base refuse à qui n'est pas admin. */
export async function definirAccesClient(id: string, actif: boolean, client?: Client): Promise<void> {
  const { data, error } = await clientTransversal(client).from("acces_clients").update({ actif }).eq("id", id).select("id");
  if (error) throw error;
  if (!data.length) throw { code: "42501", message: "Modification de l'accès refusée." };
}

export async function retirerAccesClient(id: string, client?: Client): Promise<void> {
  const { data, error } = await clientTransversal(client).from("acces_clients").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data.length) throw { code: "42501", message: "Retrait de l'accès refusé." };
}
