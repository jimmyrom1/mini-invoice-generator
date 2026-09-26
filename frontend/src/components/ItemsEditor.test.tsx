import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import type { InvoiceItem } from '../types'
import { emptyItem } from '../constants'
import { ItemsEditor } from './ItemsEditor'

function Harness() {
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()])
  return <ItemsEditor items={items} onChange={setItems} />
}

// Intl usa un espacio no separable antes del símbolo €.
const euros = (text: string) => text.replace(/\s/g, ' ')

describe('ItemsEditor', () => {
  it('recalculates the line amount as the user types', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.clear(screen.getByLabelText('Cantidad línea 1'))
    await user.type(screen.getByLabelText('Cantidad línea 1'), '3')
    await user.type(screen.getByLabelText('Precio línea 1'), '12,50')

    const row = screen.getByLabelText('Concepto línea 1').closest('tr')!
    expect(euros(row.textContent!)).toContain('37,50 €')
  })

  it('adds and removes lines but always keeps one', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.getByLabelText('Quitar línea 1')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '+ Añadir línea' }))
    expect(screen.getByLabelText('Concepto línea 2')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Quitar línea 2'))
    expect(screen.queryByLabelText('Concepto línea 2')).not.toBeInTheDocument()
  })
})
