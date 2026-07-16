from flask import Flask
from flask_cors import CORS

from .routes import api_bp


def create_app() -> Flask:
    app = Flask(__name__)
    
    # Configure CORS for production and development
    CORS(app, resources={
        r"/*": {
            "origins": [
                "https://stringscon.netlify.app",
                "http://localhost:5173",
                "http://localhost:3000",
                "127.0.0.1:5173",
                "http://137.158.61.235",
                "http://137.158.61.235:80",
            ],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type"],
            "supports_credentials": True
        }
    })

    app.register_blueprint(api_bp)

    @app.get('/health')
    def health_check():
        return {'status': 'ok'}

    return app
