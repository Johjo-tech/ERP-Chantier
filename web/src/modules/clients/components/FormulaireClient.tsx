import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { useFormulaire } from "@/lib/useFormulaire";
import { erreursParChamp } from "@/lib/validation";
import { cadreSuggere } from "@/modules/efacture/domain/cadre";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { SCHEMAS_ADRESSE_ELECTRONIQUE } from "@/modules/societes/domain/societe";
import type { ReglagesDocuments } from "@/modules/societes/domain/reglages";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import { appliquerEtablissement, type ChampsAnnuaire, type EtablissementTrouve } from "../domain/annuaire";
import { CADRES_FACTURATION, saisieDepuis, schemaSaisieClient, type Client } from "../domain/client";
import { CLE_AUTRE, CLE_DELAI_PAR_CADRE, CLE_SOCIETE, cleDelai, DELAIS_PREREGLES } from "../domain/delais";
import { adresseElectroniqueParDefaut, completudeClient, phraseManques, sectionsEfactureVisibles } from "../domain/efacture";
import { chiffres, sirenDuSiret, tvaIntracomFr } from "../domain/identifiants";
import { useClient, useEnregistrerClient } from "../hooks/useClients";
import { ChampSiret, SuggestionsAdresse, SuggestionsEntreprise } from "./Annuaire";
import { ChampsDelai } from "./ChampsDelai";
import { VillesProposees } from "./VillesProposees";

/** L'aide de chaque type de client, mot pour mot celle de l'ancien (`CADRES_FACTURATION[].aide`). */
const AIDE_CADRE: Record<string, string> = {
  B2C: "Hors facture électronique : relève de l'e-reporting.",
  B2B_national: "Facture transmise par votre plateforme de dématérialisation.",
  B2G: "Passe par Chorus Pro : code service et n° d'engagement sont souvent exigés.",
  B2B_international: "Hors facture électronique : e-reporting. Le n° de TVA est attendu.",
};

const PETIT = { color: "var(--text-dim)", fontSize: "11px" } as const;
const TITRE_SECTION = { margin: "12px 0 0" } as const;
const RESUME = { cursor: "pointer", fontWeight: 600, fontSize: "13px" } as const;

type Valeurs = ReturnType<typeof saisieDepuis>;

/**
 * La fiche client ouverte AU-DESSUS de la liste, comme l'ancien (`clientForm`
 * dans `#formZoneClient`). Elle se charge elle-même quand on la rouvre sur un
 * client existant.
 */
export function FormulaireClientEnPlace({ id, onFermer }: { id: string | null; onFermer: () => void }) {
  const client = useClient(id ?? undefined);
  const reglages = useReglages();

  let contenu: ReactNode;
  if ((id && client.isPending) || reglages.isPending) contenu = <Chargement />;
  else if (id && client.isError) contenu = <Erreur erreur={client.error} reessayer={() => void client.refetch()} />;
  else if (reglages.isError) contenu = <Erreur erreur={reglages.error} reessayer={() => void reglages.refetch()} />;
  else {
    const f = <FormulaireClient client={client.data ?? null} reglages={reglages.data} onFermer={onFermer} />;
    contenu = client.data ? (
      <GardeSociete societeId={client.data.societe_id} retour="/clients">
        {f}
      </GardeSociete>
    ) : (
      f
    );
  }
  return contenu;
}

