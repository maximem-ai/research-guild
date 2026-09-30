import data from "../../content/learn/glossary.json";

export type GlossaryTerm = {
  slug: string; term: string; group: string; aliases: string[]; definition: string; article: string | null;
};

export const GLOSSARY_GROUPS = (data as { groups: { id: string; title: string }[] }).groups;
export const GLOSSARY = (data as { terms: GlossaryTerm[] }).terms;

export function getTerm(slug: string): GlossaryTerm {
  const t = GLOSSARY.find((x) => x.slug === slug);
  if (!t) throw new Error(`Unknown glossary term: ${slug}`);
  return t;
}
