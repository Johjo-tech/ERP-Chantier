/**
 * Profil colorimétrique de sortie, pour PDF/A (copie de src/integrations/srgb.ts).
 *
 * PDF/A refuse une page en `DeviceRGB`/`DeviceGray` sans dire dans quel
 * espace lire ses couleurs — soit toutes nos pages. C'était le seul défaut que
 * le validateur Mustangproject relevait sur les PDF de l'ancien écran. Le
 * profil voyage en base64 : il doit suivre le bundle, où aucun fichier n'est
 * lisible. 588 octets, produit par LittleCMS, sans restriction d'usage.
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

export function profilSRGB(): Uint8Array {
  const binaire = atob(SRGB_BASE64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return octets;
}

export const CONDITION_SORTIE = "sRGB IEC61966-2.1";
