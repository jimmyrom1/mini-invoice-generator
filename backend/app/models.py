from __future__ import annotations

import enum
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .extensions import db

CENT = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


class InvoiceStatus(enum.StrEnum):
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    CANCELLED = "cancelled"


# Transiciones permitidas: una factura emitida ya no se edita, solo avanza de estado.
ALLOWED_TRANSITIONS: dict[InvoiceStatus, set[InvoiceStatus]] = {
    InvoiceStatus.DRAFT: {InvoiceStatus.SENT, InvoiceStatus.CANCELLED},
    InvoiceStatus.SENT: {InvoiceStatus.PAID, InvoiceStatus.CANCELLED},
    InvoiceStatus.PAID: set(),
    InvoiceStatus.CANCELLED: set(),
}


class Client(db.Model):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(254), unique=True)
    tax_id: Mapped[str | None] = mapped_column(String(32))
    address: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    invoices: Mapped[list[Invoice]] = relationship(back_populates="client")


class InvoiceCounter(db.Model):
    """Contador por año para numerar las facturas de forma correlativa."""

    __tablename__ = "invoice_counters"

    year: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    last_number: Mapped[int] = mapped_column(default=0)

    @staticmethod
    def next_number(year: int) -> str:
        # INSERT ... ON CONFLICT DO UPDATE ... RETURNING es atómico en PostgreSQL:
        # dos peticiones simultáneas nunca obtienen el mismo número.
        stmt = (
            insert(InvoiceCounter)
            .values(year=year, last_number=1)
            .on_conflict_do_update(
                index_elements=[InvoiceCounter.year],
                set_={"last_number": InvoiceCounter.last_number + 1},
            )
            .returning(InvoiceCounter.last_number)
        )
        n = db.session.execute(stmt).scalar_one()
        return f"INV-{year}-{n:04d}"


class Invoice(db.Model):
    __tablename__ = "invoices"
    __table_args__ = (
        CheckConstraint("tax_rate >= 0 AND tax_rate <= 100", name="ck_invoices_tax_rate"),
        CheckConstraint("due_date >= issue_date", name="ck_invoices_due_after_issue"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(20), unique=True)
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="RESTRICT"), index=True
    )
    issue_date: Mapped[date]
    due_date: Mapped[date]
    status: Mapped[InvoiceStatus] = mapped_column(
        db.Enum(
            InvoiceStatus,
            name="invoice_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        default=InvoiceStatus.DRAFT,
        index=True,
    )
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("21.00"))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    client: Mapped[Client] = relationship(back_populates="invoices")
    items: Mapped[list[InvoiceItem]] = relationship(
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="InvoiceItem.position",
    )

    @property
    def subtotal(self) -> Decimal:
        return money(sum((item.amount for item in self.items), Decimal("0")))

    @property
    def tax_amount(self) -> Decimal:
        return money(self.subtotal * self.tax_rate / Decimal(100))

    @property
    def total(self) -> Decimal:
        return self.subtotal + self.tax_amount

    @property
    def is_overdue(self) -> bool:
        return self.status == InvoiceStatus.SENT and self.due_date < date.today()

    def can_transition_to(self, new_status: InvoiceStatus) -> bool:
        return new_status in ALLOWED_TRANSITIONS[self.status]


class InvoiceItem(db.Model):
    __tablename__ = "invoice_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_invoice_items_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_invoice_items_price_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(default=0)
    description: Mapped[str] = mapped_column(String(500))
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    invoice: Mapped[Invoice] = relationship(back_populates="items")

    @property
    def amount(self) -> Decimal:
        return money(self.quantity * self.unit_price)
