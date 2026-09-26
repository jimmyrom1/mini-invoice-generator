export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled'

export interface Client {
  id: number
  name: string
  email: string
  tax_id: string | null
  address: string | null
  created_at?: string
}

export type ClientInput = Omit<Client, 'id' | 'created_at'>

export interface InvoiceItem {
  id?: number
  description: string
  quantity: string
  unit_price: string
  amount?: string
}

export interface Invoice {
  id: number
  number: string
  client: Client
  issue_date: string
  due_date: string
  status: InvoiceStatus
  is_overdue: boolean
  tax_rate: string
  notes: string | null
  items: InvoiceItem[]
  subtotal: string
  tax_amount: string
  total: string
}

export type InvoiceSummary = Omit<Invoice, 'items' | 'notes'>

export interface InvoiceInput {
  client_id: number
  issue_date: string
  due_date: string | null
  tax_rate: string
  notes: string | null
  items: InvoiceItem[]
}

export interface Page<T> {
  items: T[]
  page: number
  pages: number
  total: number
}

export interface Stats {
  by_status: Record<InvoiceStatus, { count: number; total: string }>
  overdue: { count: number; total: string }
}
