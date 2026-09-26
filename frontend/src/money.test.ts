import { describe, expect, it } from 'vitest'

import { computeTotals, formatDate, lineCents } from './money'

describe('computeTotals', () => {
  it('matches the backend rounding for a typical invoice', () => {
    const items = [
      { description: 'Consultoría', quantity: '10', unit_price: '50.00' },
      { description: 'Hosting', quantity: '1', unit_price: '19.99' },
    ]
    // Mismo caso que tests/test_invoices.py::test_invoice_totals_are_exact
    expect(computeTotals(items, '21')).toEqual({ subtotal: 51999, tax: 10920, total: 62919 })
  })

  it('rounds half up on fractional quantities', () => {
    expect(lineCents({ quantity: '3', unit_price: '33.33' })).toBe(9999)
    expect(lineCents({ quantity: '0.5', unit_price: '0.05' })).toBe(3) // 2,5 cts → 3
  })

  it('ignores lines that are still being typed', () => {
    const items = [{ description: '', quantity: 'abc', unit_price: '' }]
    expect(computeTotals(items, '21').total).toBe(0)
  })

  it('accepts comma as decimal separator', () => {
    expect(lineCents({ quantity: '1,5', unit_price: '10,00' })).toBe(1500)
  })
})

describe('formatDate', () => {
  it('formats ISO dates as dd/mm/yyyy', () => {
    expect(formatDate('2026-03-01')).toBe('01/03/2026')
  })
})
