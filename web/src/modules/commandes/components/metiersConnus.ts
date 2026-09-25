import { createContext } from "react";

/** Les métiers proposés, fournis par le formulaire : l'éditeur de lignes (module documents) ne les connaît pas. */
export const MetiersConnus = createContext<readonly string[]>([]);
