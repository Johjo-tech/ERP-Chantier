/**
 * L'îlot de démonstration.
 *
 * Il n'a aucune valeur métier : il existe pour PROUVER trois choses d'un coup
 * d'œil, et sera retiré dès que le premier vrai îlot sera en place.
 *
 * 1. React se construit et s'exécute dans la page de l'écran hérité.
 * 2. La session d'authentification est PARTAGÉE — l'îlot affiche l'utilisateur
 *    sans se connecter lui-même, donc il lit la session ouverte par `app.js`.
 *    C'est la preuve qu'il n'existe qu'un seul client Supabase.
 * 3. Le pont fonctionne : l'îlot réagit à un événement émis par l'écran.
 *
 * Il ne fait que LIRE. Aucune écriture, aucun appel qui engage.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { societeActive } from "@/integrations/session";
import { ecouter } from "@/lib/bridge";
import styles from "./demo.module.css";

interface Etat {
  courriel: string | null;
  societe: string | null;
  charge: boolean;
}

export function IlotDemo() {
  const [etat, setEtat] = useState<Etat>({ courriel: null, societe: null, charge: false });

  useEffect(() => {
    let vivant = true;

    async function relire() {
      /* `getSession()` lit la session en mémoire du client partagé : pas
         d'aller-retour réseau, et surtout aucune tentative de connexion. Si
         l'îlot voit un utilisateur, c'est nécessairement celui qu'`app.js` a
         connecté. */
      const { data } = await supabase.auth.getSession();
      if (!vivant) return;
      const societe = societeActive();
      setEtat({
        courriel: data.session?.user.email ?? null,
        /* `id` porte le code court (« kta »), pas un uuid — c'est `uuid` qui
           porte la clé. Le nom du champ est trompeur, la déclaration le dit. */
        societe: societe ? `${societe.nom} (${societe.id})` : null,
        charge: true,
      });
    }

    void relire();

    /* L'écran charge sa session APRÈS le montage des îlots : au premier rendu,
       `societeActive()` rend souvent `null`. On relit donc au changement de
       société, ce qui couvre aussi la bascule manuelle. */
    const arreter = ecouter("erp:societe-changee", () => void relire());
    return () => {
      vivant = false;
      arreter();
    };
  }, []);

  return (
    <div className={styles.carte}>
      <p className={styles.titre}>Îlot React — démonstration de cohabitation</p>

      <div className={styles.ligne}>
        <span className={styles.etiquette}>Session partagée</span>
        <span className={styles.valeur}>
          {!etat.charge ? (
            <span className={styles.absent}>lecture…</span>
          ) : etat.courriel ? (
            etat.courriel
          ) : (
            <span className={styles.absent}>aucune session</span>
          )}
        </span>
      </div>

      <div className={styles.ligne}>
        <span className={styles.etiquette}>Société active</span>
        <span className={styles.valeur}>
          {etat.societe ?? <span className={styles.absent}>non chargée</span>}
        </span>
      </div>

      <div className={styles.ligne}>
        <span className={styles.etiquette}>React</span>
        <span className={styles.valeur}>{`v${(globalThis as { React?: { version?: string } }).React?.version ?? "19"} · monté`}</span>
      </div>
    </div>
  );
}
