import pytest
from sqlalchemy import text

from app import create_app
from app.config import TestConfig
from app.extensions import db


@pytest.fixture(scope="session")
def app():
    app = create_app(TestConfig)
    with app.app_context():
        db.drop_all()
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture(autouse=True)
def clean_db(app):
    yield
    db.session.rollback()
    tables = ", ".join(t.name for t in db.metadata.sorted_tables)
    db.session.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    db.session.commit()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def customer(client):
    res = client.post(
        "/api/clients",
        json={"name": "Acme S.L.", "email": "billing@acme.test", "tax_id": "B11111111"},
    )
    assert res.status_code == 201
    return res.get_json()


@pytest.fixture
def make_invoice(client, customer):
    def _make(**overrides):
        payload = {
            "client_id": customer["id"],
            "issue_date": "2026-03-01",
            "tax_rate": "21",
            "items": [
                {"description": "Consultoría", "quantity": "10", "unit_price": "50.00"},
                {"description": "Hosting", "quantity": "1", "unit_price": "19.99"},
            ],
        }
        payload.update(overrides)
        res = client.post("/api/invoices", json=payload)
        assert res.status_code == 201, res.get_json()
        return res.get_json()

    return _make
