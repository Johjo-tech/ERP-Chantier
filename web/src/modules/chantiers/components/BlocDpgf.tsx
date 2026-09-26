import { useMemo, useState, type ChangeEvent } from "react";
import { Link } from "react-router";
import { Erreur } from "@/components/etats/Etats";
import { messageErreur } from "@/lib/erreurs";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { afficherToast } from "@/lib/toast";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import type { LigneDpgfBase } from "../api/dpgf";
import type { Chantier } from "../domain/chantier";
import { avancementChantier, estFactureeEntierement, lignesFigees } from "../domain/dpgf";
import { schemaNouvelleLigneDpgf, validerLignesDpgf, type BrouillonLigneDpgf } from "../domain/saisie-dpgf";
import { useAjouterLigneDpgf, useDpgf, useEnregistrerLignesDpgf, useSupprimerLigneDpgf, useTachesPlanifiees } from "../hooks/useChantiers";
import { useDevisAvecLignes, useMetiers } from "../hooks/useFiche";
import { DialoguePlanifier } from "./DialoguePlanifier";
import { ImportDpgf } from "./ImportDpgf";
import { RepriseDevis } from "./RepriseDevis";
import { TableDpgf, type LigneAffichee } from "./TableDpgf";

interface Props {
  chantier: Chantier;
  fichierAImporter: File | null;
  importer: (f: File | null) => void;
}

// Le point du nombre : les champs sont des `type="number"`, comme l'ancien (alignés à droite par la feuille).
const enTexte = (n: number) => String(n);
const depuisServeur = (l: LigneDpgfBase, figee: boolean): BrouillonLigneDpgf => ({
  id: l.id,
  type: l.type,
  designation: l.designation,
  quantite: enTexte(l.quantite),
  prix_unitaire: enTexte(l.prix_unitaire),
  metier: l.metier ?? "",
  figee,
});

/** Les lignes ajoutées par « + Ligne » / « + Chapitre » n'ont pas d'identifiant de base : un préfixe les distingue. */
const PREFIXE_NOUVELLE = "nouvelle-";
const MESSAGE_SANS_SELECTION = "Cochez d'abord au moins une ligne à facturer dans le tableau ci-dessus.";

/**
 * « 📈 DPGF chiffré — suivi d'avancement » (`chantierDpgfLignesHTML`, CHA-06 à
 * CHA-09) : replier, importer un fichier, modifier en place, « + Ligne »,
 * « + Chapitre », « Enregistrer les lignes », « Facturer la sélection », totaux.
 * Comme l'ancien, rien ne part en base avant « Enregistrer les lignes » — ajouts
 * et retraits compris ; mais les saisies en cours survivent à un ajout (CHA-53).
 */
