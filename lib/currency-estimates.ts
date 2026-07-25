const FALLBACK_GMD_PER_USD = 70
const FALLBACK_GMD_PER_GBP = 90
const FALLBACK_GMD_PER_EUR = 78

function readRate(key: string, fallback: number) {
  const parsed = Number(process.env[key])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function formatForeignEstimate(gmdAmount: number) {
  const usd = Math.round(gmdAmount / readRate('GMD_PER_USD', FALLBACK_GMD_PER_USD))
  const gbp = Math.round(gmdAmount / readRate('GMD_PER_GBP', FALLBACK_GMD_PER_GBP))
  const eur = Math.round(gmdAmount / readRate('GMD_PER_EUR', FALLBACK_GMD_PER_EUR))

  return `approx. $${usd} / £${gbp} / €${eur}`
}
