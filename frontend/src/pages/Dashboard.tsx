import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { api } from '../api'
import { StatusBadge } from '../components/StatusBadge'
import { STATUS_LABELS } from '../constants'
import { formatDate, formatMoney } from '../money'
import type { InvoiceStatus, InvoiceSummary, Page, Stats } from '../types'

const FILTERS: Array<InvoiceStatus | ''> = ['', 'draft', 'sent', 'paid', 'cancelled']

export function Dashboard() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const q = params.get('q') ?? ''
  const page = Number(params.get('page') ?? 1)

  const [stats, setStats] = useState<Stats | null>(null)
  const [data, setData] = useState<Page<InvoiceSummary> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState(q)

  useEffect(() => {
    api.stats().then(setStats).catch(() => setStats(null))
  }, [])

  useEffect(() => {
    api
      .listInvoices({ status, q, page })
      .then((res) => {
        setData(res)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
  }, [status, q, page])

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  return (
    <>
      <header className="page-header">
        <h1>Facturas</h1>
        <Link to="/invoices/new" className="button">
          Nueva factura
        </Link>
      </header>

      {stats && (
        <section className="stats" aria-label="Resumen">
          <StatCard label="Cobrado" value={stats.by_status.paid.total} count={stats.by_status.paid.count} />
          <StatCard label="Pendiente de cobro" value={stats.by_status.sent.total} count={stats.by_status.sent.count} />
          <StatCard label="Vencido" value={stats.overdue.total} count={stats.overdue.count} tone="danger" />
          <StatCard label="Borradores" value={stats.by_status.draft.total} count={stats.by_status.draft.count} tone="muted" />
        </section>
      )}

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filtrar por estado">
          {FILTERS.map((f) => (
            <button
              key={f || 'all'}
              type="button"
              aria-pressed={status === f}
              onClick={() => setParam('status', f)}
            >
              {f ? STATUS_LABELS[f] : 'Todas'}
            </button>
          ))}
        </div>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            setParam('q', search.trim())
          }}
        >
          <input
            type="search"
            placeholder="Buscar por número o cliente"
            aria-label="Buscar facturas"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
      </div>

      {error && <p className="alert">{error}</p>}

      {data && data.items.length === 0 && (
        <div className="empty">
          <p>No hay facturas{status || q ? ' con estos filtros' : ' todavía'}.</p>
          {!status && !q && <Link to="/invoices/new">Crea la primera</Link>}
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <Link to={`/invoices/${inv.id}`}>{inv.number}</Link>
                  </td>
                  <td>{inv.client.name}</td>
                  <td>{formatDate(inv.issue_date)}</td>
                  <td>{formatDate(inv.due_date)}</td>
                  <td>
                    <StatusBadge status={inv.status} overdue={inv.is_overdue} />
                  </td>
                  <td className="num">{formatMoney(inv.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.pages > 1 && (
        <nav className="pagination" aria-label="Paginación">
          <button type="button" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>
            Anterior
          </button>
          <span>
            Página {data.page} de {data.pages}
          </span>
          <button
            type="button"
            disabled={page >= data.pages}
            onClick={() => setParam('page', String(page + 1))}
          >
            Siguiente
          </button>
        </nav>
      )}
    </>
  )
}

function StatCard(props: { label: string; value: string; count: number; tone?: 'danger' | 'muted' }) {
  return (
    <div className={`stat ${props.tone ? `stat-${props.tone}` : ''}`}>
      <span className="stat-label">{props.label}</span>
      <strong className="stat-value">{formatMoney(props.value)}</strong>
      <span className="stat-count">
        {props.count} {props.count === 1 ? 'factura' : 'facturas'}
      </span>
    </div>
  )
}
