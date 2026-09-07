/** Catalogue d'articles (`articles`). */

import { getOne, insertOne, listBySociete, remove, updateOne } from "../client";
import type { ArticleInsert, ArticleUpdate, Uuid } from "../types";

export function listArticles(societeId: Uuid) {
  return listBySociete("articles", societeId);
}

export function getArticle(id: Uuid) {
  return getOne("articles", id);
}

export function createArticle(
  societeId: Uuid,
  input: Omit<ArticleInsert, "societe_id">
) {
  return insertOne("articles", { ...input, societe_id: societeId });
}

export function updateArticle(id: Uuid, updates: ArticleUpdate) {
  return updateOne("articles", id, updates);
}

export function deleteArticle(id: Uuid) {
  return remove("articles", id);
}
