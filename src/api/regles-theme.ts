/**
 * La couleur d'une société, déclinée en palette.
 *
 * Chaque société choisit une couleur ; ses documents et l'interface la
 * reprennent. Les tons foncé et clair ne se saisissent pas : les demander
 * reviendrait à faire composer une harmonie à qui veut juste poser son orange,
 * et laisserait passer des trios qui jurent.
 *
 * Module feuille — il n'importe que des types.
 */

/** L'orange historique, et les deux tons choisis à la main autour de lui. */
export const ACCENT_DEFAUT = "#FF6A1A";
const PALETTE_HISTORIQUE: PaletteAccent = {
  accent: "#FF6A1A",
  accentFonce: "#C24E00",
  accentClair: "#FFE7D6",
  surAccent: "#FFFFFF",
};

export interface PaletteAccent {
  accent: string;
  /** Titres et chapitres du document. */
  accentFonce: string;
  /** Fonds d'encadrés et filets. */
  accentClair: string;
  /** Le texte posé SUR la couleur : noir ou blanc, celui qui se lit. */
  surAccent: string;
}

/** Luminosités des deux déclinaisons, relevées sur la palette historique. */
const L_FONCE = 0.38;
const L_CLAIR = 0.92;

function versRvb(hex: string): [number, number, number] | null {
  const brut = hex.trim().replace(/^#/, "");
  const complet =
    brut.length === 3
      ? brut
          .split("")
          .map((c) => c + c)
          .join("")
      : brut;
  if (!/^[0-9a-fA-F]{6}$/.test(complet)) return null;
  return [
    parseInt(complet.slice(0, 2), 16),
    parseInt(complet.slice(2, 4), 16),
    parseInt(complet.slice(4, 6), 16),
  ];
}

function versTsl([r, g, b]: [number, number, number]): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) return [0, 0, l];

  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;

  return [((h * 60) % 360 + 360) % 360, s, l];
}

function versHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];

  const octet = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${octet(r)}${octet(g)}${octet(b)}`;
}

/** Luminance relative sRGB — la formule de WCAG, pour décider du texte lisible. */
function luminance([r, g, b]: [number, number, number]): number {
  const canal = (v: number) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/* Les deux encres possibles. Le sombre n'est pas un noir pur : c'est la couleur
   de texte du reste de l'application, et c'est donc elle qu'il faut mesurer. */
const TEXTE_CLAIR: [number, number, number] = [255, 255, 255];
const TEXTE_SOMBRE: [number, number, number] = [0x18, 0x22, 0x33];

function contraste(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * L'encre qui se lit sur cette couleur.
 *
 * Le contraste est mesuré sur les deux encres réellement employées, pas sur un
 * noir et un blanc théoriques : `#182233` est nettement plus clair que le noir,
 * et le supposer parfait faisait choisir une encre qu'on n'avait jamais évaluée
 * — précisément sur les couleurs moyennes, là où le choix est serré.
 */
function texteLisibleSur(fond: [number, number, number]): string {
  return contraste(fond, TEXTE_CLAIR) >= contraste(fond, TEXTE_SOMBRE)
    ? "#FFFFFF"
    : "#182233";
}

/**
 * La palette d'une société.
 *
 * La teinte et la saturation sont celles qu'on a choisies ; seule la luminosité
 * bouge, ce qui donne une famille cohérente sans rien demander de plus.
 *
 * L'orange par défaut rend **la palette historique telle quelle**, et non son
 * calcul : les trois tons d'origine ont été accordés à la main, et les
 * recalculer déplacerait de deux ou trois degrés la teinte des documents de
 * toutes les sociétés qui n'ont rien choisi. Un réglage qu'on n'a pas touché ne
 * doit rien changer à ce qu'on imprime.
 *
 * Une couleur absente ou malformée retombe sur ce même défaut : un réglage vide
 * ne doit pas produire un document sans couleur.
 */
export function paletteAccent(couleur?: string | null): PaletteAccent {
  const rvb = versRvb(String(couleur ?? ""));
  if (!rvb) return { ...PALETTE_HISTORIQUE };

  const accent = `#${rvb.map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  if (accent === ACCENT_DEFAUT) return { ...PALETTE_HISTORIQUE };

  const [h, s] = versTsl(rvb);

  return {
    accent,
    accentFonce: versHex(h, s, L_FONCE),
    accentClair: versHex(h, s, L_CLAIR),
    surAccent: texteLisibleSur(rvb),
  };
}
