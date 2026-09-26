import type { ComponentProps } from "react";

/**
 * Les champs de saisie : l'ancienne feuille habille directement `input`,
 * `select` et `textarea` (fond gris bleuté, bordure de 2 px, rayon 16 px,
 * flèche dessinée du <select> — ancien.css l. 1068). Ces composants ne
 * rajoutent donc rien : un habit de plus contredirait le sien.
 */
export function Input(props: ComponentProps<"input">) {
  return <input {...props} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} />;
}
