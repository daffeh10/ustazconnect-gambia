export function toSeoSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function findBySeoSlug(values: string[], slug: string) {
  return values.find((value) => toSeoSlug(value) === slug) || null
}
