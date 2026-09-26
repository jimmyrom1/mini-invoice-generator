from datetime import date
from decimal import Decimal

from flask import Blueprint, Response, abort, current_app, jsonify, request
from sqlalchemy import func, or_, select
from sqlalchemy.orm import joinedload, selectinload

from ..errors import ConflictError
from ..extensions import db
from ..models import Client, Invoice, InvoiceCounter, InvoiceItem, InvoiceStatus
from ..pdf import render_invoice_pdf
from ..schemas import InvoiceInputSchema, InvoiceSchema, InvoiceSummarySchema, StatusSchema

bp = Blueprint("invoices", __name__)
input_schema = InvoiceInputSchema()
detail_schema = InvoiceSchema()
summary_schema = InvoiceSummarySchema()
status_schema = StatusSchema()


def _load_invoice(invoice_id: int) -> Invoice:
    stmt = (
        select(Invoice)
        .where(Invoice.id == invoice_id)
        .options(joinedload(Invoice.client), selectinload(Invoice.items))
    )
    invoice = db.session.scalar(stmt)
    if invoice is None:
        abort(404, description=f"Factura {invoice_id} no encontrada.")
    return invoice


def _require_client(client_id: int) -> None:
    if db.session.get(Client, client_id) is None:
        raise ConflictError(f"El cliente {client_id} no existe.")


def _build_items(items: list[dict]) -> list[InvoiceItem]:
    return [InvoiceItem(position=i, **item) for i, item in enumerate(items)]


@bp.get("")
def list_invoices():
    stmt = (
        select(Invoice)
        .join(Invoice.client)
        .options(joinedload(Invoice.client), selectinload(Invoice.items))
        .order_by(Invoice.issue_date.desc(), Invoice.id.desc())
    )
    if status := request.args.get("status"):
        try:
            stmt = stmt.where(Invoice.status == InvoiceStatus(status))
        except ValueError:
            abort(400, description=f"Estado desconocido: {status}")
    if client_id := request.args.get("client_id", type=int):
        stmt = stmt.where(Invoice.client_id == client_id)
    if q := request.args.get("q", "").strip():
        pattern = f"%{q}%"
        stmt = stmt.where(or_(Invoice.number.ilike(pattern), Client.name.ilike(pattern)))

    page = db.paginate(
        stmt,
        page=request.args.get("page", 1, type=int),
        per_page=request.args.get("per_page", 20, type=int),
        max_per_page=100,
    )
    return jsonify(
        items=summary_schema.dump(page.items, many=True),
        page=page.page,
        pages=page.pages,
        total=page.total,
    )


@bp.post("")
def create_invoice():
    data = input_schema.load(request.get_json(silent=True) or {})
    _require_client(data["client_id"])
    items = data.pop("items")
    invoice = Invoice(
        number=InvoiceCounter.next_number(data["issue_date"].year),
        items=_build_items(items),
        **data,
    )
    db.session.add(invoice)
    db.session.commit()
    return jsonify(detail_schema.dump(_load_invoice(invoice.id))), 201


@bp.get("/<int:invoice_id>")
def get_invoice(invoice_id: int):
    return jsonify(detail_schema.dump(_load_invoice(invoice_id)))


@bp.put("/<int:invoice_id>")
def update_invoice(invoice_id: int):
    invoice = _load_invoice(invoice_id)
    if invoice.status != InvoiceStatus.DRAFT:
        raise ConflictError("Solo se pueden editar facturas en borrador.")
    data = input_schema.load(request.get_json(silent=True) or {})
    _require_client(data["client_id"])
    invoice.items = _build_items(data.pop("items"))
    for key, value in data.items():
        setattr(invoice, key, value)
    db.session.commit()
    return jsonify(detail_schema.dump(_load_invoice(invoice_id)))


@bp.patch("/<int:invoice_id>/status")
def change_status(invoice_id: int):
    invoice = _load_invoice(invoice_id)
    new_status = status_schema.load(request.get_json(silent=True) or {})["status"]
    if not invoice.can_transition_to(new_status):
        raise ConflictError(
            f"No se puede pasar de '{invoice.status.value}' a '{new_status.value}'."
        )
    invoice.status = new_status
    db.session.commit()
    return jsonify(detail_schema.dump(invoice))


@bp.delete("/<int:invoice_id>")
def delete_invoice(invoice_id: int):
    invoice = _load_invoice(invoice_id)
    if invoice.status != InvoiceStatus.DRAFT:
        raise ConflictError("Solo se pueden borrar facturas en borrador; anula las emitidas.")
    db.session.delete(invoice)
    db.session.commit()
    return "", 204


@bp.get("/<int:invoice_id>/pdf")
def invoice_pdf(invoice_id: int):
    invoice = _load_invoice(invoice_id)
    pdf = render_invoice_pdf(invoice, current_app.config["COMPANY"])
    return Response(
        pdf,
        mimetype="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{invoice.number}.pdf"'},
    )


@bp.get("/stats")
def stats():
    """Resumen para el panel: importes por estado calculados en la base de datos."""
    # Mismo redondeo que Invoice.total: cada línea a céntimos y el IVA redondeado aparte.
    line_total = func.round(InvoiceItem.quantity * InvoiceItem.unit_price, 2)
    subtotals = (
        select(
            Invoice.id,
            Invoice.status,
            Invoice.due_date,
            Invoice.tax_rate,
            func.coalesce(func.sum(line_total), 0).label("subtotal"),
        )
        .outerjoin(Invoice.items)
        .group_by(Invoice.id)
        .subquery()
    )
    per_invoice = select(
        subtotals.c.status,
        subtotals.c.due_date,
        (
            subtotals.c.subtotal + func.round(subtotals.c.subtotal * subtotals.c.tax_rate / 100, 2)
        ).label("total"),
    ).subquery()
    rows = db.session.execute(
        select(
            per_invoice.c.status,
            func.count(),
            func.coalesce(func.sum(per_invoice.c.total), 0),
        ).group_by(per_invoice.c.status)
    ).all()
    overdue = db.session.execute(
        select(func.count(), func.coalesce(func.sum(per_invoice.c.total), 0)).where(
            per_invoice.c.status == InvoiceStatus.SENT, per_invoice.c.due_date < date.today()
        )
    ).one()

    by_status = {s.value: {"count": 0, "total": "0.00"} for s in InvoiceStatus}
    for status, count, total in rows:
        by_status[status.value] = {"count": count, "total": f"{Decimal(total):.2f}"}
    return jsonify(
        by_status=by_status,
        overdue={"count": overdue[0], "total": f"{Decimal(overdue[1]):.2f}"},
    )
