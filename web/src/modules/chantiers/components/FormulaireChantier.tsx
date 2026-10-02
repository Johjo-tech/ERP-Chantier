import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { useFormulaire } from "@/lib/useFormulaire";
import { communesDuCodePostal } from "@/modules/clients/api/communes";
import { SuggestionsAdresse } from "@/modules/clients/components/Annuaire";
import { useClients } from "@/modules/clients/hooks/useClients";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { optionsConducteurs, useConducteurs } from "@/modules/societes/hooks/useConducteurs";
import { saisieDepuis, schemaSaisieChantier, type Chantier } from "../domain/chantier";
import { useChantier, useEnregistrerChantier } from "../hooks/useChantiers";

/** Une commune ne change pas de code postal d'un jour à l'autre. */
const GARDE_COMMUNES_MS = 24 * 60 * 60_000;

/**
 * La fiche d'un chantier (`chantierForm` de l'ancien), ouverte en place : au-
 * dessus des cartes pour un nouveau chantier, à la place du bandeau de la fiche
 * pour « Modifier les infos ».
 */
export function FormulaireChantierEnPlace({ id, onFermer, defiler = true }: { id: string | null; onFermer: (c?: Chantier) => void; defiler?: boolean }) {
  const chantier = useChantier(id ?? undefined);
  if (id && chantier.isPending) return <Chargement />;
  if (id && chantier.isError) return <Erreur erreur={chantier.error} reessayer={() => void chantier.refetch()} />;
  const f = <FormulaireChantier chantier={chantier.data ?? null} onFermer={onFermer} defiler={defiler} />;
  return chantier.data ? (
    <GardeSociete societeId={chantier.data.societe_id} retour="/chantiers">
      {f}
    </GardeSociete>
  ) : (
    f
  );
}

function Champ({ libelle, full, style, erreur, children }: { libelle: string; full?: boolean; style?: React.CSSProperties; erreur?: string | undefined; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className={full ? "field full" : "field"} style={style}>
      <label htmlFor={id}>{libelle}</label>
      {children(id)}
      {erreur && (
        <small role="alert" className="champ-erreur">
          {erreur}
        </small>
      )}
    </div>
  );
}

