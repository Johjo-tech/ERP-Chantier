/**
 * Auth Guard - Protège l'accès à l'app
 * Redirige vers login si pas d'authentification
 */

import { supabase, getCurrentSession } from "@/api/client";

/**
 * Vérifie si l'utilisateur est authentifié
 * Redirige vers /login si non
 */
export async function protectRoute(): Promise<boolean> {
  try {
    const session = await getCurrentSession();

    if (!session) {
      // Pas de session → rediriger vers login
      console.log("No session - redirecting to login");
      window.location.href = "/login.html";
      return false;
    }

    console.log("✅ User authenticated:", session.user.id);
    return true;
  } catch (error) {
    console.error("Auth check failed:", error);
    window.location.href = "/login.html";
    return false;
  }
}

/**
 * S'abonne aux changements d'authentification
 * Redirige vers login si l'utilisateur se déconnecte
 */
export function watchAuthState(onSignOut?: () => void) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    console.log("Auth state changed:", event, session ? "logged in" : "logged out");

    if (event === "SIGNED_OUT" || !session) {
      onSignOut?.();
      window.location.href = "/login.html";
    }
  });

  return data.subscription;
}

/**
 * Obtenir l'utilisateur actuel
 */
export async function getCurrentUser() {
  const session = await getCurrentSession();
  if (!session) return null;

  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (error || !profile) {
      console.error("Failed to fetch user profile:", error);
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      ...profile,
    };
  } catch (err) {
    console.error("Get current user error:", err);
    return null;
  }
}

/**
 * Déconnecter l'utilisateur
 */
export async function logout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    window.location.href = "/login.html";
  } catch (err) {
    console.error("Logout error:", err);
  }
}
