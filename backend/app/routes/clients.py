from flask import Blueprint, jsonify, request
from sqlalchemy import or_, select

from ..errors import ConflictError
from ..extensions import db
from ..models import Client, Invoice
from ..schemas import ClientSchema

bp = Blueprint("clients", __name__)
schema = ClientSchema()


@bp.get("")
def list_clients():
    stmt = select(Client).order_by(Client.name)
    if q := request.args.get("q", "").strip():
        pattern = f"%{q}%"
        stmt = stmt.where(or_(Client.name.ilike(pattern), Client.email.ilike(pattern)))
    clients = db.session.scalars(stmt).all()
    return jsonify(schema.dump(clients, many=True))


@bp.post("")
def create_client():
    data = schema.load(request.get_json(silent=True) or {})
    _ensure_email_available(data["email"])
    client = Client(**data)
    db.session.add(client)
    db.session.commit()
    return jsonify(schema.dump(client)), 201


@bp.get("/<int:client_id>")
def get_client(client_id: int):
    return jsonify(schema.dump(db.get_or_404(Client, client_id)))


@bp.put("/<int:client_id>")
def update_client(client_id: int):
    client = db.get_or_404(Client, client_id)
    data = schema.load(request.get_json(silent=True) or {})
    if data["email"] != client.email:
        _ensure_email_available(data["email"])
    for key, value in data.items():
        setattr(client, key, value)
    db.session.commit()
    return jsonify(schema.dump(client))


@bp.delete("/<int:client_id>")
def delete_client(client_id: int):
    client = db.get_or_404(Client, client_id)
    has_invoices = db.session.scalar(select(Invoice.id).where(Invoice.client_id == client_id))
    if has_invoices:
        raise ConflictError("No se puede borrar un cliente que tiene facturas.")
    db.session.delete(client)
    db.session.commit()
    return "", 204


def _ensure_email_available(email: str) -> None:
    if db.session.scalar(select(Client.id).where(Client.email == email)):
        raise ConflictError(f"Ya existe un cliente con el email {email}.")
