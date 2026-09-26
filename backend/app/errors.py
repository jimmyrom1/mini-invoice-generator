from flask import Flask, jsonify
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import HTTPException

from .extensions import db


class ConflictError(Exception):
    """Operación válida sintácticamente pero incompatible con el estado actual."""


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(ValidationError)
    def handle_validation(err: ValidationError):
        return jsonify(error="validation_error", details=err.messages), 422

    @app.errorhandler(ConflictError)
    def handle_conflict(err: ConflictError):
        return jsonify(error="conflict", message=str(err)), 409

    @app.errorhandler(IntegrityError)
    def handle_integrity(err: IntegrityError):
        db.session.rollback()
        return jsonify(error="conflict", message="Violación de integridad de datos"), 409

    @app.errorhandler(HTTPException)
    def handle_http(err: HTTPException):
        return jsonify(error=err.name.lower().replace(" ", "_"), message=err.description), err.code
