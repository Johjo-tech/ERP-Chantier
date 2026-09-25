/**
 * Le rapport d'intervention imprimé — PORT LITTÉRAL de `renderPrintIntervention`
 * (src/pages/app.js l. 3646-3691, commit 6f6ac74). Il garde l'ancien en-tête
 * (`.p-header`, `.p-parties`) : il n'a ni lignes chiffrées ni totaux, et
 * l'ancienne feuille le dit en toutes lettres (index.html l. 1455).
 * Parité : tests/parite/impression.essai.ts.
 */
import { esc, fmtDate, logementLabel, logoHTML, withVille, type SocieteImprimable } from "./gabarit";

export interface InterventionImprimable {
  numero?: string | null;
  date?: string | null;
  heure?: string | null;
  client?: string | null;
  interlocuteur?: string | null;
  adresse?: string | null;
  adresseLocataire?: string | null;
  codePostal?: string | null;
  ville?: string | null;
  occupant?: string | null;
  numeroLogement?: string | null;
  logementStatut?: string | null;
  etage?: string | null;
  /** Clé de contrôle → coché. */
  controles?: Record<string, boolean> | null;
  controleAutreTexte?: string | null;
  rapport?: { constatations?: string | null; preconisations?: string | null } | null;
  photos?: { dataUrl: string }[] | null;
  signature?: string | null;
  signatureTechnicien?: string | null;
}

export interface ContexteRapport {
  it: InterventionImprimable | null;
  s: SocieteImprimable;
  nomSociete: string;
  /** `CONTROLES_PAR_METIER[it.typePanne]`, sous les noms de l'ancien. */
  controlesDuMetier: readonly { key: string; label: string }[];
  /** `bcNumeroDepuisId(it.bonCommandeId)` ; `undefined` : aucun bon lié. */
  bcNumero?: string | undefined;
}

export function renderPrintIntervention({ it, s, nomSociete: socName, controlesDuMetier: items, bcNumero }: ContexteRapport): string {
  if (!it) return "<p>Rapport introuvable.</p>";
  const controlesCoches = items.filter((c) => it.controles && it.controles[c.key]).map((c) => (c.key === "autre" && it.controleAutreTexte ? `${c.label} : ${it.controleAutreTexte}` : c.label));
  const r = it.rapport || {};
  const noOccupant = it.logementStatut === "vacant" || it.logementStatut === "commune";
  return `
    <table class="p-header"><tr>
      <td style="width:55%;">
        ${logoHTML(s)}
        <div class="p-doctitle">RAPPORT D'INTERVENTION</div>
      </td>
      <td style="width:45%;">
        <div class="p-docmeta" style="display:flex; justify-content:space-between; gap:10mm;"><span>N° <b>${esc(it.numero || "—")}</b></span><span>${fmtDate(it.date)}${it.heure ? " à " + esc(it.heure) : ""}</span></div>
        ${bcNumero !== undefined ? `<div class="p-docmeta" style="text-align:right; margin-top:2px;">BC n° <b>${esc(bcNumero)}</b></div>` : ""}
      </td>
    </tr></table>
    <div class="p-rule"></div>
    <table class="p-parties"><tr>
      <td>
        <div class="p-label">Client</div>
        <div class="p-name">${esc(it.client)}</div>
        ${it.interlocuteur ? `<div class="p-line">À l'attention de ${esc(it.interlocuteur)}</div>` : ""}
        <div class="p-line">${esc(it.adresse)}</div>
      </td>
      <td>
        ${it.adresseLocataire || it.occupant || it.numeroLogement || it.logementStatut ? `<div class="p-locataire"><div class="p-label">Lieu d'intervention</div><div class="p-line">${it.occupant ? "<b>" + esc(it.occupant) + "</b><br>" : ""}${esc(withVille(it.adresseLocataire, it.codePostal, it.ville))}${it.etage ? "<br>Étage " + esc(it.etage) : ""}${it.logementStatut ? "<br>" + esc(logementLabel(it.logementStatut)) : ""}${it.numeroLogement ? "<br>Logement n° " + esc(it.numeroLogement) : ""}</div></div>` : ""}
      </td>
    </tr></table>
    ${controlesCoches.length ? `<div class="p-section-title">Contrôles réalisés</div><div class="p-line">${controlesCoches.map((c) => esc(c)).join(" · ")}</div>` : ""}
    ${r.constatations ? `<div class="p-section-title">Constatations</div><div class="p-line">${esc(r.constatations).replace(/\n/g, "<br>")}</div>` : ""}
    ${r.preconisations ? `<div class="p-section-title">Préconisations</div><div class="p-line">${esc(r.preconisations).replace(/\n/g, "<br>")}</div>` : ""}
    ${it.photos && it.photos.length ? `<div class="p-section-title">Photos</div><div class="p-photos">${it.photos.map((p) => `<img src="${p.dataUrl}" class="p-photo">`).join("")}</div>` : ""}
    <table class="p-sign"><tr>
      ${noOccupant ? "" : `<td>Signature client :${it.signature ? `<br><img src="${it.signature}" class="p-signature-img">` : '<div class="p-sigline"></div>'}</td>`}
      <td>Signature technicien :${it.signatureTechnicien ? `<br><img src="${it.signatureTechnicien}" class="p-signature-img">` : '<div class="p-sigline"></div>'}</td>
    </tr></table>
    <div class="p-footer">${esc(socName)}${s.siret ? " — SIRET " + esc(s.siret) : ""}${s.adresse ? " — " + esc(s.adresse) : ""}</div>
  `;
}
