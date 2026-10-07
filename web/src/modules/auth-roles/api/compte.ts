import { supabase } from "@/lib/supabase";
import { CHEMIN_NOUVEAU_MOT_DE_PASSE } from "../domain/motdepasse";

/**
 * Envoie le lien de réinitialisation (AUTH-03). Le lien ramène sur
 * `/nouveau-mot-de-passe` avec une session « recovery » que supabase-js pose
 * lui-même à l'ouverture de la page.
 */
export async function demanderReinitialisation(email: string): Promise<void> {
  const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}${CHEMIN_NOUVEAU_MOT_DE_PASSE}`,
  });
  if (error) throw error;
}

/** Définit le mot de passe du compte connecté (session normale ou « recovery »). */
export async function definirMotDePasse(motDePasse: string): Promise<void> {
  const { error } = await supabase().auth.updateUser({ password: motDePasse });
  if (error) throw error;
}

/**
 * Le nom sous lequel on veut être désigné (AUTH-17). `profiles_update_self`
 * l'autorise à chacun pour son propre profil ; zéro ligne touchée = refus.
 */
export async function renommerMonCompte(id: string, nom: string): Promise<void> {
  const { data, error } = await supabase().from("profiles").update({ nom: nom.trim() }).eq("id", id).select("id");
  if (error) throw error;
  if (!data.length) throw { code: "42501", message: "Aucune ligne modifiée" };
}
