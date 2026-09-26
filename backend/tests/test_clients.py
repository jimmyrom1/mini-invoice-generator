def test_create_and_list_clients(client, customer):
    res = client.get("/api/clients")
    assert res.status_code == 200
    assert [c["email"] for c in res.get_json()] == ["billing@acme.test"]


def test_search_clients(client, customer):
    client.post("/api/clients", json={"name": "Beta Corp", "email": "beta@corp.test"})
    res = client.get("/api/clients?q=beta")
    assert [c["name"] for c in res.get_json()] == ["Beta Corp"]


def test_create_client_validates_payload(client):
    res = client.post("/api/clients", json={"name": "", "email": "no-es-un-email"})
    assert res.status_code == 422
    details = res.get_json()["details"]
    assert "name" in details and "email" in details


def test_duplicate_email_is_rejected(client, customer):
    res = client.post("/api/clients", json={"name": "Otro", "email": customer["email"]})
    assert res.status_code == 409


def test_update_client(client, customer):
    res = client.put(
        f"/api/clients/{customer['id']}",
        json={"name": "Acme Renombrada", "email": customer["email"]},
    )
    assert res.status_code == 200
    assert res.get_json()["name"] == "Acme Renombrada"


def test_cannot_delete_client_with_invoices(client, customer, make_invoice):
    make_invoice()
    assert client.delete(f"/api/clients/{customer['id']}").status_code == 409


def test_delete_client_without_invoices(client, customer):
    assert client.delete(f"/api/clients/{customer['id']}").status_code == 204
    assert client.get(f"/api/clients/{customer['id']}").status_code == 404


def test_seed_command_is_idempotent(app):
    runner = app.test_cli_runner()
    assert "Cargados 2 clientes" in runner.invoke(args=["seed"]).output
    assert "ya tiene datos" in runner.invoke(args=["seed"]).output
