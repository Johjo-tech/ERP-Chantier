#!/usr/bin/env python3
"""Recopie les feuilles de style de l'application historique dans web/src/styles/.

À relancer quand une page historique change en production : chaque copie doit
rester verbatim (garde-fou `tests/garde-fous-style.essai.ts`). Le script ne réécrit
rien d'autre que ces trois fichiers.
"""
import pathlib
import subprocess
import sys

WEB = pathlib.Path(__file__).resolve().parent.parent
PAGES = WEB.parent / "src" / "pages"
STYLES = WEB / "src" / "styles"

# (page historique, copie, portée de la copie)
COPIES = [
    ("index.html", "ancien.css", "importée par toute l'application (src/main.tsx)"),
    ("login.html", "connexion.css", "posée par la seule page de connexion, le temps qu'elle est affichée"),
    ("nouveau-mot-de-passe.html", "nouveau-mot-de-passe.css", "posée par la seule page « nouveau mot de passe »"),
]


def copier(page: str, cible: str, portee: str) -> None:
    source = PAGES / page
    lignes = source.read_text(encoding="utf-8").split("\n")
    debut = next(i for i, l in enumerate(lignes) if l.strip() == "<style>")
    fin = next(i for i, l in enumerate(lignes) if l.strip() == "</style>")
    commit = subprocess.run(
        ["git", "log", "-1", "--format=%H", "--", str(source)],
        cwd=WEB, capture_output=True, text=True, check=True,
    ).stdout.strip() or "inconnu"
    entete = f"""/*
 * COPIE VERBATIM du <style> de l'application historique — NE PAS MODIFIER.
 *
 * Source : src/pages/{page}, lignes {debut + 2} à {fin} (entre <style> et </style>)
 * Commit : {commit}
 * Portée : {portee}
 * Recopie : python3 web/scripts/copier-css-ancien.py
 *
 * La nouvelle application doit être visuellement identique à l'ancienne : on
 * reprend sa feuille telle quelle plutôt que de la réécrire, et on produit le
 * même HTML, avec les mêmes classes. Ce qui manque ou diffère vit dans
 * `complements.css`, jamais ici : le corps de ce fichier doit rester égal à la
 * source (garde-fou `tests/garde-fous-style.essai.ts`).
 */
"""
    (STYLES / cible).write_text(entete + "\n".join(lignes[debut + 1:fin]) + "\n", encoding="utf-8")
    print(f"{cible} ← src/pages/{page} (lignes {debut + 2}-{fin}, commit {commit[:7]})", file=sys.stderr)


STYLES.mkdir(parents=True, exist_ok=True)
for page, cible, portee in COPIES:
    copier(page, cible, portee)
