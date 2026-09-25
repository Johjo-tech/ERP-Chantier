import { useId, type FormEvent } from "react";
import { z } from "zod";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { messageErreur } from "@/lib/erreurs";
import { montant } from "@/lib/money";
import { afficherToast as toast } from "@/lib/toast";
import { useFormulaire } from "@/lib/useFormulaire";
import { useUnitesLignes } from "@/modules/documents/hooks/useUnites";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import type { ReglagesDocuments } from "@/modules/societes/domain/reglages";
import { CodeEnDouble } from "../api/articles";
import { schemaSaisieArticle, valeurCase, valeursDepuis, type Article, type ValeursArticle } from "../domain/article";
import { useArticle, useEnregistrerArticle, useFamillesArticles } from "../hooks/useArticles";
import { CadreCatalogue } from "./CadreCatalogue";
import { libelleTaux } from "./taux";

/**
 * Ce qu'un autre écran peut passer en ouvrant la création (ART-10) : une fiche
 * pré-remplie depuis une ligne de document, et où revenir ensuite. Validé : un
 * état de navigation vient de l'historique du navigateur, pas de notre code.
 */
const schemaEtat = z.object({
  brouillon: z.record(z.string(), z.string()).optional(),
  retour: z.string().startsWith("/").optional(),
});

export function PageFormulaireArticle() {
  const { id } = useParams();
  const article = useArticle(id);
  const reglages = useReglages();
  const etat = schemaEtat.safeParse(useLocation().state ?? {});
  const { brouillon, retour } = etat.success ? etat.data : {};

  let contenu;
  if ((id && article.isPending) || reglages.isPending) contenu = <Chargement />;
  else if (id && article.isError) contenu = <Erreur erreur={article.error} reessayer={() => void article.refetch()} />;
  else if (reglages.isError) contenu = <Erreur erreur={reglages.error} reessayer={() => void reglages.refetch()} />;
  else contenu = <FormulaireArticle key={id ?? "nouveau"} article={article.data ?? null} reglages={reglages.data} brouillon={brouillon} retour={retour} />;
  const page = <CadreCatalogue>{contenu}</CadreCatalogue>;
  return article.data ? (
    <GardeSociete societeId={article.data.societe_id} retour="/articles">
      {page}
    </GardeSociete>
  ) : (
    page
  );
}

interface Props {
  article: Article | null;
  reglages: ReglagesDocuments;
  brouillon?: Partial<ValeursArticle> | undefined;
  retour?: string | undefined;
}

