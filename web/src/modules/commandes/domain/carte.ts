import { dateISO, formatDateFr } from "@/lib/dates";
import type { StatutLogement } from "@/modules/documents/domain/logement";
import type { EnteteBon } from "./bon";
import { metiersDuBon } from "./metiers";
import type { EtatPiece } from "./workflow";

/**
 * Ce que dit la carte d'un bon (`bonCommandeCardHTML`, app.js l. 6880) : les
 * lignes de texte qu'elle compose, sans le HTML. Tout ce qui s'y lit se
 * décide ici, pour qu'un test les compare à l'ancien au caractère près.
 */

/** Où la carte est posée : la liste des bons, ou l'écran « Pièces en commande » (le `workflowCtx` de l'ancien). */
export type ContexteCarte = "liste" | "pieceCommande";

/** « 14 rue Garibaldi, 69003 Lyon » (`withVille`). */
export function avecVille(adresse: string | null | undefined, cp: string | null | undefined, ville: string | null | undefined): string {
  const cpVille = [cp, ville].filter(Boolean).join(" ");
  return [adresse, cpVille].filter(Boolean).join(", ");
}

/** Libellé du type de logement (`logementLabel`). */
export function libelleLogement(statut: StatutLogement | null | undefined): string {
  if (statut === "occupé") return "Logement occupé";
  if (statut === "vacant") return "Logement vacant";
  if (statut === "commune") return "Partie commune";
  return "";
}

/** La couleur de sa pastille (`logementBadge`) : occupé orange, vacant vert, partie commune bleu. */
export function classeLogement(statut: StatutLogement): "warn" | "success" | "info" {
  return statut === "occupé" ? "warn" : statut === "vacant" ? "success" : "info";
}

/** La pastille du `statut` libre (`badgeClass`) : « en attente » n'y figure pas, il est gris. */
export function classeStatut(statut: string | null | undefined): string {
  const table: Record<string, string> = {
    brouillon: "gray", envoyé: "info", envoyée: "info", accepté: "success", payée: "success", terminée: "success",
    reçu: "success", refusé: "danger", impayée: "danger", annulé: "danger", "en cours": "yellow",
  };
  return table[statut ?? ""] ?? "gray";
}

/** La ligne du locataire (`locataireCardLine`) ; vide quand il n'y a rien à dire. */
export function ligneLocataire(b: Pick<EnteteBon, "numero_logement" | "adresse_locataire" | "code_postal" | "ville" | "precision_commune" | "ancien_locataire" | "occupant">): string {
  const numero = b.numero_logement ? ` · Log ${b.numero_logement}` : "";
  const adresse = avecVille(b.adresse_locataire, b.code_postal, b.ville);
  if (b.precision_commune) return `Partie commune : ${b.precision_commune}${adresse ? ` — ${adresse}` : ""}`;
  if (b.ancien_locataire) return `Ancien locataire${numero} : ${b.ancien_locataire}${adresse ? ` — ${adresse}` : ""}`;
  if (b.adresse_locataire || b.occupant || b.numero_logement) {
    let ligne = `Locataire${numero}`;
    if (b.occupant) ligne += ` : ${b.occupant}`;
    if (adresse) ligne += (b.occupant ? " — " : " : ") + adresse;
    return ligne;
  }
  return "";
}

/** « 👤 Mme X · 🔧 Peinture, Plomberie » : la première ligne du détail déplié, vide comprise. */
export function ligneInterlocuteurMetiers(b: Pick<EnteteBon, "interlocuteur" | "metiers" | "metier">): string {
  const metiers = metiersDuBon(b);
  const morceaux = [b.interlocuteur ? `👤 ${b.interlocuteur}` : "", metiers.length ? `🔧 ${metiers.join(", ")}` : ""];
  return morceaux.filter(Boolean).join(" · ");
}

/** « Reçu le 05/09/2026 · Fin travaux : 30/09/2026 » ; vide sans date. */
export function ligneDates(b: Pick<EnteteBon, "date_reception" | "date_fin_travaux">): string {
  return `${b.date_reception ? `Reçu le ${formatDateFr(b.date_reception)}` : ""}${b.date_fin_travaux ? ` · Fin travaux : ${formatDateFr(b.date_fin_travaux)}` : ""}`;
}

/**
 * La pièce attendue, en une ligne (`pieceAttendueLigne`) : sa couleur passe au
 * vert quand elle est reçue. `null` sans pièce.
 */
export function pieceAttendue(p: EtatPiece): { texte: string; recue: boolean } | null {
  if (!p.pieceACommander && !p.description) return null;
  const etape = p.recueLe ? `reçue le ${formatDateFr(dateISO(new Date(p.recueLe)))}` : p.dateCommande ? `commandée le ${formatDateFr(p.dateCommande)}` : "pas encore commandée";
  const texte = [p.description || "pièce non précisée", etape, p.fournisseur ? `chez ${p.fournisseur}` : ""].filter(Boolean).join(" — ");
  return { texte: `📦 ${texte}`, recue: !!p.recueLe };
}

/** Le message qui ferme la carte dépliée tant que le bon n'est pas chiffré. */
export function messageAttenteFacturation(valideConducteur: boolean): string {
  return `⏳ En attente — ${!valideConducteur ? "la validation du conducteur puis du directeur est requise" : "la validation du directeur est requise"} avant de pouvoir facturer ce bon de commande.`;
}

/** « 12 bons de commande sur 48. » — seulement quand un filtre retient moins que le tout (`syntheseListe`). */
export function syntheseListe(retenus: number, total: number, quoi: string, actif: boolean): string | null {
  if (!actif || retenus === total) return null;
  return `${retenus} ${quoi}${retenus > 1 ? "s" : ""} sur ${total}.`;
}
