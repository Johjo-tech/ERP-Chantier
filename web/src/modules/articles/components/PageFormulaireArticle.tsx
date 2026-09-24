import { type FormEvent } from "react";
import { z } from "zod";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampChoix, ChampTexte, ChampZone } from "@/components/formulaire/Champ";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { messageErreur } from "@/lib/erreurs";
import { formatTaux, montant } from "@/lib/money";
import { useFormulaire } from "@/lib/useFormulaire";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import type { ReglagesDocuments } from "@/modules/societes/domain/reglages";
import { CodeEnDouble } from "../api/articles";
import { schemaSaisieArticle, TYPES_ARTICLE, valeurCase, valeursDepuis, type Article, type ValeursArticle } from "../domain/article";
import { useArticle, useEnregistrerArticle } from "../hooks/useArticles";

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

  if ((id && article.isPending) || reglages.isPending) return <Chargement />;
  if (id && article.isError) return <Erreur erreur={article.error} reessayer={() => void article.refetch()} />;
  if (reglages.isError) return <Erreur erreur={reglages.error} reessayer={() => void reglages.refetch()} />;
  const f = <FormulaireArticle key={id ?? "nouveau"} article={article.data ?? null} reglages={reglages.data} brouillon={brouillon} retour={retour} />;
  return article.data ? <GardeSociete societeId={article.data.societe_id} retour="/articles">{f}</GardeSociete> : f;
}

interface Props {
  article: Article | null;
  reglages: ReglagesDocuments;
  brouillon?: Partial<ValeursArticle> | undefined;
  retour?: string | undefined;
}

function FormulaireArticle({ article, reglages, brouillon, retour }: Props) {
  const navigate = useNavigate();
  const enregistrer = useEnregistrerArticle(article?.id);
  const { valeurs, erreurs, changer, valider } = useFormulaire(valeursDepuis(article, reglages.tvaDefaut, brouillon));
  const doublon = enregistrer.error instanceof CodeEnDouble ? enregistrer.error.message : undefined;

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const saisie = valider(schemaSaisieArticle);
    if (!saisie) return;
    enregistrer.mutate(saisie, { onSuccess: (a) => void navigate(retour ?? "/articles", { state: { articleEnregistre: a } }) });
  }

  // Une valeur enregistrée qui n'est plus dans les réglages reste proposée : l'ouvrir ne doit pas la changer.
  const unites = [...new Set([...reglages.unites, ...(valeurs.unite ? [valeurs.unite] : [])])];
  const taux = [...new Set([...reglages.tauxTva, Number(montant(valeurs.tva))])].sort((a, b) => a - b);
  const champ = (nom: keyof ValeursArticle, libelle: string, extra: Partial<Parameters<typeof ChampTexte>[0]> = {}) => (
    <ChampTexte libelle={libelle} valeur={valeurs[nom]} onChange={(v) => changer(nom, v)} erreur={erreurs[nom]} {...extra} />
  );

  return (
    <form onSubmit={soumettre} noValidate className="flex max-w-3xl flex-col gap-4">
      <EnTetePage titre={article ? `Modifier ${article.code}` : "Nouvel article"} />
      {enregistrer.isError && <Alert variant="erreur">{doublon ?? messageErreur(enregistrer.error)}</Alert>}
      {Object.keys(erreurs).length > 0 && <Alert variant="erreur">Le formulaire contient des erreurs : corrigez les champs signalés.</Alert>}
      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
          {champ("code", "Code article", { requis: true, placeholder: "PLB-001", erreur: erreurs.code ?? doublon })}
          {champ("famille", "Famille")}
          <div className="sm:col-span-2">{champ("designation", "Désignation", { requis: true })}</div>
          <div className="sm:col-span-2">
            <ChampZone
              libelle="Description"
              valeur={valeurs.description}
              onChange={(v) => changer("description", v)}
              aide="Reprise en commentaire de la ligne quand on choisit cet article."
            />
          </div>
          <ChampChoix
            libelle="Type"
            valeur={valeurs.type_article}
            onChange={(v) => changer("type_article", v)}
            options={TYPES_ARTICLE.map((t) => ({ valeur: t.code, libelle: t.libelle }))}
          />
          <ChampChoix
            libelle="Unité"
            valeur={valeurs.unite}
            onChange={(v) => changer("unite", v)}
            options={[{ valeur: "", libelle: "—" }, ...unites.map((u) => ({ valeur: u, libelle: u }))]}
          />
          {champ("prix_unitaire", "Prix de vente HT", { inputMode: "decimal" })}
          {champ("prix_achat", "Prix d'achat HT", { inputMode: "decimal" })}
          <ChampChoix
            libelle="TVA"
            valeur={String(Number(montant(valeurs.tva)))}
            onChange={(v) => changer("tva", v.replace(".", ","))}
            erreur={erreurs.tva}
            options={taux.map((t) => ({ valeur: String(t), libelle: formatTaux(montant(t)) }))}
          />
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={valeurs.gere_en_stock !== ""} onChange={(e) => changer("gere_en_stock", valeurCase(e.target.checked))} />
            Géré en stock
          </label>
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button type="submit" disabled={enregistrer.isPending}>{enregistrer.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
        <Button variant="ghost" asChild>
          <Link to={retour ?? "/articles"}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
