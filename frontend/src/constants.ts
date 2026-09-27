import type { InvoiceItem, InvoiceStatus } from './types'

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Borrador',
  sent: 'Emitida',
  paid: 'Pagada',
  cancelled: 'Anulada',
}

/** Tipos de IVA vigentes en España: general, reducido, superreducido y exento. */
export const VAT_RATES = ['21', '10', '4', '0'] as const

/** Retenciones de IRPF habituales: ninguna, nuevos autónomos, general y alquileres. */
export const WITHHOLDING_RATES = ['0', '7', '15', '19'] as const

export const emptyItem = (): InvoiceItem => ({
  description: '',
  quantity: '1',
  unit_price: '',
  tax_rate: VAT_RATES[0],
})
