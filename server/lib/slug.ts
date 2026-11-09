export function slugify(input: string): string {
  const s = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
  return s || 'item'
}

/** Returns a slug not yet used, appending -2, -3 … when needed. */
export function uniqueSlug(base: string, exists: (slug: string) => boolean): string {
  let slug = base
  let n = 2
  while (exists(slug)) slug = `${base}-${n++}`
  return slug
}