/** Un champ de l'ancien formulaire : le libellé PUIS la saisie (libellé flottant de `.field`). */
function Champ({ libelle, full, erreur, children }: { libelle: string; full?: boolean; erreur?: string | undefined; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className={full ? "field full" : "field"}>
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

/** La fiche article de l'ancien (`articleCatalogueFormHTML`), dans `.form-panel`. */
function FormulaireArticle({ article, reglages, brouillon, retour }: Props) {
  const navigate = useNavigate();
  const enregistrer = useEnregistrerArticle(article?.id);
  const familles = useFamillesArticles();
  const { valeurs, erreurs, changer, valider } = useFormulaire(valeursDepuis(article, reglages.tvaDefaut, brouillon));
  const doublon = enregistrer.error instanceof CodeEnDouble ? `Le code « ${valeurs.code} » existe déjà dans le catalogue.` : undefined;
  const idListe = useId();

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const saisie = valider(schemaSaisieArticle);
    if (!saisie) {
      // Le message de l'ancien quand code ou désignation manquent ; les autres erreurs se lisent sous leur champ.
      if (!valeurs.code.trim() || !valeurs.designation.trim()) toast("Le code et la désignation sont requis.");
      return;
    }
    enregistrer.mutate(saisie, {
      onSuccess: (a) => {
        toast("Article enregistré.", "success");
        void navigate(retour ?? "/articles", { state: { articleEnregistre: a } });
      },
      // Comme l'ancien : le refus se dit en bulle ; le doublon se lit en plus sous le code.
      onError: (err) => toast(err instanceof CodeEnDouble ? `Le code « ${saisie.code} » existe déjà dans le catalogue.` : messageErreur(err)),
    });
  }

  // Une valeur enregistrée qui n'est plus dans les réglages reste proposée — en tête, comme l'ancien `uniteOptions`.
  // Les unités d'une ligne (référentiel, sinon la liste de repli) : la fiche propose ce que la ligne proposera.
  const referentiel = useUnitesLignes();
  const unites = valeurs.unite && !referentiel.includes(valeurs.unite) ? [valeurs.unite, ...referentiel] : referentiel;
  const tauxCourant = Number(montant(valeurs.tva));
  const taux = reglages.tauxTva.includes(tauxCourant) ? reglages.tauxTva : [...reglages.tauxTva, tauxCourant].sort((a, b) => a - b);

  return (
    <form onSubmit={soumettre} noValidate className="form-panel" aria-label={article ? "Modifier l'article" : "Nouvel article"}>
      <h3>{article ? "Modifier l'article" : "Nouvel article"}</h3>
      <div className="field-grid">
        <Champ libelle="Code article" erreur={erreurs.code ?? doublon}>
          {(id) => (
            <input id={id} type="text" value={valeurs.code} placeholder="PLB-001" aria-invalid={!!(erreurs.code ?? doublon)} onChange={(e) => changer("code", e.target.value)} />
          )}
        </Champ>
        <Champ libelle="Famille">
          {(id) => (
            <>
              <input id={id} type="text" value={valeurs.famille} list={idListe} onChange={(e) => changer("famille", e.target.value)} />
              <datalist id={idListe}>
                {(familles.data ?? []).map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </>
          )}
        </Champ>
        <Champ libelle="Désignation" full erreur={erreurs.designation}>
          {(id) => <input id={id} type="text" value={valeurs.designation} onChange={(e) => changer("designation", e.target.value)} />}
        </Champ>
        <Champ libelle="Description" full>
          {(id) => (
            <>
              <textarea id={id} style={{ minHeight: "70px" }} value={valeurs.description} onChange={(e) => changer("description", e.target.value)} />
              <div className="card-sub">Reprise en commentaire de la ligne quand on choisit cet article.</div>
            </>
          )}
        </Champ>
        <Champ libelle="Type">
          {(id) => (
            <select id={id} value={valeurs.type_article} onChange={(e) => changer("type_article", e.target.value)}>
              <option value="service">Prestation</option>
              <option value="bien">Bien</option>
            </select>
          )}
        </Champ>
        <Champ libelle="Unité">
          {(id) => (
            <select id={id} value={valeurs.unite} onChange={(e) => changer("unite", e.target.value)}>
              {unites.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          )}
        </Champ>
        <Champ libelle="Prix de vente HT" erreur={erreurs.prix_unitaire}>
          {(id) => <input id={id} type="text" inputMode="decimal" value={valeurs.prix_unitaire} onChange={(e) => changer("prix_unitaire", e.target.value)} />}
        </Champ>
        <Champ libelle="Prix d'achat" erreur={erreurs.prix_achat}>
          {(id) => <input id={id} type="text" inputMode="decimal" value={valeurs.prix_achat} onChange={(e) => changer("prix_achat", e.target.value)} />}
        </Champ>
        <Champ libelle="TVA" erreur={erreurs.tva}>
          {(id) => (
            <select id={id} value={String(tauxCourant)} onChange={(e) => changer("tva", e.target.value.replace(".", ","))}>
              {taux.map((t) => (
                <option key={t} value={String(t)}>
                  {libelleTaux(t)}
                </option>
              ))}
            </select>
          )}
        </Champ>
        <div className="field">
          <label aria-hidden="true">&nbsp;</label>
          <label className="bc-tache-row" style={{ margin: 0 }}>
            <input type="checkbox" checked={valeurs.gere_en_stock !== ""} onChange={(e) => changer("gere_en_stock", valeurCase(e.target.checked))} />
            <span>Géré en stock</span>
          </label>
        </div>
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <button type="submit" className="btn primary" disabled={enregistrer.isPending}>
          Enregistrer
        </button>
        <Link className="btn ghost" to={retour ?? "/articles"}>
          Annuler
        </Link>
      </div>
    </form>
  );
}
