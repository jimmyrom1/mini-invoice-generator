import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { api } from '../api'
import { StatusBadge } from '../components/StatusBadge'
import { formatDate, formatMoney } from '../money'
import type { Invoice, InvoiceStatus } from '../types'

const ACTIONS: Record<InvoiceStatus, Array<{ to: InvoiceStatus; label: string; danger?: boolean }>> = {
  draft: [{ to: 'sent', label: 'Emitir factura' }],
  sent: [
    { to: 'paid', label: 'Marcar como pagada' },
    { to: 'cancelled', label: 'Anular', danger: true },
  ],
  paid: [],
  cancelled: [],
}

export function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.getInvoice(Number(id)).then(setInvoice).catch((e: Error) => setError(e.message))
  }, [id])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (error && !invoice) return <p className="alert">{error}</p>
  if (!invoice) return <p className="loading">Cargando…</p>

  const changeStatus = (to: InvoiceStatus) =>
    run(async () => setInvoice(await api.setStatus(invoice.id, to)))

  const remove = () =>
    run(async () => {
      if (!window.confirm(`¿Borrar el borrador ${invoice.number}?`)) return
      await api.deleteInvoice(invoice.id)
      navigate('/')
    })

  return (
    <>
      <header className="page-header">
        <div>
          <Link to="/" className="back">
            ← Facturas
          </Link>
          <h1>
            {invoice.number} <StatusBadge status={invoice.status} overdue={invoice.is_overdue} />
          </h1>
        </div>
        <div className="actions">
          <a className="button secondary" href={api.pdfUrl(invoice.id)} target="_blank" rel="noreferrer">
            Ver PDF
          </a>
          {invoice.status === 'draft' && (
            <>
              <Link className="button secondary" to={`/invoices/${invoice.id}/edit`}>
                Editar
              </Link>
              <button type="button" className="danger" onClick={remove} disabled={busy}>
                Borrar
              </button>
            </>
          )}
          {ACTIONS[invoice.status].map((a) => (
            <button
              key={a.to}
              type="button"
              className={a.danger ? 'danger' : undefined}
              onClick={() => changeStatus(a.to)}
              disabled={busy}
            >
              {a.label}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="alert">{error}</p>}

      <article className="card paper">
        <div className="paper-head">
          <div>
            <h2>Facturar a</h2>
            <p>
              <strong>{invoice.client.name}</strong>
              {invoice.client.tax_id && <><br />NIF/CIF: {invoice.client.tax_id}</>}
              {invoice.client.address && <><br />{invoice.client.address}</>}
              <br />
              {invoice.client.email}
            </p>
          </div>
          <dl className="meta">
            <dt>Fecha</dt>
            <dd>{formatDate(invoice.issue_date)}</dd>
            <dt>Vencimiento</dt>
            <dd>{formatDate(invoice.due_date)}</dd>
          </dl>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Concepto</th>
                <th className="num">Cantidad</th>
                <th className="num">Precio unit.</th>
                <th className="num">Importe</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td className="num">{Number(item.quantity).toLocaleString('es-ES')}</td>
                  <td className="num">{formatMoney(item.unit_price)}</td>
                  <td className="num">{formatMoney(item.amount!)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="totals">
          <dt>Base imponible</dt>
          <dd>{formatMoney(invoice.subtotal)}</dd>
          <dt>IVA ({Number(invoice.tax_rate).toLocaleString('es-ES')} %)</dt>
          <dd>{formatMoney(invoice.tax_amount)}</dd>
          <dt className="grand">Total</dt>
          <dd className="grand">{formatMoney(invoice.total)}</dd>
        </dl>

        {invoice.notes && <p className="notes">{invoice.notes}</p>}
      </article>
    </>
  )
}
