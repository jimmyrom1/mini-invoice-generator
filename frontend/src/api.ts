import type {
  Client,
  ClientInput,
  Invoice,
  InvoiceInput,
  InvoiceStatus,
  InvoiceSummary,
  Page,
  Stats,
} from './types'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

export class ApiError extends Error {
  status: number
  details?: Record<string, unknown>

  constructor(status: number, message: string, details?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.details = details
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      body.message ?? (res.status === 422 ? 'Revisa los campos marcados.' : 'Error inesperado')
    throw new ApiError(res.status, message, body.details)
  }
  return body as T
}

const json = (method: string, data: unknown): RequestInit => ({
  method,
  body: JSON.stringify(data),
})

export const api = {
  listClients: (q = '') => request<Client[]>(`/clients?q=${encodeURIComponent(q)}`),
  createClient: (data: ClientInput) => request<Client>('/clients', json('POST', data)),
  updateClient: (id: number, data: ClientInput) =>
    request<Client>(`/clients/${id}`, json('PUT', data)),
  deleteClient: (id: number) => request<void>(`/clients/${id}`, { method: 'DELETE' }),

  listInvoices: (params: { status?: string; q?: string; page?: number }) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => v && qs.set(k, String(v)))
    return request<Page<InvoiceSummary>>(`/invoices?${qs}`)
  },
  getInvoice: (id: number) => request<Invoice>(`/invoices/${id}`),
  createInvoice: (data: InvoiceInput) => request<Invoice>('/invoices', json('POST', data)),
  updateInvoice: (id: number, data: InvoiceInput) =>
    request<Invoice>(`/invoices/${id}`, json('PUT', data)),
  deleteInvoice: (id: number) => request<void>(`/invoices/${id}`, { method: 'DELETE' }),
  setStatus: (id: number, status: InvoiceStatus) =>
    request<Invoice>(`/invoices/${id}/status`, json('PATCH', { status })),
  stats: () => request<Stats>('/invoices/stats'),
  pdfUrl: (id: number) => `${BASE}/invoices/${id}/pdf`,
}
