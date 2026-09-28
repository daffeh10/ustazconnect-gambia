/** Supabase caps returned rows; financial totals must include every page. */
export async function readAllRows<T>(query: (start: number, end: number) => PromiseLike<{
  data: T[] | null
  error: { message: string } | null
}>) {
  try {
    const rows: T[] = []
    for (let start = 0; ; start += 500) {
      const result = await query(start, start + 499)
      if (result.error) throw new Error(result.error.message)
      const page = result.data || []
      rows.push(...page)
      if (page.length < 500) return { data: rows, error: null }
    }
  } catch (error) { throw error }
}
