from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

from .cli import register_cli
from .config import Config
from .errors import register_error_handlers
from .extensions import db, migrate


def create_app(config_class: type[Config] = Config) -> Flask:
    load_dotenv()
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    from .routes.clients import bp as clients_bp
    from .routes.health import bp as health_bp
    from .routes.invoices import bp as invoices_bp

    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(clients_bp, url_prefix="/api/clients")
    app.register_blueprint(invoices_bp, url_prefix="/api/invoices")

    register_error_handlers(app)
    register_cli(app)
    return app
