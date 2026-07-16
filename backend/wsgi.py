"""WSGI entry point for production deployment with Gunicorn"""
import sys
from pathlib import Path

# Add the app directory to Python path
app_dir = Path(__file__).parent
sys.path.insert(0, str(app_dir))

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run()
