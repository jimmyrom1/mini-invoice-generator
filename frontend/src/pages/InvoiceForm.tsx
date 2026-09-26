import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ApiError, api } from '../api'
import { ItemsEditor } from '../components/ItemsEditor'
import { emptyItem } from '../constants'
import { computeTotals, formatCents } from '../money'
import type { Client, InvoiceInput, InvoiceItem } from '../types'

// Fecha local (toISOString usaría UTC y de madrugada devolvería el día anterior).
const today = () => new Date().toLocaleDateString('sv-SE')
const normalize = (value: string) => value.trim().replace(',', '.')
const toInput = (value: string) => String(Number(value)).replace('.', ',')

export function InvoiceForm() {
  const { id } = useParams()
  const editing = id !== undefined
  const navigate = useNavigate()

  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [issueDate, setIssueDate] = useState(today())
  const [dueDate, setDueDate] = useState('')
  const [taxRate, setTaxRate] = useState('21')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()])
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.listClients().then(setClients).catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!editing) return
    api
      .getInvoice(Number(id))
      .then((inv) => {
        if (inv.status !== 'draft') {
          navigate(`/invoices/${inv.id}`, { replace: true })
          return
        }
        setClientId(String(inv.client.id))
        setIssueDate(inv.issue_date)
        setDueDate(inv.due_date)
        setTaxRate(toInput(inv.tax_rate))
        setNotes(inv.notes ?? '')
        setItems(
          inv.items.map(({ description, quantity, unit_price }) => ({
            description,
            quantity: toInput(quantity),
            unit_price: unit_price.replace('.', ','),
          })),
        )
      })
      .catch((e: Error) => setError(e.message))
  }, [editing, id, navigate])

  const totals = useMemo(() => computeTotals(items, taxRate), [items, taxRate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setFieldErrors({})
    const payload: InvoiceInput = {
      client_id: Number(clientId),
      issue_date: issueDate,
      due_date: dueDate || null,
      tax_rate: normalize(taxRate),
      notes: notes.trim() || null,
      items: items.map((item) => ({
        description: item.description.trim(),
        quantity: normalize(item.quantity),
        unit_price: normalize(item.unit_price),
      })),
    }
    try {
      const saved = editing
        ? await api.updateInvoice(Number(id), payload)
        : await api.createInvoice(payload)
      navigate(`/invoices/${saved.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        setFieldErrors(err.details ?? {})
      } else {
        setError('No se pudo conectar con el servidor.')
      }
    } finally {
      setSaving(false)
    }
  }

  const fieldError = (name: string) => {
    const value = fieldErrors[name]
    return Array.isArray(value) ? <span className="field-error">{value.join(' ')}</span> : null
  }

  return (
    <form className="invoice-form" onSubmit={handleSubmit} noValidate>
      <header className="page-header">
        <h1>{editing ? 'Editar borrador' : 'Nueva factura'}</h1>
      </header>

      {error && <p className="alert">{error}</p>}

      <section className="card grid">
        <label>
          Cliente
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
            <option value="" disabled>
              Selecciona un cliente…
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {fieldError('client_id')}
          {clients.length === 0 && (
            <span className="hint">
              No hay clientes. <Link to="/clients">Crea uno primero</Link>.
            </span>
          )}
        </label>
        <label>
          Fecha de emisión
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          {fieldError('issue_date')}
        </label>
        <label>
          Vencimiento
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <span className="hint">Si lo dejas vacío: 30 días.</span>
          {fieldError('due_date')}
        </label>
        <label>
          IVA (%)
          <input inputMode="decimal" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
          {fieldError('tax_rate')}
        </label>
      </section>

      <section className="card">
        <h2>Conceptos</h2>
        <ItemsEditor
          items={items}
          onChange={setItems}
          errors={(fieldErrors.items as Record<number, Record<string, string[]>>) ?? {}}
        />
        {Array.isArray(fieldErrors.items) && fieldError('items')}

        <dl className="totals">
          <dt>Base imponible</dt>
          <dd>{formatCents(totals.subtotal)}</dd>
          <dt>IVA</dt>
          <dd>{formatCents(totals.tax)}</dd>
          <dt className="grand">Total</dt>
          <dd className="grand">{formatCents(totals.total)}</dd>
        </dl>
      </section>

      <section className="card">
        <label>
          Notas (aparecen en el PDF)
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Forma de pago, IBAN…"
          />
        </label>
      </section>

      <div className="actions">
        <Link to={editing ? `/invoices/${id}` : '/'} className="button secondary">
          Cancelar
        </Link>
        <button type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar borrador'}
        </button>
      </div>
    </form>
  )
}
