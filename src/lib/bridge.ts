/**
 * Le pont entre l'écran hérité et les îlots React.
 *
 * `app.js` et React ne partagent ni état ni arbre de composants : chacun tient
 * son morceau de page. Ils se parlent donc par événements sur `window`, dans
 * les deux sens — un îlot qui enregistre prévient l'écran, et l'écran qui
 * change de société prévient les îlots.
 *
 * L'intérêt de passer par ici plutôt que d'écrire `dispatchEvent` à la main :
 * la carte `ErpEvents` ci-dessous est la LISTE des messages qui existent. Un
 * nom mal tapé ne compile pas, et une charge utile incomplète non plus. Sans
 * elle, un renommage côté émetteur laisse l'écouteur muet sans rien casser à
 * la construction — la panne se découvre en production.
 */

/**
 * Les messages du pont, et ce que chacun transporte.
 *
 * Convention de nommage : `erp:<sujet>-<verbe au participe>`. Le préfixe évite
 * toute collision avec un événement du navigateur ou d'une bibliothèque.
 *
 * Un message décrit un FAIT ACCOMPLI, jamais un ordre. « L'article est
 * enregistré » se publie ; « enregistre cet article » ne se publie pas — un
 * ordre suppose que l'émetteur sache qui écoute, et le pont ne le garantit pas.
 */
export interface ErpEvents {
  /** Un article du catalogue vient d'être créé ou modifié. */
  "erp:article-enregistre": { id: string; reference: string };
  /** L'utilisateur a changé de société depuis l'écran hérité. */
  "erp:societe-changee": { code: string };
  /** Un îlot a fini de se monter. Sert au diagnostic. */
  "erp:ilot-monte": { id: string };
}

type NomEvenement = keyof ErpEvents;

/**
 * Publie un message. Rend la main immédiatement : les écouteurs sont appelés
 * de façon synchrone, mais leurs erreurs n'interrompent pas l'émetteur.
 */
export function emettre<N extends NomEvenement>(nom: N, charge: ErpEvents[N]): void {
  window.dispatchEvent(new CustomEvent(nom, { detail: charge }));
}

/**
 * Écoute un message. Rend la fonction qui arrête d'écouter — à appeler dans le
 * nettoyage d'un `useEffect`, sans quoi un composant démonté continue de
 * réagir et fuit.
 */
export function ecouter<N extends NomEvenement>(
  nom: N,
  reaction: (charge: ErpEvents[N]) => void,
): () => void {
  const enveloppe = (e: Event) => {
    reaction((e as CustomEvent<ErpEvents[N]>).detail);
  };
  window.addEventListener(nom, enveloppe);
  return () => window.removeEventListener(nom, enveloppe);
}
