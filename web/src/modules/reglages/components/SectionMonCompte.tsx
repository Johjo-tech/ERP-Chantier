import { useState } from "react";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { nomRenseigne, schemaMonNom } from "@/modules/auth-roles/domain/motdepasse";
import { useRenommerMonCompte } from "@/modules/auth-roles/hooks/useMonCompte";
import { useSession } from "@/modules/auth-roles/hooks/useSession";

/**
 * Réglages › Mon compte › Mon nom, au HTML de `renderMonCompteSection` (app.js
 * l. 12802). Le mot de passe, lui, reste sur la page « Mon compte » ouverte à
 * tous les rôles depuis le menu du nom (D-SOC-06).
 */
export function SectionMonCompte() {
  const { etat } = useSession();
  if (etat.statut !== "connecte") return null;
  const { utilisateur } = etat.session;
  return <MonNom key={utilisateur.id} id={utilisateur.id} nom={utilisateur.nom} email={utilisateur.email} />;
}

function MonNom({ id, nom, email }: { id: string; nom: string; email: string }) {
  const renseigne = nomRenseigne(nom, email);
  const [valeur, setValeur] = useState(renseigne ? nom : "");
  const renommer = useRenommerMonCompte(id);

  function enregistrer() {
    const r = schemaMonNom.safeParse({ nom: valeur });
    if (!r.success) {
      window.alert("Indiquez le nom à afficher.");
      return;
    }
    renommer.mutate(r.data.nom, {
      onSuccess: () => afficherToast("Nom enregistré.", "success"),
      onError: (e) => afficherToast(messageErreur(e)),
    });
  }

  return (
    <>
      <div className="reglage-titre">👤 Mon nom</div>
      <div className="card">
        <div className="card-sub" style={{ marginBottom: "12px" }}>
          C&apos;est ce nom qui s&apos;affiche dans le menu, dans les validations et au-dessus de votre tableau de bord.{" "}
          {renseigne ? "" : "Tant qu'il n'est pas renseigné, l'application se rabat sur votre adresse e-mail."}
        </div>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="mc_nom">Nom affiché</label>
            <input type="text" id="mc_nom" value={valeur} placeholder="Ex : Johan" onChange={(e) => setValeur(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="mc_adresse">Adresse de connexion</label>
            <input type="text" id="mc_adresse" value={email} disabled title="Votre adresse ne se change pas ici" />
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
          <button type="button" className="btn primary" disabled={renommer.isPending} onClick={enregistrer}>
            Enregistrer
          </button>
        </div>
      </div>
    </>
  );
}
