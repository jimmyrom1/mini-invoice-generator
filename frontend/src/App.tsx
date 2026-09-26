import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'

import { Clients } from './pages/Clients'
import { Dashboard } from './pages/Dashboard'
import { InvoiceDetail } from './pages/InvoiceDetail'
import { InvoiceForm } from './pages/InvoiceForm'

export default function App() {
  return (
    <BrowserRouter>
      <nav className="topbar">
        <span className="brand">▤ Mini Facturas</span>
        <NavLink to="/" end>
          Facturas
        </NavLink>
        <NavLink to="/clients">Clientes</NavLink>
      </nav>
      <main className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/invoices/new" element={<InvoiceForm />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/invoices/:id/edit" element={<InvoiceForm />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="*" element={<p className="alert">Página no encontrada.</p>} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
