import { STATUS_LABELS } from '../constants'
import type { InvoiceStatus } from '../types'

export function StatusBadge({ status, overdue }: { status: InvoiceStatus; overdue?: boolean }) {
  if (overdue) return <span className="badge badge-overdue">Vencida</span>
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>
}
