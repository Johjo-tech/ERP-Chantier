/**
 * Articles CRUD
 */

import { supabase, SupabaseError, uid } from "../client";
import type { Article } from "../types";

export async function getArticle(id: string): Promise<Article | null> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new SupabaseError("Failed to fetch article", error.code, error);
  }

  return data || null;
}

export async function listArticles(societeId: string): Promise<Article[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("societe_id", societeId)
    .order("code", { ascending: true });

  if (error) {
    throw new SupabaseError("Failed to list articles", error.code, error);
  }

  return data || [];
}

export async function searchArticles(
  societeId: string,
  query: string
): Promise<Article[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("societe_id", societeId)
    .or(`code.ilike.%${query}%,designation.ilike.%${query}%`)
    .order("code", { ascending: true });

  if (error) {
    throw new SupabaseError("Failed to search articles", error.code, error);
  }

  return data || [];
}

export async function createArticle(
  societeId: string,
  article: Omit<Article, "id" | "created_at">
): Promise<Article> {
  const newArticle: Omit<Article, "created_at"> = {
    id: uid(),
    societe_id: societeId,
    ...article,
  };

  const { data, error } = await supabase
    .from("articles")
    .insert([newArticle])
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to create article", error.code, error);
  }

  return data;
}

export async function updateArticle(
  id: string,
  updates: Partial<Omit<Article, "id" | "created_at" | "societe_id">>
): Promise<Article> {
  const { data, error } = await supabase
    .from("articles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to update article", error.code, error);
  }

  return data;
}

export async function deleteArticle(id: string): Promise<void> {
  const { error } = await supabase.from("articles").delete().eq("id", id);

  if (error) {
    throw new SupabaseError("Failed to delete article", error.code, error);
  }
}
