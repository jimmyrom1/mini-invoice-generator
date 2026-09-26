import { emptyItem } from '../constants'
import { formatCents, lineCents } from '../money'
import type { InvoiceItem } from '../types'

interface Props {
  items: InvoiceItem[]
  onChange: (items: InvoiceItem[]) => void
  errors?: Record<number, Record<string, string[]>>
}

export function ItemsEditor({ items, onChange, errors = {} }: Props) {
  const update = (index: number, patch: Partial<InvoiceItem>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))

  const remove = (index: number) => onChange(items.filter((_, i) => i !== index))

  return (
    <div className="items-editor">
      <table>
        <thead>
          <tr>
            <th>Concepto</th>
            <th className="num">Cantidad</th>
            <th className="num">Precio unit.</th>
            <th className="num">Importe</th>
            <th aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td>
                <input
                  aria-label={`Concepto línea ${i + 1}`}
                  value={item.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                  aria-invalid={!!errors[i]?.description}
                  placeholder="Descripción del servicio o producto"
                  required
                />
              </td>
              <td>
                <input
                  aria-label={`Cantidad línea ${i + 1}`}
                  className="num"
                  inputMode="decimal"
                  value={item.quantity}
                  onChange={(e) => update(i, { quantity: e.target.value })}
                  aria-invalid={!!errors[i]?.quantity}
                  required
                />
              </td>
              <td>
                <input
                  aria-label={`Precio línea ${i + 1}`}
                  className="num"
                  inputMode="decimal"
                  value={item.unit_price}
                  onChange={(e) => update(i, { unit_price: e.target.value })}
                  aria-invalid={!!errors[i]?.unit_price}
                  placeholder="0,00"
                  required
                />
              </td>
              <td className="num amount">{formatCents(lineCents(item))}</td>
              <td>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => remove(i)}
                  disabled={items.length === 1}
                  aria-label={`Quitar línea ${i + 1}`}
                  title="Quitar línea"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="secondary" onClick={() => onChange([...items, emptyItem()])}>
        + Añadir línea
      </button>
    </div>
  )
}
