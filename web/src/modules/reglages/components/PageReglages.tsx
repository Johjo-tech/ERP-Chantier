import type { ReactNode } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { peut } from "@/modules/auth-roles/domain/permissions";
import { useSession } from "@/modules/auth-roles/hooks/useSession";
import { SectionComptes } from "@/modules/comptes/components/SectionComptes";
import { rubriqueRetenue, rubriquesVisibles } from "../domain/rubriques";
import { SectionDocuments } from "./SectionDocuments";
import { SectionDocumentsLegaux } from "./SectionDocumentsLegaux";
import { SectionIdentiteVisuelle } from "./SectionIdentiteVisuelle";
import { SectionIntervenants } from "./SectionIntervenants";
import { SectionListes } from "./SectionListes";
import { SectionNotifications } from "./SectionNotifications";
import { SectionNumerotation } from "./SectionNumerotation";
import { SectionOrganisation } from "./SectionOrganisation";
import { SectionSeuils } from "./SectionSeuils";

const SECTIONS: Record<string, () => ReactNode> = {
  organisation: () => <SectionOrganisation />,
  identite: () => <SectionIdentiteVisuelle />,
  legaux: () => <SectionDocumentsLegaux />,
  documents: () => <SectionDocuments />,
  numerotation: () => <SectionNumerotation />,
  listes: () => <SectionListes />,
  intervenants: () => <SectionIntervenants />,
  rh: () => <SectionSeuils domaine="rh" />,
  vehicules: () => <SectionSeuils domaine="vehicules" />,
  conduite: () => <SectionSeuils domaine="conduite" />,
  notifications: () => <SectionNotifications />,
  comptes: () => <SectionComptes />,
};

/** L'écran Réglages : un rail de rubriques (une liste déroulante sur téléphone) et la rubrique ouverte. */
export function PageReglages() {
  const { rubrique: demandee } = useParams();
  const navigate = useNavigate();
  const { etat, roleEffectif } = useSession();
  if (etat.statut !== "connecte") return null;
  const groupes = rubriquesVisibles((m) => peut(etat.session.matrice, roleEffectif, m, "voir"));
  const active = rubriqueRetenue(demandee, groupes);

  return (
    <div className="flex flex-col gap-4">
      <EnTetePage titre="Réglages" />
      <div className="flex flex-col gap-6 md:flex-row">
        <nav aria-label="Rubriques des réglages" className="hidden w-60 shrink-0 flex-col gap-1 md:flex">
          {groupes.map((g) => (
            <div key={g.titre} className="flex flex-col gap-0.5">
              <p className="px-3 pt-2 text-xs font-semibold uppercase text-muted-foreground">{g.titre}</p>
              {g.rubriques.map((r) => (
                <NavLink
                  key={r.id}
                  to={`/reglages/${r.id}`}
                  aria-current={r.id === active?.id ? "page" : undefined}
                  className={cn("rounded-md px-3 py-1.5 text-sm hover:bg-muted", r.id === active?.id && "bg-primary/10 font-medium text-primary")}
                >
                  {r.libelle}
                  <span className="block text-xs font-normal text-muted-foreground">{r.description}</span>
                </NavLink>
              ))}
            </div>
          ))}
          <p className="px-3 pt-2 text-xs font-semibold uppercase text-muted-foreground">Mon compte</p>
          <Link to="/mon-compte" className="rounded-md px-3 py-1.5 text-sm hover:bg-muted">
            Mon nom et mon mot de passe
          </Link>
        </nav>
        <div className="md:hidden">
          <label htmlFor="rubrique-reglages" className="sr-only">
            Rubrique des réglages
          </label>
          <Select id="rubrique-reglages" value={active?.id ?? ""} onChange={(e) => void navigate(`/reglages/${e.target.value}`)}>
            {groupes.map((g) => (
              <optgroup key={g.titre} label={g.titre}>
                {g.rubriques.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.libelle}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <section className="min-w-0 flex-1" aria-label={active?.libelle}>
          {active ? SECTIONS[active.id]?.() : <p className="text-sm text-muted-foreground">Aucune rubrique ne vous est ouverte.</p>}
        </section>
      </div>
    </div>
  );
}
