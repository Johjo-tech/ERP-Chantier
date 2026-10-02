import { useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { logoHerite, verifierLogo } from "@/modules/societes/domain/logo";
import { schemaCouleur, type ReglagesSociete } from "@/modules/societes/domain/reglages-societe";
import { useChangerLogo, useEnregistrerReglages, useInfosEntreprise, useLienLogo, useReglagesSociete, useSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { paletteSociete } from "@/modules/societes/theme/palette";
import { PiedEnregistrement } from "./champs";

const STYLE_COULEUR = { width: "56px", height: "40px", padding: "2px", border: "1px solid var(--border)", borderRadius: "10px", cursor: "pointer", background: "var(--surface)" } as const;

/**
 * Logo et couleurs (SOC-04, SOC-08), au HTML de `renderIdentiteVisuelleSection`
 * (app.js l. 12993) : une carte, le logo à gauche (enregistré dès qu'on le
 * choisit), les deux couleurs à droite avec leurs pastilles d'aperçu.
 */
export function SectionIdentiteVisuelle() {
  const reglages = useReglagesSociete();
  if (reglages.isPending) return <Chargement />;
  if (reglages.isError) return <Erreur erreur={reglages.error} reessayer={() => void reglages.refetch()} />;
  return <Identite reglages={reglages.data} />;
}

function Pastille({ fond, encre, libelle }: { fond: string; encre: string; libelle: string }) {
  return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "999px", background: fond, color: encre, fontSize: "11px", fontWeight: 700 }}>{libelle}</span>;
}

function Logo() {
  const modifiable = usePermission("reglages", "modifier");
  const societe = useSociete();
  const infos = useInfosEntreprise();
  const chemin = societe.data?.logo_url ?? null;
  const lien = useLienLogo(chemin);
  const changer = useChangerLogo();
  const herite = logoHerite(infos.data);
  const image = chemin ? lien.data : herite;

  function choisir(fichier: File | undefined) {
    if (!fichier) return;
    const motif = verifierLogo(fichier);
    if (motif) {
      afficherToast(motif);
      return;
    }
    changer.mutate({ fichier, ancien: chemin }, { onSuccess: () => afficherToast("Logo mis à jour.", "success"), onError: (e) => afficherToast(messageErreur(e)) });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px" }}>
      <div className="reglage-titre" style={{ margin: 0 }}>
        Logo
      </div>
      {image ? (
        <div style={{ padding: "12px", border: "1px solid var(--border)", borderRadius: "10px", background: "var(--surface)" }}>
          <img src={image} alt={`Logo de ${societe.data?.nom ?? "la société"}`} style={{ maxHeight: "70px", maxWidth: "220px", display: "block" }} />
        </div>
      ) : (
        <div className="card-sub">Aucun logo : les documents porteront le nom de la société.</div>
      )}
      {!chemin && herite && <div className="card-sub">Logo repris de l&apos;ancienne application : déposez-le à nouveau pour le ranger avec les fichiers.</div>}
      {modifiable && (
        <div style={{ display: "flex", gap: "8px" }}>
          <label className="btn small" style={{ cursor: "pointer" }}>
            📷 {chemin || herite ? "Changer le logo" : "Ajouter un logo"}
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style={{ display: "none" }} onChange={(e) => choisir(e.target.files?.[0])} disabled={changer.isPending} />
          </label>
          {chemin && (
            <button type="button" className="btn small ghost" disabled={changer.isPending} onClick={() => changer.mutate({ fichier: null, ancien: chemin })}>
              Retirer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Identite({ reglages }: { reglages: ReglagesSociete }) {
  const modifiable = usePermission("reglages", "modifier");
  const enregistrer = useEnregistrerReglages();
  const [accent, setAccent] = useState(reglages.documents.couleurAccent);
  const [secondaire, setSecondaire] = useState(reglages.documents.couleurSecondaire);
  const p = paletteSociete(accent, secondaire);
  const valides = schemaCouleur.safeParse(accent).success && schemaCouleur.safeParse(secondaire).success;

  function enregistrerCouleurs() {
    if (!valides) return;
    enregistrer.mutate((r) => ({ ...r, documents: { ...r.documents, couleurAccent: accent, couleurSecondaire: secondaire } }));
  }

  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: "4px" }}>
        🎨 Identité visuelle
      </div>
      <div className="card-sub" style={{ marginBottom: "16px" }}>
        Reprise par l&apos;application et par tous les documents générés — devis, factures, bons de commande.
      </div>
      <div className="reglage-duo">
        <Logo />
        <div>
          <div className="reglage-titre">Couleurs de la société</div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <label className="card-sub" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
              Principale
              <input type="color" id="ie_couleur" value={p.accent.toLowerCase()} disabled={!modifiable} onChange={(e) => setAccent(e.target.value)} style={STYLE_COULEUR} />
            </label>
            <label className="card-sub" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
              Secondaire
              <input type="color" id="ie_couleurSecondaire" value={p.secondaire.toLowerCase()} disabled={!modifiable} onChange={(e) => setSecondaire(e.target.value)} style={STYLE_COULEUR} />
            </label>
            <div id="rg_couleurApercu" aria-label="Aperçu de la palette">
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <Pastille fond={p.accent} encre={p.surAccent} libelle="Accent" />
                <Pastille fond={p.accentFonce} encre={p.surAccentFonce} libelle="Titres" />
                <Pastille fond={p.accentClair} encre="#182233" libelle="Fonds" />
                <Pastille fond={p.secondaire} encre={p.surSecondaire} libelle="En-têtes" />
                <Pastille fond={p.secondaireClair} encre="#182233" libelle="Cartouches" />
              </div>
            </div>
          </div>
          <small className="card-sub" style={{ display: "block", marginTop: "8px" }}>
            La principale porte les titres, les filets et le total TTC ; la secondaire les en-têtes de tableau et les cartouches. Les tons clair et foncé s&apos;en déduisent. L&apos;écran change tout de suite ; enregistrez pour le garder.
          </small>
        </div>
      </div>
      <PiedEnregistrement
        modifiable={modifiable}
        type="button"
        onClick={enregistrerCouleurs}
        style={{ marginTop: "6px" }}
        enCours={enregistrer.isPending}
        erreur={enregistrer.error}
        succes={enregistrer.isSuccess ? "Informations enregistrées." : null}
      />
    </div>
  );
}