export function BlocDpgf({ chantier, fichierAImporter, importer }: Props) {
  useModeDiscret();
  const dpgf = useDpgf(chantier.id);
  const taches = useTachesPlanifiees(chantier.id);
  const metiers = useMetiers();
  const devis = useDevisAvecLignes(chantier.id);
  const enregistrer = useEnregistrerLignesDpgf(chantier.id);
  const ajouter = useAjouterLigneDpgf(chantier.id);
  const supprimer = useSupprimerLigneDpgf(chantier.id);
  const factureCree = usePermission("factures", "creer");
  const [replie, setReplie] = useState(false);
  const [modifiees, setModifiees] = useState<Record<string, BrouillonLigneDpgf>>({});
  const [nouvelles, setNouvelles] = useState<BrouillonLigneDpgf[]>([]);
  const [retirees, setRetirees] = useState<Set<string>>(new Set());
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [aPlanifier, setAPlanifier] = useState<LigneDpgfBase | null>(null);
  const [enCours, setEnCours] = useState(false);
  const figees = useMemo(() => lignesFigees(dpgf.data ?? [], taches.data ?? []), [dpgf.data, taches.data]);
  const devisSource = useMemo(() => new Map((devis.data ?? []).map((d) => [d.id, d.numero ?? "brouillon"])), [devis.data]);

  const enBase = (dpgf.data ?? []).filter((l) => !retirees.has(l.id));
  const a = avancementChantier(enBase);
  const affichees: LigneAffichee[] = [
    ...enBase.map((l) => ({ brouillon: modifiees[l.id] ?? depuisServeur(l, figees.has(l.id)), enBase: l })),
    ...nouvelles.map((b) => ({ brouillon: b, enBase: null })),
  ];
  const selectionnees = enBase.filter((l) => selection.has(l.id) && !estFactureeEntierement(l)).map((l) => l.id);

  function changer(id: string, champ: "designation" | "quantite" | "prix_unitaire" | "metier", valeur: string) {
    if (id.startsWith(PREFIXE_NOUVELLE)) return setNouvelles((ns) => ns.map((n) => (n.id === id ? { ...n, [champ]: valeur } : n)));
    const l = enBase.find((x) => x.id === id);
    if (l) setModifiees((m) => ({ ...m, [id]: { ...(m[id] ?? depuisServeur(l, figees.has(id))), [champ]: valeur } }));
  }
  function ajouterBrouillon(type: "ligne" | "chapitre") {
    const id = `${PREFIXE_NOUVELLE}${Date.now()}-${nouvelles.length}`;
    setNouvelles((ns) => [...ns, { id, type, designation: "", quantite: type === "ligne" ? "1" : "0", prix_unitaire: "0", metier: "", figee: false }]);
  }
  function retirer(id: string) {
    if (id.startsWith(PREFIXE_NOUVELLE)) return setNouvelles((ns) => ns.filter((n) => n.id !== id));
    setRetirees((r) => new Set(r).add(id));
    setSelection((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  }
  function basculer(id: string) {
    setSelection((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  /** Valide tout avant d'écrire quoi que ce soit : une erreur désigne sa ligne, et rien n'est parti. */
  function preparer() {
    const existantes = validerLignesDpgf(Object.values(modifiees).filter((m) => !retirees.has(m.id)));
    const erreursNouvelles: Record<string, string> = {};
    const aInserer = nouvelles.flatMap((n) => {
      const r = schemaNouvelleLigneDpgf.safeParse({ type: n.type === "chapitre" ? "chapitre" : "ligne", designation: n.designation, quantite: n.quantite, prix_unitaire: n.prix_unitaire, unite: "" });
      if (r.success) return [{ ...r.data, metier: n.metier || null }];
      for (const i of r.error.issues) erreursNouvelles[`${n.id}.${String(i.path[0] ?? "designation")}`] = i.message;
      return [];
    });
    const tout = { ...(existantes.ok ? {} : existantes.erreurs), ...erreursNouvelles };
    return { ok: Object.keys(tout).length === 0, erreurs: tout, existantes: existantes.ok ? existantes.lignes : [], aInserer };
  }

  async function toutEnregistrer() {
    const p = preparer();
    setErreurs(p.erreurs);
    if (!p.ok) return afficherToast(Object.values(p.erreurs)[0] ?? "Lignes invalides.");
    setEnCours(true);
    try {
      for (const id of retirees) await supprimer.mutateAsync(id);
      if (p.existantes.length) await enregistrer.mutateAsync(p.existantes);
      const depuis = (dpgf.data ?? []).reduce((max, l) => Math.max(max, l.position), -1) + 1;
      for (const [i, l] of p.aInserer.entries()) await ajouter.mutateAsync({ position: depuis + i, ligne: l });
      setModifiees({});
      setNouvelles([]);
      setRetirees(new Set());
      afficherToast("Lignes DPGF enregistrées.", "success");
    } catch (err) {
      console.error("Enregistrement du DPGF refusé :", err);
      afficherToast(messageErreur(err));
    } finally {
      setEnCours(false);
    }
  }

  function demanderPlanification(id: string) {
    const l = enBase.find((x) => x.id === id);
    if (!l) return;
    // Le bon reprend le métier ENREGISTRÉ : une saisie en attente doit d'abord partir.
    if (modifiees[id]) return afficherToast("Enregistrez d'abord les modifications de cette ligne.");
    if (!l.metier) return afficherToast("Choisissez d'abord un métier pour cette ligne avant de la planifier.");
    setAPlanifier(l);
  }

  return (
    <div className="chantier-section" style={{ gridColumn: "1/-1" }}>
      <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            className="btn small dpgf-toggle-btn"
            title={replie ? "Déplier" : "Replier"}
            aria-expanded={!replie}
            aria-controls={`dpgfCollapsibleBody_${chantier.id}`}
            onClick={() => setReplie(!replie)}
          >
            {replie ? "+" : "−"}
          </button>
          📈 DPGF chiffré — suivi d'avancement
        </span>
        {replie ? (
          <span className="card-sub">
            {enBase.filter((l) => l.type === "ligne").length} ligne(s) — {formatEurosEcran(a.total)} HT
          </span>
        ) : (
          <span className="card-sub">Cochez les lignes à facturer, puis validez ci-dessous</span>
        )}
      </div>
      <div id={`dpgfCollapsibleBody_${chantier.id}`} style={replie ? { display: "none" } : undefined}>
        <div className="dpgf-import-banner">
          <div>
            <strong>Importer un DPGF existant</strong>
            <div className="card-sub">Fichier Excel (.xlsx) ou CSV — les lignes sont extraites automatiquement</div>
          </div>
          <label className="btn primary" style={{ cursor: "pointer" }}>
            📥 Analyser un fichier
            <input
              type="file"
              className="sr-only"
              accept=".xlsx,.xls,.csv"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const f = e.target.files?.[0] ?? null;
                e.target.value = "";
                importer(f);
              }}
            />
          </label>
        </div>
        <RepriseDevis chantierId={chantier.id} devis={devis.data ?? []} lignes={dpgf.data ?? []} figees={figees} />
        {dpgf.isError && <Erreur erreur={dpgf.error} reessayer={() => void dpgf.refetch()} />}
        {taches.isError && <Erreur erreur={taches.error} reessayer={() => void taches.refetch()} />}
        <TableDpgf
          id={`dpgfLignesTable_${chantier.id}`}
          lignes={affichees}
          changer={changer}
          erreurs={erreurs}
          selection={selection}
          basculer={basculer}
          taches={taches.data ?? []}
          metiers={metiers.data ?? []}
          devisSource={devisSource}
          onPlanifier={demanderPlanification}
          onRetirer={retirer}
        />
        <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
          <button type="button" className="btn small" onClick={() => ajouterBrouillon("ligne")}>
            + Ligne
          </button>
          <button type="button" className="btn small" onClick={() => ajouterBrouillon("chapitre")}>
            + Chapitre
          </button>
          <button type="button" className="btn small primary" disabled={enCours} onClick={() => void toutEnregistrer()}>
            Enregistrer les lignes
          </button>
          {/* La situation de travaux vit dans le module facturation : on y va par son adresse, les lignes cochées en paramètre. */}
          {factureCree &&
            (selectionnees.length ? (
              <Link className="btn small primary" style={{ marginLeft: "auto" }} to={`/chantiers/${chantier.id}/situation?lignes=${selectionnees.join(",")}`}>
                Facturer la sélection
              </Link>
            ) : (
              <button type="button" className="btn small primary" style={{ marginLeft: "auto" }} onClick={() => afficherToast(MESSAGE_SANS_SELECTION)}>
                Facturer la sélection
              </button>
            ))}
        </div>
        <div className="dpgf-totals">
          <div>
            Total DPGF (HT) : <strong>{formatEurosEcran(a.total)}</strong>
          </div>
          <div>
            Déjà facturé : <strong>{formatEurosEcran(a.facture)}</strong>
          </div>
          <div>
            Reste à facturer : <strong>{formatEurosEcran(a.reste)}</strong>
          </div>
        </div>
      </div>
      {fichierAImporter && (
        <ImportDpgf key={`${fichierAImporter.name}-${fichierAImporter.lastModified}`} chantierId={chantier.id} fichier={fichierAImporter} lignes={dpgf.data ?? []} figees={figees} fermer={() => importer(null)} />
      )}
      {aPlanifier && <DialoguePlanifier key={aPlanifier.id} chantier={chantier} ligne={aPlanifier} taches={taches.data ?? []} fermer={() => setAPlanifier(null)} />}
    </div>
  );
}
