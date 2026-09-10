/**
 * Les librairies de document, servies par le build plutôt que par un CDN.
 *
 * L'écran historique les appelait comme des globales — `html2pdf()`, `XLSX`,
 * `docx` — chargées par quatre balises `<script src="https://…">`. Trois
 * raisons de les rapatrier :
 *
 * - **la chaîne d'approvisionnement** : sans attribut `integrity`, un CDN
 *   compromis exécutait le code de son choix dans une application qui manipule
 *   des factures ;
 * - **la version** : `xlsx@0.18.5` traîne deux failles — pollution de
 *   prototype à la lecture d'un fichier piégé (CVE-2023-30533) et déni de
 *   service par expression régulière (CVE-2024-22363). SheetJS ne publie plus
 *   sur npm, la 0.20.3 vient de son propre CDN, épinglée dans `package.json` ;
 * - **la disponibilité** : hors ligne ou derrière un pare-feu d'entreprise,
 *   l'export PDF et l'import Excel disparaissaient sans explication.
 *
 * Elles restent posées sur `window` : réécrire les 11 000 lignes du monolithe
 * en modules n'est pas le sujet, et le pont fonctionne exactement ainsi pour
 * tout le reste. Ce fichier est le seul endroit qui le fasse pour elles.
 *
 * L'ordre est sans piège : ce module est évalué au chargement de la page,
 * bien avant qu'un clic n'appelle un export.
 *
 * Chart.js chargeait 200 ko à chaque ouverture pour rien : l'écran des
 * statistiques dessine ses barres en HTML, aucun `new Chart` n'existe dans le
 * code. La balise a été retirée sans remplacement.
 */

import html2pdf from "html2pdf.js";
import * as docx from "docx";
import * as XLSX from "xlsx";

declare global {
  interface Window {
    html2pdf: typeof html2pdf;
    docx: typeof docx;
    XLSX: typeof XLSX;
  }
}

window.html2pdf = html2pdf;
window.docx = docx;
window.XLSX = XLSX;
