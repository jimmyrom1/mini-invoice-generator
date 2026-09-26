from concurrent.futures import ThreadPoolExecutor

import pytest


def test_invoice_totals_are_exact(make_invoice):
    invoice = make_invoice()
    # 10 × 50,00 + 1 × 19,99 = 519,99 ; IVA 21 % = 109,1979 → 109,20
    assert invoice["subtotal"] == "519.99"
    assert invoice["tax_amount"] == "109.20"
    assert invoice["total"] == "629.19"
    assert [i["amount"] for i in invoice["items"]] == ["500.00", "19.99"]


def test_invoice_numbers_are_sequential_per_year(make_invoice):
    first = make_invoice()
    second = make_invoice()
    next_year = make_invoice(issue_date="2027-01-10")
    assert first["number"] == "INV-2026-0001"
    assert second["number"] == "INV-2026-0002"
    assert next_year["number"] == "INV-2027-0001"


def test_invoice_numbers_are_unique_under_concurrency(app, customer):
    payload = {
        "client_id": customer["id"],
        "issue_date": "2026-05-01",
        "items": [{"description": "x", "quantity": "1", "unit_price": "1"}],
    }

    def create(_):
        with app.test_client() as c:
            return c.post("/api/invoices", json=payload).get_json()["number"]

    with ThreadPoolExecutor(max_workers=8) as pool:
        numbers = list(pool.map(create, range(16)))
    assert len(set(numbers)) == 16


def test_due_date_defaults_to_30_days(make_invoice):
    assert make_invoice()["due_date"] == "2026-03-31"


@pytest.mark.parametrize(
    ("override", "field"),
    [
        ({"items": []}, "items"),
        ({"due_date": "2026-02-01"}, "due_date"),
        ({"tax_rate": "150"}, "tax_rate"),
        ({"items": [{"description": "x", "quantity": "0", "unit_price": "1"}]}, "items"),
    ],
)
def test_invalid_invoices_are_rejected(client, customer, override, field):
    payload = {
        "client_id": customer["id"],
        "issue_date": "2026-03-01",
        "items": [{"description": "x", "quantity": "1", "unit_price": "1"}],
        **override,
    }
    res = client.post("/api/invoices", json=payload)
    assert res.status_code == 422
    assert field in res.get_json()["details"]


def test_unknown_client_is_rejected(client):
    res = client.post(
        "/api/invoices",
        json={
            "client_id": 999,
            "items": [{"description": "x", "quantity": "1", "unit_price": "1"}],
        },
    )
    assert res.status_code == 409


def test_status_workflow(client, make_invoice):
    invoice = make_invoice()
    url = f"/api/invoices/{invoice['id']}/status"

    assert client.patch(url, json={"status": "paid"}).status_code == 409  # draft → paid no
    assert client.patch(url, json={"status": "sent"}).get_json()["status"] == "sent"
    assert client.patch(url, json={"status": "paid"}).get_json()["status"] == "paid"
    assert client.patch(url, json={"status": "cancelled"}).status_code == 409


def test_only_drafts_can_be_edited_or_deleted(client, make_invoice):
    invoice = make_invoice()
    client.patch(f"/api/invoices/{invoice['id']}/status", json={"status": "sent"})

    body = {
        "client_id": invoice["client"]["id"],
        "items": [{"description": "y", "quantity": "1", "unit_price": "1"}],
    }
    assert client.put(f"/api/invoices/{invoice['id']}", json=body).status_code == 409
    assert client.delete(f"/api/invoices/{invoice['id']}").status_code == 409


def test_update_draft_replaces_items(client, make_invoice):
    invoice = make_invoice()
    res = client.put(
        f"/api/invoices/{invoice['id']}",
        json={
            "client_id": invoice["client"]["id"],
            "issue_date": "2026-03-01",
            "tax_rate": "0",
            "items": [{"description": "Único", "quantity": "2", "unit_price": "10.50"}],
        },
    )
    data = res.get_json()
    assert res.status_code == 200
    assert [i["description"] for i in data["items"]] == ["Único"]
    assert data["total"] == "21.00"
    assert data["number"] == invoice["number"]


def test_list_filters_and_pagination(client, make_invoice):
    a = make_invoice()
    make_invoice()
    client.patch(f"/api/invoices/{a['id']}/status", json={"status": "sent"})

    sent = client.get("/api/invoices?status=sent").get_json()
    assert [i["id"] for i in sent["items"]] == [a["id"]]

    page = client.get("/api/invoices?per_page=1").get_json()
    assert page["total"] == 2 and page["pages"] == 2 and len(page["items"]) == 1

    assert client.get("/api/invoices?status=bogus").status_code == 400
    assert client.get("/api/invoices?q=acme").get_json()["total"] == 2


def test_stats_match_invoice_totals(client, make_invoice):
    paid = make_invoice()
    make_invoice(items=[{"description": "x", "quantity": "3", "unit_price": "33.33"}])
    url = f"/api/invoices/{paid['id']}/status"
    client.patch(url, json={"status": "sent"})
    client.patch(url, json={"status": "paid"})

    stats = client.get("/api/invoices/stats").get_json()
    assert stats["by_status"]["paid"] == {"count": 1, "total": "629.19"}
    # 99,99 + 21 % (20,9979 → 21,00) = 120,99
    assert stats["by_status"]["draft"] == {"count": 1, "total": "120.99"}
    assert stats["by_status"]["sent"] == {"count": 0, "total": "0.00"}


def test_overdue_flag(client, make_invoice):
    invoice = make_invoice(issue_date="2020-01-01")
    client.patch(f"/api/invoices/{invoice['id']}/status", json={"status": "sent"})
    data = client.get(f"/api/invoices/{invoice['id']}").get_json()
    assert data["is_overdue"] is True
    assert client.get("/api/invoices/stats").get_json()["overdue"]["count"] == 1


def test_pdf_download(client, make_invoice):
    invoice = make_invoice(notes="Pago por transferencia a ES00 0000 0000 0000")
    res = client.get(f"/api/invoices/{invoice['id']}/pdf")
    assert res.status_code == 200
    assert res.mimetype == "application/pdf"
    assert res.data.startswith(b"%PDF")
    assert "INV-2026-0001.pdf" in res.headers["Content-Disposition"]


def test_missing_invoice_returns_json_404(client):
    res = client.get("/api/invoices/12345")
    assert res.status_code == 404
    assert res.get_json()["error"] == "not_found"


def test_health(client):
    assert client.get("/api/health").get_json() == {"status": "ok"}
