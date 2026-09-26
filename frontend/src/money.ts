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

export function computeTotals(items: InvoiceItem[], taxRate: string) {
  const subtotal = items.reduce((sum, item) => sum + lineCents(item), 0)
  const rate = Number(taxRate.replace(',', '.')) || 0
  const tax = roundHalfUp((subtotal * rate) / 100)
  return { subtotal, tax, total: subtotal + tax }
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
