/**
 * Inviter un salarié à se créer un compte.
 *
 * Pourquoi une fonction de bord, alors que poser l'invitation se fait très
 * bien depuis le navigateur : fabriquer une identité exige la clé de service,
 * qui ne peut pas approcher le bundle (toute variable `VITE_` y est inlinée en
 * clair). Et `resetPasswordForEmail` sur une adresse inconnue ne crée rien et
 * n'envoie rien — GoTrue répond 200 en silence, pour empêcher d'énumérer les
 * comptes existants.
 *
 * Le partage des rôles entre les deux clients est la règle de ce fichier :
 *
 *   userClient  — pose l'invitation. La RLS `invitations_insert WITH CHECK
 *                 est_admin(societe_id)` décide qui en a le droit. La fonction
 *                 ne refait pas ce contrôle : elle ne peut donc pas le rater.
 *   adminClient — fabrique l'identité et envoie le courriel. Rien d'autre.
 *
 * Le reste du circuit est déjà en base : deux déclencheurs sur `auth.users`
 * appellent `appliquer_invitations()`, qui inscrit le membre, renseigne
 * `salaries.profile_id` et clôt l'invitation. Le rôle n'est accordé qu'une
 * fois l'adresse prouvée — c'est la seule garde, et elle suffit.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, corsHeaders, json, userClient } from "../_shared/supabase.ts";

/**
 * `sous_traitant` est absent à dessein : ce rôle vise
 * `sous_traitants.contact_profile_id`, pas une fiche salarié. L'accorder ici
 * rattacherait la personne à la mauvaise table.
 */
const ROLES_INVITABLES = ["admin", "conducteur", "technicien", "lecture", "secretaire"];

/**
 * Délai minimal entre deux envois pour la même invitation.
 *
 * Le plafond de courriels d'Auth est global au projet : une salve de renvois
 * le brûlerait pour tout le monde, y compris pour les réinitialisations de mot
 * de passe des autres.
 */
