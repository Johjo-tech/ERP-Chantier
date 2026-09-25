import { useSession } from "@/modules/auth-roles/hooks/useSession";
import { genreDuTableau } from "../domain/pilotage";
import { TableauConducteur } from "./TableauConducteur";
import { TableauPilotage } from "./TableauPilotage";
import { TableauTerrain } from "./TableauTerrain";

/** Le RÔLE EFFECTIF décide : « voir en tant que » montre bien l'écran du rôle simulé. */
export function TableauDeBord() {
  const { etat, roleEffectif } = useSession();
  const nom = etat.statut === "connecte" ? etat.session.utilisateur.nom : "";
  const genre = genreDuTableau(roleEffectif);
  if (genre === "terrain") return <TableauTerrain nom={nom} />;
  if (genre === "conducteur") return <TableauConducteur nom={nom} />;
  return <TableauPilotage nom={nom} />;
}
