import os


class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", "postgresql+psycopg://invoices:invoices@localhost:5432/invoices"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    COMPANY = {
        "name": os.getenv("COMPANY_NAME", "Mi Empresa S.L."),
        "tax_id": os.getenv("COMPANY_TAX_ID", "B12345678"),
        "address": os.getenv("COMPANY_ADDRESS", "Calle Mayor 1, 28001 Madrid"),
    }


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "TEST_DATABASE_URL",
        "postgresql+psycopg://invoices:invoices@localhost:5432/invoices_test",
    )
