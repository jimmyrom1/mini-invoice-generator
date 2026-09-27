import { describe, expect, it } from 'vitest'

import { computeTotals, formatDate, lineCents } from './money'

describe('computeTotals', () => {
  it('matches the backend rounding for a typical invoice', () => {
    const items = [
      { description: 'Consultoría', quantity: '10', unit_price: '50.00', tax_rate: '21' },
      { description: 'Hosting', quantity: '1', unit_price: '19.99', tax_rate: '21' },
    ]
    // Mismo caso que tests/test_invoices.py::test_invoice_totals_are_exact
    expect(computeTotals(items)).toMatchObject({ subtotal: 51999, tax: 10920, withholding: 0, total: 62919 })
  })

  it('rounds half up on fractional quantities', () => {
    expect(lineCents({ quantity: '3', unit_price: '33.33' })).toBe(9999)
    expect(lineCents({ quantity: '0.5', unit_price: '0.05' })).toBe(3) // 2,5 cts → 3
  })

  it('ignores lines that are still being typed', () => {
    const items = [{ description: '', quantity: 'abc', unit_price: '', tax_rate: '21' }]
    expect(computeTotals(items).total).toBe(0)
  })

  it('accepts comma as decimal separator', () => {
    expect(lineCents({ quantity: '1,5', unit_price: '10,00' })).toBe(1500)
  })
})

describe('computeTotals with several VAT rates and IRPF', () => {
  // Mismo caso que test_mixed_vat_rates_are_broken_down_and_rounded_per_rate
  const items = [
    { description: 'Diseño', quantity: '1', unit_price: '100.05', tax_rate: '21' },
    { description: 'Diseño 2', quantity: '1', unit_price: '100.05', tax_rate: '21' },
    { description: 'Libro', quantity: '3', unit_price: '12.35', tax_rate: '4' },
    { description: 'Formación', quantity: '1', unit_price: '80.00', tax_rate: '0' },
  ]

  it('groups the base by rate, highest first', () => {
    expect(computeTotals(items).breakdown).toEqual([
      { rate: 21, base: 20010, amount: 4202 },
      { rate: 4, base: 3705, amount: 148 },
      { rate: 0, base: 8000, amount: 0 },
    ])
    expect(computeTotals(items).total).toBe(36065)
  })

  it('rounds the tax once per rate, not per line', () => {
    const tiny = Array.from({ length: 5 }, () => ({ description: 'x', quantity: '1', unit_price: '0.10', tax_rate: '21' }))
    expect(computeTotals(tiny).tax).toBe(11) // 0,50 × 21 % = 0,105 → 0,11 (no 5 × 0,02)
  })

  it('subtracts the withholding from the total', () => {
    const consulting = [
      { description: 'Consultoría', quantity: '10', unit_price: '50.00', tax_rate: '21' },
      { description: 'Hosting', quantity: '1', unit_price: '19.99', tax_rate: '21' },
    ]
    // Mismo caso que test_withholding_is_subtracted_from_the_total
    expect(computeTotals(consulting, '15')).toMatchObject({ withholding: 7800, total: 55119 })
  })
})

describe('formatDate', () => {
  it('formats ISO dates as dd/mm/yyyy', () => {
    expect(formatDate('2026-03-01')).toBe('01/03/2026')
  })
})
