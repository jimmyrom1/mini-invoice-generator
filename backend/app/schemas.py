from datetime import date, timedelta
from decimal import Decimal

from marshmallow import Schema, ValidationError, fields, post_load, validate

from .models import InvoiceStatus


def money_field(**kwargs) -> fields.Decimal:
    # Los importes viajan como string para no perder precisión en JSON.
    return fields.Decimal(as_string=True, places=2, **kwargs)


class ClientSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    email = fields.Email(required=True)
    tax_id = fields.Str(allow_none=True, validate=validate.Length(max=32))
    address = fields.Str(allow_none=True)
    created_at = fields.DateTime(dump_only=True)


class InvoiceItemSchema(Schema):
    id = fields.Int(dump_only=True)
    description = fields.Str(required=True, validate=validate.Length(min=1, max=500))
    quantity = fields.Decimal(
        required=True, as_string=True, validate=validate.Range(min=Decimal("0.001"))
    )
    unit_price = money_field(required=True, validate=validate.Range(min=Decimal("0")))
    amount = money_field(dump_only=True)


class InvoiceInputSchema(Schema):
    client_id = fields.Int(required=True)
    issue_date = fields.Date(load_default=date.today)
    due_date = fields.Date(load_default=None)
    tax_rate = fields.Decimal(
        load_default=Decimal("21"),
        validate=validate.Range(min=Decimal("0"), max=Decimal("100")),
    )
    notes = fields.Str(allow_none=True, load_default=None)
    items = fields.List(
        fields.Nested(InvoiceItemSchema), required=True, validate=validate.Length(min=1)
    )

    @post_load
    def default_due_date(self, data, **kwargs):
        if data["due_date"] is None:
            data["due_date"] = data["issue_date"] + timedelta(days=30)
        if data["due_date"] < data["issue_date"]:
            raise ValidationError(
                "La fecha de vencimiento no puede ser anterior a la de emisión.", "due_date"
            )
        return data


class StatusSchema(Schema):
    status = fields.Enum(InvoiceStatus, by_value=True, required=True)


class InvoiceSchema(Schema):
    id = fields.Int()
    number = fields.Str()
    client = fields.Nested(ClientSchema(only=("id", "name", "email", "tax_id", "address")))
    issue_date = fields.Date()
    due_date = fields.Date()
    status = fields.Enum(InvoiceStatus, by_value=True)
    is_overdue = fields.Bool()
    tax_rate = fields.Decimal(as_string=True, places=2)
    notes = fields.Str(allow_none=True)
    items = fields.List(fields.Nested(InvoiceItemSchema))
    subtotal = money_field()
    tax_amount = money_field()
    total = money_field()
    created_at = fields.DateTime()
    updated_at = fields.DateTime()


class InvoiceSummarySchema(InvoiceSchema):
    class Meta:
        exclude = ("items", "notes", "created_at", "updated_at")