function FormulaireChantier({ chantier, onFermer, defiler }: { chantier: Chantier | null; onFermer: (c?: Chantier) => void; defiler: boolean }) {
  const [params] = useSearchParams();
  const enregistrer = useEnregistrerChantier(chantier?.id);
  const clients = useClients();
  const conducteurs = useConducteurs();
  const initiales = saisieDepuis(chantier);
  if (!chantier && params.get("client")) initiales.client_id = params.get("client") ?? "";
  const { valeurs, erreurs, changer, valider } = useFormulaire(initiales);
  const [adresseTapee, setAdresseTapee] = useState(false);
  const [cpTape, setCpTape] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  // L'ancien faisait défiler jusqu'au formulaire au-dessus des cartes ; ouvert depuis la fiche, il ne bougeait pas.
  useEffect(() => {
    if (defiler) ref.current?.scrollIntoView?.({ block: "start" });
  }, [defiler]);

  // Le code postal saisi remplit la ville (`lookupVilleParCodePostal`) : seulement sur une frappe, jamais à l'ouverture.
  const cp = valeurs.code_postal.trim();
  const communes = useQuery({
    queryKey: ["communes", cp],
    queryFn: ({ signal }) => communesDuCodePostal(cp, signal),
    enabled: cpTape && /^\d{5}$/.test(cp),
    staleTime: GARDE_COMMUNES_MS,
  });
  const premiere = communes.data?.[0];
  useEffect(() => {
    if (cpTape && premiere) changer("ville", premiere);
    // `changer` est recréé à chaque rendu : seule la commune trouvée déclenche.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premiere, cpTape]);

  const texte = (nom: keyof typeof valeurs) => ({ value: valeurs[nom], onChange: (e: { target: { value: string } }) => changer(nom, e.target.value) });
  const clientsTries = [...(clients.data ?? [])].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!valeurs.nom.trim()) return window.alert("Le nom du chantier est requis.");
    const s = valider(schemaSaisieChantier);
    if (!s) return;
    // Un client absent de la liste (autre société, lien fabriqué) n'est pas rattaché.
    const clientConnu = !s.client_id || (clients.data ?? []).some((c) => c.id === s.client_id);
    enregistrer.mutate(
      { ...s, client_id: clientConnu ? s.client_id : null },
      {
        onSuccess: (c) => {
          afficherToast(chantier ? "Chantier modifié." : "Chantier créé.", "success");
          onFermer(c);
        },
        onError: (err) => afficherToast(messageErreur(err)),
      }
    );
  }

  return (
    <form ref={ref} className="form-panel" onSubmit={soumettre} noValidate aria-label={chantier ? "Modifier le chantier" : "Nouveau chantier"}>
      <h3>{chantier ? "Modifier le chantier" : "Nouveau chantier"}</h3>
      <div className="field-grid">
        <Champ libelle="Nom du chantier" full>
          {(id) => <input type="text" id={id} placeholder="Ex : Résidence Les Tilleuls — Réfection façades" {...texte("nom")} />}
        </Champ>
        <Champ libelle="Type">
          {(id) => (
            // Un type historique hors liste (« Rénovation ») s'affiche « Réhabilitation » comme dans l'ancien, mais n'est réécrit que si l'on choisit.
            <select id={id} {...texte("type")}>
              <option value="rehabilitation">Réhabilitation</option>
              <option value="neuf">Chantier neuf</option>
            </select>
          )}
        </Champ>
        <Champ libelle="Statut" erreur={erreurs.statut}>
          {(id) => (
            <select id={id} {...texte("statut")}>
              <option value="en préparation">En préparation</option>
              <option value="en cours">En cours</option>
              <option value="terminé">Terminé</option>
            </select>
          )}
        </Champ>
        <Champ libelle="Client">
          {(id) => (
            <select id={id} {...texte("client_id")}>
              <option value="">— Sélectionner un client —</option>
              {clientsTries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          )}
        </Champ>
        <Champ libelle="Conducteur de travaux">
          {(id) => (
            <select id={id} {...texte("conducteur_id")}>
              <option value="">— Non attribué —</option>
              {optionsConducteurs(conducteurs.data ?? [], chantier?.conducteur_id ?? null).map((o) => (
                <option key={o.valeur} value={o.valeur}>
                  {o.libelle}
                </option>
              ))}
            </select>
          )}
        </Champ>
        <div className="address-trio">
          <Champ libelle="Adresse" style={{ position: "relative" }}>
            {(id) => (
              <>
                <input
                  type="text"
                  id={id}
                  autoComplete="off"
                  value={valeurs.adresse}
                  onChange={(e) => {
                    changer("adresse", e.target.value);
                    setAdresseTapee(true);
                  }}
                  onBlur={() => setAdresseTapee(false)}
                />
                <SuggestionsAdresse
                  id="chAdresseSuggestions"
                  saisie={valeurs.adresse}
                  actif={adresseTapee}
                  onChoisir={(a) => {
                    changer("adresse", a.adresse);
                    changer("code_postal", a.codePostal);
                    changer("ville", a.ville);
                    setAdresseTapee(false);
                  }}
                />
              </>
            )}
          </Champ>
          <Champ libelle="Code postal">
            {(id) => (
              <input
                type="text"
                id={id}
                maxLength={5}
                inputMode="numeric"
                value={valeurs.code_postal}
                onChange={(e) => {
                  changer("code_postal", e.target.value);
                  setCpTape(true);
                }}
              />
            )}
          </Champ>
          <Champ libelle="Ville">{(id) => <input type="text" id={id} {...texte("ville")} />}</Champ>
        </div>
        <Champ libelle="Date de début" erreur={erreurs.date_debut}>
          {(id) => <input type="date" id={id} {...texte("date_debut")} />}
        </Champ>
        <Champ libelle="Date de fin prévisionnelle" erreur={erreurs.date_fin}>
          {(id) => <input type="date" id={id} {...texte("date_fin")} />}
        </Champ>
        <Champ libelle="Notes" full>
          {(id) => <input type="text" id={id} placeholder="Remarques…" {...texte("notes")} />}
        </Champ>
      </div>
      <div className="section-title" style={{ marginTop: "16px" }}>
        📋 Informations PPSPS (optionnel)
      </div>
      <div className="card-sub" style={{ marginBottom: "10px" }}>
        Utilisées pour générer automatiquement le PPSPS de ce chantier.
      </div>
      <div className="field-grid">
        <Champ libelle="Lot" full>
          {(id) => <input type="text" id={id} placeholder="Ex : Peintures intérieures" {...texte("ppsps_lot")} />}
        </Champ>
        <Champ libelle="Maître de l'ouvrage (si différent du client)">
          {(id) => <textarea id={id} rows={3} placeholder="Nom, société, adresse…" {...texte("ppsps_maitre_ouvrage")} />}
        </Champ>
        <Champ libelle="Maître d'œuvre">{(id) => <textarea id={id} rows={3} placeholder="Nom, société, adresse…" {...texte("ppsps_maitre_oeuvre")} />}</Champ>
        <Champ libelle="Coordonnateur S.P.S.">{(id) => <textarea id={id} rows={3} placeholder="Nom, société, adresse…" {...texte("ppsps_coordinateur_sps")} />}</Champ>
        <Champ libelle="Effectif moyen prévisible">{(id) => <input type="text" id={id} {...texte("ppsps_effectif_moyen")} />}</Champ>
      </div>
      <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
        <button type="submit" className="btn primary" disabled={enregistrer.isPending}>
          Enregistrer
        </button>
        <button type="button" className="btn ghost" onClick={() => onFermer()}>
          Annuler
        </button>
      </div>
    </form>
  );
}
