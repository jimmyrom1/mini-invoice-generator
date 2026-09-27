import type { InvoiceItem } from './types'

/**
 * Vista previa de totales en el navegador. El backend es la fuente de verdad;
 * aquí se replica su redondeo (half-up a céntimos) trabajando en enteros.
 */
function toCents(value: string): number {
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

function roundHalfUp(n: number): number {
  return Math.sign(n) * Math.round(Math.abs(n) + 1e-9)
}

export function lineCents(item: Pick<InvoiceItem, 'quantity' | 'unit_price'>): number {
  const qty = Number(item.quantity.replace(',', '.'))
  if (!Number.isFinite(qty)) return 0
  return roundHalfUp(qty * toCents(item.unit_price))
}

const parseRate = (value: string) => Number(value.replace(',', '.')) || 0

export interface TaxLineCents {
  rate: number
  base: number
  amount: number
}

/**
 * Igual que Invoice.tax_breakdown en el backend: se agrupan las bases por tipo y la cuota se
 * redondea una vez por tipo, no línea a línea.
 */
export function computeTotals(items: InvoiceItem[], withholdingRate = '0') {
  const bases = new Map<number, number>()
  for (const item of items) {
    const rate = parseRate(item.tax_rate)
    bases.set(rate, (bases.get(rate) ?? 0) + lineCents(item))
  }
  const breakdown: TaxLineCents[] = [...bases.entries()]
    .sort(([a], [b]) => b - a)
    .map(([rate, base]) => ({ rate, base, amount: roundHalfUp((base * rate) / 100) }))

  const subtotal = breakdown.reduce((sum, line) => sum + line.base, 0)
  const tax = breakdown.reduce((sum, line) => sum + line.amount, 0)
  const withholding = roundHalfUp((subtotal * parseRate(withholdingRate)) / 100)
  return { subtotal, breakdown, tax, withholding, total: subtotal + tax - withholding }
}

const eurFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  useGrouping: 'always',
})

export function formatCents(cents: number): string {
  return eurFormatter.format(cents / 100)
}

export function formatMoney(value: string | number): string {
  return eurFormatter.format(Number(value))
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
