from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

from .firebase_admin_init import init_firebase_admin
from .routes import api_bp

load_dotenv()


def create_app() -> Flask:
    app = Flask(__name__)
    
    # Configure CORS for production and development.
    #
    # In production Nginx serves the built frontend and proxies /api to Flask
    # on the same origin, so CORS does not normally engage at all. These
    # origins matter only when the frontend is built with an explicit
    # VITE_API_BASE_URL pointing at another host — the hostname is listed
    # alongside its IP so that case does not silently break.
    CORS(app, resources={
        r"/*": {
            "origins": [
                "http://string-1.cs.uct.ac.za",
                "https://string-1.cs.uct.ac.za",
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

    init_firebase_admin()

    app.register_blueprint(api_bp)

    @app.get('/health')
    def health_check():
        return {'status': 'ok'}

    return app