const DELAI_RENVOI_MS = 10 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { salarie_id, email, role } = await req.json().catch(() => ({}));

    const adresse = String(email ?? "").trim().toLowerCase();
    if (!adresse || !adresse.includes("@")) {
      return json({ erreur: "Renseignez l'adresse e-mail du salarié pour l'inviter." }, 400);
    }
    if (!salarie_id) {
      return json({ erreur: "Salarié non désigné." }, 400);
    }
    if (!ROLES_INVITABLES.includes(String(role ?? ""))) {
      return json({ erreur: `Rôle impossible pour un salarié : ${role}.` }, 400);
    }

    const utilisateur = userClient(req);
    const service = adminClient();

    /* La fiche, lue avec les droits de l'appelant : s'il ne peut pas la voir,
       il n'a rien à faire ici, et la requête s'arrête sans autre contrôle. */
    const { data: salarie } = await utilisateur
      .from("salaries")
      .select("id, societe_id, prenom, nom, profile_id")
      .eq("id", salarie_id)
      .maybeSingle();

    if (!salarie) {
      return json({ erreur: "Salarié introuvable, ou hors de votre portée." }, 404);
    }
    if (salarie.profile_id) {
      return json({ erreur: "Ce salarié a déjà un compte rattaché." }, 409);
    }

    /* L'adresse est-elle déjà le compte d'un AUTRE salarié de la société ?
       Le dire en nommant la fiche : « déjà utilisée » n'aide personne. */
    const { data: proprietaire } = await service
      .from("profiles")
      .select("id")
      .ilike("email", adresse)
      .maybeSingle();

    if (proprietaire) {
      const { data: autre } = await service
        .from("salaries")
        .select("prenom, nom")
        .eq("societe_id", salarie.societe_id)
        .eq("profile_id", proprietaire.id)
        .neq("id", salarie.id)
        .maybeSingle();
      if (autre) {
        return json(
          {
            erreur: `Cette adresse est déjà le compte de ${[autre.prenom, autre.nom]
              .filter(Boolean)
              .join(" ")}.`,
          },
          409
        );
      }
    }

    /* Le renvoi trop rapproché se refuse avant d'écrire : sinon on aurait
       remis le statut à « en_attente » pour rien. */
    const { data: existante } = await utilisateur
      .from("invitations")
      .select("id, invitee_le, statut")
      .eq("societe_id", salarie.societe_id)
      .ilike("email", adresse)
      .maybeSingle();

    if (existante?.invitee_le) {
      const reste = DELAI_RENVOI_MS - (Date.now() - Date.parse(existante.invitee_le));
      if (reste > 0) {
        return json(
          { erreur: `Invitation déjà envoyée. Réessayez dans ${Math.ceil(reste / 60000)} min.` },
          429
        );
      }
    }

    /* Une adresse ne porte qu'une invitation par société : l'index unique
       l'impose. On ne peut pas s'en remettre à `upsert` pour autant — cet
       index porte sur `lower(email)`, une EXPRESSION, et PostgREST ne sait
       viser en `on conflict` que des colonnes nues. D'où la relecture
       ci-dessus, et ici la branche explicite. */
    const invitation = {
      societe_id: salarie.societe_id,
      email: adresse,
      role,
      salarie_id: salarie.id,
      statut: "en_attente",
      maj_le: new Date().toISOString(),
    };
    const { error: refus } = existante
      ? await utilisateur.from("invitations").update(invitation).eq("id", existante.id)
      : await utilisateur.from("invitations").insert(invitation);

    if (refus) {
      /* 42501 : la RLS a refusé — l'appelant n'est pas administrateur. C'est
         la base qui décide, et son refus se répercute tel quel. */
      const interdit = refus.code === "42501";
      return json(
        {
          erreur: interdit
            ? "Seul un administrateur de la société peut inviter un salarié."
            : `Invitation refusée par la base : ${refus.message}`,
        },
        interdit ? 403 : 400
      );
    }

    const site = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");
    if (!site) {
      return json(
        { erreur: "SITE_URL n'est pas configurée : le lien du courriel serait faux." },
        500
      );
    }
    const redirectTo = `${site}/nouveau-mot-de-passe.html`;
    const nom = [salarie.prenom, salarie.nom].filter(Boolean).join(" ");

    const marquerEnvoyee = () =>
      service
        .from("invitations")
        .update({ invitee_le: new Date().toISOString() })
        .eq("societe_id", salarie.societe_id)
        .ilike("email", adresse);

    /* Trois états possibles du compte, trois suites différentes. */
    const { data: comptes } = await service.auth.admin.listUsers();
    const compte = comptes?.users?.find(
      (u) => (u.email ?? "").toLowerCase() === adresse
    );

    if (!compte) {
      const { error } = await service.auth.admin.inviteUserByEmail(adresse, {
        redirectTo,
        data: { nom },
      });
      if (error) return json({ erreur: `Envoi impossible : ${error.message}` }, 502);
      await marquerEnvoyee();
      return json({ etat: "invitee", email: adresse });
    }

    if (!compte.email_confirmed_at) {
      /* Le compte existe mais l'adresse n'a jamais été prouvée : on relance
         l'invitation plutôt que d'en fabriquer une seconde. */
      const { error } = await service.auth.admin.inviteUserByEmail(adresse, {
        redirectTo,
        data: { nom },
      });
      if (error) return json({ erreur: `Renvoi impossible : ${error.message}` }, 502);
      await marquerEnvoyee();
      return json({ etat: "confirmation_renvoyee", email: adresse });
    }

    /* Compte déjà confirmé : ni l'un ni l'autre des deux déclencheurs ne se
       redéclenchera jamais pour lui — l'insertion est passée, la transition de
       confirmation aussi. Sans cet appel, l'invitation resterait « en attente »
       pour toujours, sans que rien ne le dise. L'adresse est prouvée puisque le
       compte est confirmé : la condition que la fonction SQL ne vérifie pas est
       vérifiée ici, et c'est son seul appelant. */
    const { error } = await service.rpc("appliquer_invitations", {
      p_profile_id: compte.id,
    });
    if (error) return json({ erreur: `Rattachement impossible : ${error.message}` }, 500);

    return json({ etat: "rattachee", email: adresse });
  } catch (err) {
    console.error("inviter-salarie", err);
    return json({ erreur: "Invitation impossible — réessayez dans un instant." }, 500);
  }
});
