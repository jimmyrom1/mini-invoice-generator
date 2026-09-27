from datetime import date, timedelta
from decimal import Decimal

import click
from flask import Flask

from .extensions import db
from .models import Client, Invoice, InvoiceCounter, InvoiceItem, InvoiceStatus


def register_cli(app: Flask) -> None:
    @app.cli.command("seed")
    def seed() -> None:
        """Carga clientes y facturas de ejemplo (solo si la base de datos está vacía)."""
        if db.session.query(Client.id).first():
            click.echo("La base de datos ya tiene datos; no se carga nada.")
            return

        acme = Client(
            name="Acme Consulting S.L.",
            email="facturacion@acme.example",
            tax_id="B87654321",
            address="Av. Diagonal 100, 08019 Barcelona",
        )
        luna = Client(name="Estudio Luna", email="hola@estudioluna.example", tax_id="12345678Z")
        db.session.add_all([acme, luna])

        today = date.today()
        samples = [
            # Cada muestra: cliente, emisión, estado, % de IRPF y líneas (concepto, cantidad,
            # precio y, opcionalmente, % de IVA si no es el 21 %).
            (
                acme,
                today - timedelta(days=45),
                InvoiceStatus.PAID,
                "15",
                [
                    ("Desarrollo API REST", "24", "45.00"),
                    ("Despliegue y configuración", "1", "300.00"),
                ],
            ),
            (
                luna,
                today - timedelta(days=40),
                InvoiceStatus.SENT,
                "0",
                [("Diseño de landing page", "1", "850.00")],
            ),
            (
                acme,
                today - timedelta(days=5),
                InvoiceStatus.SENT,
                "15",
                [("Mantenimiento mensual", "1", "250.00"), ("Horas de soporte", "3.5", "40.00")],
            ),
            (
                luna,
                today,
                InvoiceStatus.DRAFT,
                "0",
                [("Sesión de fotos producto", "2", "180.00"), ("Álbum impreso", "1", "60.00", "4")],
            ),
        ]
        for client, issued, status, withholding, lines in samples:
            db.session.add(
                Invoice(
                    number=InvoiceCounter.next_number(issued.year),
                    client=client,
                    issue_date=issued,
                    due_date=issued + timedelta(days=30),
                    status=status,
                    tax_rate=Decimal("21"),
                    withholding_rate=Decimal(withholding),
                    items=[
                        InvoiceItem(
                            position=i,
                            description=line[0],
                            quantity=Decimal(line[1]),
                            unit_price=Decimal(line[2]),
                            tax_rate=Decimal(line[3] if len(line) > 3 else "21"),
                        )
                        for i, line in enumerate(lines)
                    ],
                )
            )
        db.session.commit()
        click.echo(f"Cargados 2 clientes y {len(samples)} facturas de ejemplo.")