/** Un champ de l'ancien : le libellé PUIS la saisie (le libellé flotte dans la case). */
function Champ({ libelle, full, erreur, style, id: idImpose, children }: { libelle: string; full?: boolean; erreur?: string | undefined; style?: React.CSSProperties; id?: string; children: (id: string) => ReactNode }) {
  const genere = useId();
  const id = idImpose ?? genere;
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

function FormulaireClient({ client, reglages, onFermer }: { client: Client | null; reglages: ReglagesDocuments; onFermer: () => void }) {
  const enregistrer = useEnregistrerClient(client?.id);
  const { valeurs, erreurs, changer, valider } = useFormulaire(saisieDepuis(client));
  const [cle, setCle] = useState(() => cleDelai(valeurs.delai_paiement_jours, valeurs.delai_paiement_mode));
  // Vrai tant que le délai affiché a été posé POUR l'utilisateur (défaut, type de client) : le seul qu'un changement de type peut reprendre.
  const [delaiPosePourVous, setDelaiPosePourVous] = useState(true);
  const sections = sectionsEfactureVisibles(valeurs.cadre_facturation as Client["cadre_facturation"]);
  const immatriculation = sections.includes("immatriculation");
  const adresseProposee = adresseElectroniqueParDefaut(valeurs);
  // Les services publics ne s'interrogent que sur une saisie de l'utilisateur, jamais à l'ouverture d'une fiche.
  const [nomTape, setNomTape] = useState(false);
  const [adresseTapee, setAdresseTapee] = useState(false);
  const [cadrePropose, setCadrePropose] = useState<{ cadre: string; motif: string } | null>(null);
  const [etabChoisi, setEtabChoisi] = useState<EtablissementTrouve | null>(null);
  const idSiret = useId();
  const ref = useRef<HTMLFormElement>(null);
  // L'ancien faisait défiler jusqu'au formulaire une fois dessiné : ouvert depuis le bas d'une longue liste, on le verrait sinon à peine.
  useEffect(() => ref.current?.scrollIntoView?.({ block: "start" }), []);
  const manques = completudeClient({
    nom: valeurs.nom, adresse: valeurs.adresse, codePostal: valeurs.code_postal, ville: valeurs.ville, siret: valeurs.siret,
    tvaIntracom: valeurs.tva_intracom, adresseElectroniqueValeur: valeurs.adresse_electronique_valeur || adresseProposee?.valeur,
    codeService: valeurs.code_service, referenceEngagement: valeurs.reference_engagement, cadreFacturation: valeurs.cadre_facturation,
  });

  const texte = (nom: keyof Valeurs) => ({ value: valeurs[nom], onChange: (e: { target: { value: string } }) => changer(nom, e.target.value) });

  function choisirCle(c: string, parLUtilisateur: boolean) {
    setCle(c);
    if (parLUtilisateur) setDelaiPosePourVous(false);
    if (c === CLE_SOCIETE) {
      changer("delai_paiement_jours", "");
      changer("delai_paiement_mode", "net");
    } else if (c !== CLE_AUTRE) {
      const p = DELAIS_PREREGLES.find((d) => d.cle === c);
      if (p) {
        changer("delai_paiement_jours", String(p.jours));
        changer("delai_paiement_mode", p.mode);
      }
    }
  }

  /** `appliquerDelaiDuCadre` : ne reprend que le délai que personne n'a choisi. */
  function changerCadre(cadre: string) {
    changer("cadre_facturation", cadre);
    setCadrePropose(null);
    const voulu = CLE_DELAI_PAR_CADRE[cadre] ?? CLE_SOCIETE;
    if ((cle === CLE_SOCIETE || delaiPosePourVous) && cle !== voulu) {
      choisirCle(voulu, false);
      setDelaiPosePourVous(voulu !== CLE_SOCIETE);
    }
  }

  function calculerTva() {
    const tva = tvaIntracomFr(chiffres(valeurs.siren) || sirenDuSiret(valeurs.siret) || "");
    if (!tva) return afficherToast("Renseignez d'abord un SIRET ou un SIREN.");
    changer("tva_intracom", tva);
  }

  /** Un établissement choisi dans l'annuaire (CLI-23) : l'identité s'écrase, TVA et adresse électronique ne remplissent que le vide. */
  function choisirEtablissement(etab: EtablissementTrouve) {
    const actuels: ChampsAnnuaire = {
      nom: valeurs.nom, siret: valeurs.siret, siren: valeurs.siren, adresse: valeurs.adresse, code_postal: valeurs.code_postal, ville: valeurs.ville,
      tva_intracom: valeurs.tva_intracom, adresse_electronique_valeur: valeurs.adresse_electronique_valeur, adresse_electronique_schema: valeurs.adresse_electronique_schema,
    };
    for (const [c, v] of Object.entries(appliquerEtablissement(actuels, etab))) changer(c as keyof ChampsAnnuaire, v);
    setNomTape(false);
    setAdresseTapee(false);
    // Une entreprise radiée avertit, même choisie sous le nom (D-CLI-02) : l'ancien ne le disait qu'après « Rechercher ».
    setEtabChoisi(etab);
    // « Acheteur public » : seulement PROPOSÉ — le type de client reste le choix de l'utilisateur.
    const s = cadreSuggere({ paysCode: valeurs.pays_code, natureJuridique: etab.formeJuridique });
    setCadrePropose(s && s.cadre !== valeurs.cadre_facturation ? s : null);
  }

  function soumettre(e: FormEvent) {
    e.preventDefault();
    // Les refus de l'ancien se disent par la boîte du navigateur : le nom d'abord, puis ce qui est MAL FORMÉ.
    if (!valeurs.nom.trim()) return window.alert("Le nom du client est requis.");
    const essai = schemaSaisieClient.safeParse(valeurs);
    if (!essai.success) window.alert([...new Set(Object.values(erreursParChamp(essai.error)))].join("\n"));
    const lue = valider(schemaSaisieClient);
    if (!lue) return;
    // L'adresse de routage se déduit du SIRET : proposée, et gardée si l'utilisateur n'en a pas dicté une autre.
    const deduite = sections.includes("efacture") && !lue.adresse_electronique_valeur && adresseProposee;
    const saisie = deduite
      ? { ...lue, adresse_electronique_valeur: adresseProposee.valeur, adresse_electronique_schema: lue.adresse_electronique_schema ?? adresseProposee.schema }
      : lue;
    enregistrer.mutate(saisie, { onSuccess: onFermer, onError: (err) => afficherToast(messageErreur(err)) });
  }

  const libelleCadrePropose = cadrePropose && CADRES_FACTURATION.find((c) => c.code === cadrePropose.cadre)?.libelle;

  return (
    <form ref={ref} className="form-panel" onSubmit={soumettre} noValidate aria-label={client ? "Modifier le client" : "Nouveau client"}>
      <h3>{client ? "Modifier le client" : "Nouveau client"}</h3>

      <div className="field-grid">
        <Champ libelle="Type de client" full>
          {(id) => (
            <>
              <select id={id} value={valeurs.cadre_facturation} onChange={(e) => changerCadre(e.target.value)}>
                {CADRES_FACTURATION.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.libelle}
                  </option>
                ))}
              </select>
              <small style={PETIT}>{AIDE_CADRE[valeurs.cadre_facturation] ?? ""}</small>
              <small style={{ color: "#B85C00", fontSize: "11px", fontWeight: 600 }}>
                {cadrePropose && (
                  <>
                    {cadrePropose.motif} Type suggéré : {libelleCadrePropose}.{" "}
                    <button type="button" className="btn small" onClick={() => changerCadre(cadrePropose.cadre)}>
                      Appliquer ce type
                    </button>
                  </>
                )}
              </small>
            </>
          )}
        </Champ>

        <Champ libelle="Nom / raison sociale" style={{ position: "relative" }} erreur={erreurs.nom}>
          {(id) => (
            <>
              <input
                type="text"
                id={id}
                value={valeurs.nom}
                autoComplete="off"
                placeholder={immatriculation ? "Ex : syndic, bailleur social, société…" : "Ex : M. et Mme Dupont"}
                onChange={(e) => {
                  changer("nom", e.target.value);
                  setNomTape(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setNomTape(false);
                    e.currentTarget.blur();
                  }
                }}
                onBlur={() => setNomTape(false)}
              />
              {/* Un particulier n'a rien à trouver dans l'annuaire des entreprises (CLI-40). */}
              <SuggestionsEntreprise saisie={valeurs.nom} actif={nomTape && immatriculation} onChoisir={choisirEtablissement} />
            </>
          )}
        </Champ>
        <Champ libelle="Téléphone">{(id) => <input type="tel" id={id} {...texte("telephone")} />}</Champ>
        <Champ libelle="Email" erreur={erreurs.email}>
          {(id) => <input type="email" id={id} placeholder="contact@client.fr" aria-invalid={!!erreurs.email} {...texte("email")} />}
        </Champ>
      </div>

      {immatriculation && (
        <div className="field-grid">
          <ChampSiret id={idSiret} valeur={valeurs.siret} onChange={(v) => changer("siret", v)} rempli={etabChoisi} onChoisir={choisirEtablissement} onEffacer={() => setEtabChoisi(null)} />
          {erreurs.siret && (
            <small role="alert" className="champ-erreur field full">
              {erreurs.siret}
            </small>
          )}
          <Champ libelle="SIREN" erreur={erreurs.siren}>
            {(id) => <input type="text" id={id} placeholder="9 chiffres" inputMode="numeric" aria-invalid={!!erreurs.siren} {...texte("siren")} />}
          </Champ>
          <div className="field">
            <label htmlFor={`${idSiret}-tva`}>N° de TVA intracommunautaire</label>
            <div style={{ display: "flex", gap: "6px" }}>
              <input type="text" id={`${idSiret}-tva`} placeholder="FR…" style={{ flex: 1 }} aria-invalid={!!erreurs.tva_intracom} {...texte("tva_intracom")} />
              <button type="button" className="btn small" onClick={calculerTva} title="Calculer depuis le SIREN" aria-label="Calculer depuis le SIREN">
                ∑
              </button>
            </div>
            {erreurs.tva_intracom && (
              <small role="alert" className="champ-erreur">
                {erreurs.tva_intracom}
              </small>
            )}
          </div>
        </div>
      )}

      <div className="field-grid">
        <Champ libelle="Adresse" full style={{ position: "relative" }}>
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
        <Champ libelle="Code postal">{(id) => <input type="text" id={id} {...texte("code_postal")} />}</Champ>
        <Champ libelle="Ville">{(id) => <input type="text" id={id} {...texte("ville")} />}</Champ>
        <VillesProposees codePostal={valeurs.code_postal} ville={valeurs.ville} onChoisir={(v) => changer("ville", v)} />
        {sections.includes("pays") && (
          <Champ libelle="Pays" erreur={erreurs.pays_code}>
            {(id) => <input type="text" id={id} maxLength={2} placeholder="FR" {...texte("pays_code")} />}
          </Champ>
        )}
      </div>

      {sections.includes("efacture") && (
        <div className="field-grid">
          <div className="field full section-title" style={TITRE_SECTION}>
            📧 Facture électronique
          </div>
          <Champ libelle="Schéma de l'adresse">
            {(id) => (
              <select id={id} {...texte("adresse_electronique_schema")}>
                <option value="">—</option>
                {SCHEMAS_ADRESSE_ELECTRONIQUE.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.libelle}
                  </option>
                ))}
              </select>
            )}
          </Champ>
          <Champ libelle="Adresse électronique">{(id) => <input type="text" id={id} placeholder="déduite du SIRET" {...texte("adresse_electronique_valeur")} />}</Champ>
          <Champ libelle="Code de routage">{(id) => <input type="text" id={id} placeholder="facultatif" {...texte("code_routage")} />}</Champ>
          <Champ libelle="Référence acheteur">{(id) => <input type="text" id={id} placeholder="réf. interne exigée par le client" {...texte("reference_acheteur")} />}</Champ>
          <div className="field full">
            <small style={PETIT}>L'adresse électronique se déduit du SIRET. Ne la modifiez que si votre client vous en a communiqué une autre.</small>
          </div>
        </div>
      )}

      {sections.includes("marche") && (
        <div className="field-grid">
          <div className="field full section-title" style={TITRE_SECTION}>
            🏛 Marché public
          </div>
          <Champ libelle="Code service exécutant">{(id) => <input type="text" id={id} {...texte("code_service")} />}</Champ>
          <Champ libelle="N° d'engagement">{(id) => <input type="text" id={id} {...texte("reference_engagement")} />}</Champ>
          <Champ libelle="N° de marché">{(id) => <input type="text" id={id} {...texte("numero_marche")} />}</Champ>
        </div>
      )}

      <ChampsDelai
        jours={valeurs.delai_paiement_jours}
        mode={valeurs.delai_paiement_mode}
        modePaiement={valeurs.mode_paiement}
        cle={cle}
        onCle={choisirCle}
        reglages={reglages}
        erreurJours={erreurs.delai_paiement_jours}
        onChange={(c, v) => changer(c, v)}
      />

      <details style={{ marginTop: "12px" }}>
        <summary style={RESUME}>Adresses de facturation et de livraison différentes</summary>
        <div className="field-grid" style={{ marginTop: "8px" }}>
          <Champ libelle="Adresse de facturation" full>{(id) => <input type="text" id={id} {...texte("facturation_adresse")} />}</Champ>
          <Champ libelle="Code postal">{(id) => <input type="text" id={id} {...texte("facturation_code_postal")} />}</Champ>
          <Champ libelle="Ville">{(id) => <input type="text" id={id} {...texte("facturation_ville")} />}</Champ>
          <Champ libelle="Adresse de livraison" full>{(id) => <input type="text" id={id} {...texte("livraison_adresse")} />}</Champ>
          <Champ libelle="Code postal">{(id) => <input type="text" id={id} {...texte("livraison_code_postal")} />}</Champ>
          <Champ libelle="Ville">{(id) => <input type="text" id={id} {...texte("livraison_ville")} />}</Champ>
        </div>
      </details>

      <details style={{ marginTop: "8px" }}>
        <summary style={RESUME}>Service comptabilité</summary>
        <div className="field-grid" style={{ marginTop: "8px" }}>
          <Champ libelle="Nom">{(id) => <input type="text" id={id} {...texte("contact_nom")} />}</Champ>
          <Champ libelle="Email" erreur={erreurs.contact_email}>{(id) => <input type="email" id={id} {...texte("contact_email")} />}</Champ>
          <Champ libelle="Téléphone">{(id) => <input type="tel" id={id} {...texte("contact_telephone")} />}</Champ>
          <div className="field full">
            <small style={PETIT}>Destinataire des factures. Les interlocuteurs restent l'annuaire opérationnel du chantier.</small>
          </div>
        </div>
      </details>

      <div className="field-grid" style={{ marginTop: "8px" }}>
        <Champ libelle="Notes" full>{(id) => <input type="text" id={id} {...texte("notes")} />}</Champ>
      </div>

      <div className="field full" style={{ marginTop: "-6px", display: immatriculation ? undefined : "none" }}>
        <small style={PETIT}>
          Tapez un nom (3 lettres min.), un SIREN (9 chiffres) ou un SIRET (14) : nom officiel, adresse, SIREN et n° de TVA sont renseignés automatiquement. Les établissements fermés sont signalés.
        </small>
      </div>
      {/* Informatif, jamais bloquant : ce qui manquera le jour d'émettre (CLI-05). */}
      <div style={{ marginTop: "8px" }} aria-live="polite">
        {manques.length ? (
          <div className="wf-banner alerte">{phraseManques(manques)}</div>
        ) : (
          <div className="wf-banner ok">✓ Cette fiche est complète pour la facture électronique.</div>
        )}
      </div>
      <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
        <button type="submit" className="btn primary" disabled={enregistrer.isPending}>
          Enregistrer
        </button>
        <button type="button" className="btn ghost" onClick={onFermer}>
          Annuler
        </button>
      </div>
    </form>
  );
}
