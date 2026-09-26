import { useCallback, useEffect, useState } from 'react'

import { ApiError, api } from '../api'
import type { Client, ClientInput } from '../types'

const blank: ClientInput = { name: '', email: '', tax_id: '', address: '' }

export function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [form, setForm] = useState<ClientInput>(blank)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const load = useCallback(() => {
    api.listClients().then(setClients).catch((e: Error) => setError(e.message))
  }, [])

  useEffect(load, [load])

  const reset = () => {
    setForm(blank)
    setEditingId(null)
    setFieldErrors({})
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    const payload = {
      ...form,
      tax_id: form.tax_id?.trim() || null,
      address: form.address?.trim() || null,
    }
    try {
      if (editingId) await api.updateClient(editingId, payload)
      else await api.createClient(payload)
      reset()
      load()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        setFieldErrors((err.details as Record<string, string[]>) ?? {})
      }
    }
  }

  async function handleDelete(client: Client) {
    if (!window.confirm(`¿Borrar a ${client.name}?`)) return
    try {
      await api.deleteClient(client.id)
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const field = (name: keyof ClientInput, label: string, type = 'text') => (
    <label>
      {label}
      <input
        type={type}
        value={form[name] ?? ''}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        aria-invalid={!!fieldErrors[name]}
      />
      {fieldErrors[name] && <span className="field-error">{fieldErrors[name].join(' ')}</span>}
    </label>
  )

  return (
    <>
      <header className="page-header">
        <h1>Clientes</h1>
      </header>

      {error && <p className="alert">{error}</p>}

      <form className="card grid" onSubmit={handleSubmit} noValidate>
        <h2 className="span-all">{editingId ? 'Editar cliente' : 'Nuevo cliente'}</h2>
        {field('name', 'Nombre o razón social')}
        {field('email', 'Email', 'email')}
        {field('tax_id', 'NIF/CIF')}
        {field('address', 'Dirección')}
        <div className="actions span-all">
          {editingId && (
            <button type="button" className="secondary" onClick={reset}>
              Cancelar
            </button>
          )}
          <button type="submit">{editingId ? 'Guardar cambios' : 'Añadir cliente'}</button>
        </div>
      </form>

      {clients.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>NIF/CIF</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.email}</td>
                  <td>{c.tax_id ?? '—'}</td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="link"
                      onClick={() => {
                        setEditingId(c.id)
                        setForm({ name: c.name, email: c.email, tax_id: c.tax_id, address: c.address })
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                    >
                      Editar
                    </button>
                    <button type="button" className="link danger" onClick={() => handleDelete(c)}>
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
