from decimal import Decimal

from fpdf import FPDF
from fpdf.enums import XPos, YPos

from .models import Invoice

STATUS_LABELS = {
    "draft": "BORRADOR",
    "sent": "EMITIDA",
    "paid": "PAGADA",
    "cancelled": "ANULADA",
}


def eur(value: Decimal) -> str:
    """1234.5 -> '1.234,50 EUR' (formato español)."""
    formatted = f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{formatted} EUR"


def qty(value: Decimal) -> str:
    return f"{value.normalize():f}".replace(".", ",")


def render_invoice_pdf(invoice: Invoice, company: dict) -> bytes:
    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.set_title(f"Factura {invoice.number}")
    pdf.add_page()

    # Cabecera: emisor a la izquierda, datos de la factura a la derecha.
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 10, "FACTURA", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "", 10)
    top = pdf.get_y()
    pdf.multi_cell(90, 5, f"{company['name']}\nCIF: {company['tax_id']}\n{company['address']}")

    pdf.set_xy(130, top)
    pdf.multi_cell(
        70,
        5,
        f"Número: {invoice.number}\n"
        f"Fecha: {invoice.issue_date:%d/%m/%Y}\n"
        f"Vencimiento: {invoice.due_date:%d/%m/%Y}\n"
        f"Estado: {STATUS_LABELS[invoice.status.value]}",
        align="R",
    )

    # Cliente
    pdf.ln(8)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "Facturar a:", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "", 10)
    client = invoice.client
    client_lines = [client.name]
    if client.tax_id:
        client_lines.append(f"NIF/CIF: {client.tax_id}")
    if client.address:
        client_lines.append(client.address)
    client_lines.append(client.email)
    pdf.multi_cell(0, 5, "\n".join(client_lines))

    # Tabla de conceptos
    pdf.ln(6)
    widths = (85, 22, 33, 17, 33)
    headers = ("Concepto", "Cantidad", "Precio unit.", "IVA", "Importe")
    pdf.set_fill_color(35, 48, 68)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 10)
    for width, header, align in zip(widths, headers, "LRRRR", strict=True):
        pdf.cell(width, 8, header, fill=True, align=align)
    pdf.ln()

    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "", 10)
    for i, item in enumerate(invoice.items):
        pdf.set_fill_color(*((244, 246, 249) if i % 2 else (255, 255, 255)))
        pdf.cell(widths[0], 7, item.description[:55], fill=True)
        pdf.cell(widths[1], 7, qty(item.quantity), fill=True, align="R")
        pdf.cell(widths[2], 7, eur(item.unit_price), fill=True, align="R")
        pdf.cell(widths[3], 7, f"{qty(item.tax_rate)} %", fill=True, align="R")
        pdf.cell(widths[4], 7, eur(item.amount), fill=True, align="R")
        pdf.ln()

    # Totales
    pdf.ln(4)
    rows = [("Base imponible", eur(invoice.subtotal))]
    # Desglose por tipo, obligatorio cuando una factura mezcla tipos de IVA.
    rows += [
        (f"IVA {qty(line.rate)} % s/ {eur(line.base)}", eur(line.amount))
        for line in invoice.tax_breakdown
    ]
    if invoice.withholding_rate:
        label = f"Retención IRPF {qty(invoice.withholding_rate)} %"
        rows.append((label, f"-{eur(invoice.withholding_amount)}"))
    for label, value in rows:
        pdf.set_x(100)
        pdf.cell(65, 7, label)
        pdf.cell(35, 7, value, align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_x(100)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(65, 9, "TOTAL", border="T")
    pdf.cell(35, 9, eur(invoice.total), border="T", align="R")

    if invoice.notes:
        pdf.ln(16)
        pdf.set_font("Helvetica", "I", 9)
        pdf.multi_cell(0, 5, invoice.notes)

    return bytes(pdf.output())
