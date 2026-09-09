/**
 * Profil colorimétrique de sortie, pour la conformité PDF/A.
 *
 * PDF/A interdit un document qui décrit ses couleurs sans dire dans quel
 * espace les lire : sans profil de sortie, le validateur refuse toute page
 * utilisant `DeviceRGB` ou `DeviceGray` — c'est-à-dire toutes les nôtres. Le
 * validateur Mustangproject ne relevait que ces deux défauts sur 602 contrôles.
 *
 * Le profil est embarqué en base64 plutôt que lu depuis un fichier : il doit
 * suivre le bundle navigateur, où aucun système de fichiers n'existe. 588
 * octets, produit par LittleCMS — un sRGB standard, sans restriction d'usage.
 */

const SRGB_BASE64 =
  "AAACTGxjbXMEQAAAbW50clJHQiBYWVogB+oACQAJABIAKAAgYWNzcEFQUEwAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1sY21zAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAALZGVzYwAAAQgAAAA2Y3BydAAAAUAAAABMd3RwdAAAAYwAAAAUY2hh" +
  "ZAAAAaAAAAAsclhZWgAAAcwAAAAUYlhZWgAAAeAAAAAUZ1hZWgAAAfQAAAAUclRSQwAAAggAAAAg" +
  "Z1RSQwAAAggAAAAgYlRSQwAAAggAAAAgY2hybQAAAigAAAAkbWx1YwAAAAAAAAABAAAADGVuVVMA" +
  "AAAaAAAAHABzAFIARwBCACAAYgB1AGkAbAB0AC0AaQBuAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAA" +
  "ADAAAAAcAE4AbwAgAGMAbwBwAHkAcgBpAGcAaAB0ACwAIAB1AHMAZQAgAGYAcgBlAGUAbAB5WFla" +
  "IAAAAAAAAPbWAAEAAAAA0y1zZjMyAAAAAAABDEIAAAXe///zJQAAB5MAAP2Q///7of///aIAAAPc" +
  "AADAblhZWiAAAAAAAABvoAAAOPUAAAOQWFlaIAAAAAAAACSfAAAPhAAAtsNYWVogAAAAAAAAYpcA" +
  "ALeHAAAY2XBhcmEAAAAAAAMAAAACZmYAAPKnAAANWQAAE9AAAApbY2hybQAAAAAAAwAAAACj1wAA" +
  "VHsAAEzNAACZmgAAJmYAAA9c";

/** Les octets du profil, décodés une seule fois. */
export function profilSRGB(): Uint8Array {
  const binaire = atob(SRGB_BASE64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return octets;
}

/** Ce que le PDF déclare comme condition de sortie. */
export const CONDITION_SORTIE = "sRGB IEC61966-2.1";
