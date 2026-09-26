import type { InvoiceItem, InvoiceStatus } from './types'

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Borrador',
  sent: 'Emitida',
  paid: 'Pagada',
  cancelled: 'Anulada',
}

export const emptyItem = (): InvoiceItem => ({ description: '', quantity: '1', unit_price: '' })
