import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Td, Tr } from "@/components/ui/table";
import { formatEuros, formatTaux, montant } from "@/lib/money";
import type { ErreurLigne, LigneEdition } from "../domain/lignes";
import type { ChampReferenceLigne } from "./reference";
import { montantLigneHt, montantLigneTtc } from "../domain/totaux";

interface Props {
  ligne: LigneEdition;
  index: number;
  nombre: number;
  unites: readonly string[];
  taux: readonly number[];
  erreurs: readonly ErreurLigne[];
  lectureSeule: boolean;
  onChange: (champ: keyof LigneEdition, valeur: string) => void;
  onRemplacer: (ligne: LigneEdition) => void;
  ChampReference?: ChampReferenceLigne | undefined;
  /** Métier d'un chapitre (bons de commande), branché par le module qui connaît les métiers. */
  ChampMetier?: ChampReferenceLigne | undefined;
  onAction: (action: "monter" | "descendre" | "dupliquer" | "retirer") => void;
}

const versLigne = (l: LigneEdition) => ({ type: l.type, quantite: l.quantite, prix_unitaire: l.prix_unitaire, tva: l.tva });

export function LigneEditable({ ligne, index, nombre, unites, taux, erreurs, lectureSeule, onChange, onRemplacer, ChampReference, ChampMetier, onAction }: Props) {
  const n = index + 1;
  const erreur = (champ: ErreurLigne["champ"]) => erreurs.find((e) => e.index === index && e.champ === champ)?.message;
  const invalide = (champ: ErreurLigne["champ"]) => (erreur(champ) ? { "aria-invalid": true, title: erreur(champ) } : {});

  const actions = !lectureSeule && (
    <Td className="whitespace-nowrap text-right">
      <Button variant="ghost" size="icon" aria-label={`Monter la ligne ${n}`} disabled={index === 0} onClick={() => onAction("monter")}>↑</Button>
      <Button variant="ghost" size="icon" aria-label={`Descendre la ligne ${n}`} disabled={index === nombre - 1} onClick={() => onAction("descendre")}>↓</Button>
      <Button variant="ghost" size="icon" aria-label={`Dupliquer la ligne ${n}`} onClick={() => onAction("dupliquer")}>⧉</Button>
      <Button variant="ghost" size="icon" aria-label={`Retirer la ligne ${n}`} onClick={() => onAction("retirer")}>✕</Button>
    </Td>
  );

  if (ligne.type !== "ligne") {
    return (
      <Tr className={ligne.type === "chapitre" ? "bg-muted/60" : ""}>
        <Td colSpan={7}>
          <Input
            aria-label={ligne.type === "chapitre" ? `Titre du chapitre, ligne ${n}` : `Commentaire, ligne ${n}`}
            className={ligne.type === "chapitre" ? "font-semibold" : "italic"}
            value={ligne.designation}
            readOnly={lectureSeule}
            onChange={(e) => onChange("designation", e.target.value)}
            {...invalide("designation")}
          />
          {ligne.type === "chapitre" && ChampMetier && <ChampMetier ligne={ligne} index={index} remplacer={onRemplacer} desactive={lectureSeule} />}
        </Td>
        {actions}
      </Tr>
    );
  }

  // Un taux enregistré qui n'est plus dans la liste des réglages reste proposé.
  const tauxProposes = [...new Set([...taux, Number(montant(ligne.tva))])].sort((a, b) => a - b);
  const unitesProposees = ligne.unite && !unites.includes(ligne.unite) ? [...unites, ligne.unite] : unites;

  return (
    <Tr>
      <Td className="min-w-48">
        {ChampReference && <ChampReference ligne={ligne} index={index} remplacer={onRemplacer} desactive={lectureSeule} />}
        <Input aria-label={`Désignation, ligne ${n}`} value={ligne.designation} readOnly={lectureSeule} onChange={(e) => onChange("designation", e.target.value)} {...invalide("designation")} />
        {!ChampReference && ligne.article_reference && <span className="text-xs text-muted-foreground">Réf. {ligne.article_reference}</span>}
      </Td>
      <Td className="w-20">
        <Input aria-label={`Quantité, ligne ${n}`} inputMode="decimal" className="text-right" value={ligne.quantite} readOnly={lectureSeule} onChange={(e) => onChange("quantite", e.target.value)} {...invalide("quantite")} />
      </Td>
      <Td className="w-24">
        <Select aria-label={`Unité, ligne ${n}`} value={ligne.unite} disabled={lectureSeule} onChange={(e) => onChange("unite", e.target.value)}>
          <option value="">—</option>
          {unitesProposees.map((u) => <option key={u}>{u}</option>)}
        </Select>
      </Td>
      <Td className="w-28">
        <Input aria-label={`Prix unitaire HT, ligne ${n}`} inputMode="decimal" className="text-right" value={ligne.prix_unitaire} readOnly={lectureSeule} onChange={(e) => onChange("prix_unitaire", e.target.value)} {...invalide("prix_unitaire")} />
      </Td>
      <Td className="w-24">
        <Select aria-label={`TVA, ligne ${n}`} value={String(Number(montant(ligne.tva)))} disabled={lectureSeule} onChange={(e) => onChange("tva", e.target.value.replace(".", ","))}>
          {tauxProposes.map((t) => <option key={t} value={String(t)}>{formatTaux(montant(t))}</option>)}
        </Select>
      </Td>
      <Td className="text-right tabular-nums">{formatEuros(montantLigneHt(versLigne(ligne)))}</Td>
      <Td className="text-right tabular-nums text-muted-foreground">{formatEuros(montantLigneTtc(versLigne(ligne)))}</Td>
      {actions}
    </Tr>
  );
}
