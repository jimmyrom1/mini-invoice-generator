"""IVA por línea y retención de IRPF

Revision ID: b7e2f4a9c1d3
Revises: 9d1c6a715c61
Create Date: 2026-09-27 13:30:00

"""

import sqlalchemy as sa
from alembic import op

revision = "b7e2f4a9c1d3"
down_revision = "9d1c6a715c61"
branch_labels = None
depends_on = None


def upgrade():
    # Las líneas existentes heredan el IVA de su factura: los totales de las facturas ya
    # emitidas no cambian ni un céntimo.
    op.add_column("invoice_items", sa.Column("tax_rate", sa.Numeric(5, 2), nullable=True))
    op.execute(
        "UPDATE invoice_items SET tax_rate = invoices.tax_rate "
        "FROM invoices WHERE invoices.id = invoice_items.invoice_id"
    )
    op.alter_column("invoice_items", "tax_rate", nullable=False)
    op.create_check_constraint(
        "ck_invoice_items_tax_rate", "invoice_items", "tax_rate >= 0 AND tax_rate <= 100"
    )

    op.add_column(
        "invoices",
        sa.Column("withholding_rate", sa.Numeric(5, 2), nullable=False, server_default="0"),
    )
    op.create_check_constraint(
        "ck_invoices_withholding_rate",
        "invoices",
        "withholding_rate >= 0 AND withholding_rate <= 100",
    )


def downgrade():
    op.drop_constraint("ck_invoices_withholding_rate", "invoices", type_="check")
    op.drop_column("invoices", "withholding_rate")
    op.drop_constraint("ck_invoice_items_tax_rate", "invoice_items", type_="check")
    op.drop_column("invoice_items", "tax_rate")
