"""
FarmtoClick – Flask application entry point.

This file only creates the app, wires up extensions, and registers
the route blueprints.  All business logic lives inside the ``routes/``
package and the helper modules (``db.py``, ``middleware.py``, ``helpers.py``).
"""
import os
from datetime import timedelta
from dotenv import load_dotenv

# Load .env file before anything reads os.environ
load_dotenv()

from flask import Flask, send_from_directory, request, make_response
from flask_cors import CORS
from flask_login import LoginManager
from mongoengine import connect

from config import config

# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

app = Flask(__name__)
app.config.from_object(config['development'])

# CORS ----------------------------------------------------------------
CORS(
    app,
    origins=[
        'http://localhost:3000', 'http://localhost:3001',
        'http://127.0.0.1:3000', 'http://127.0.0.1:3001',
    ],
    allow_headers=['Content-Type', 'Authorization'],
    expose_headers=['Content-Type', 'Authorization'],
    supports_credentials=True,
    methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    max_age=3600,
)

# JWT -----------------------------------------------------------------
app.config['JWT_SECRET_KEY'] = os.environ.get('SECRET_KEY')
app.config['JWT_ACCESS_TOKEN_EXPIRE'] = timedelta(hours=24)

# Session -------------------------------------------------------------
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)

# ---------------------------------------------------------------------------
# MongoEngine
# ---------------------------------------------------------------------------
try:
    connect(host=app.config['MONGODB_URI'])
    print("✅ Connected to MongoDB with MongoEngine!")
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")

# ---------------------------------------------------------------------------
# ML Verification System
# ---------------------------------------------------------------------------
try:
    from image_verification import ImageVerificationSystem
    verifier = ImageVerificationSystem()
    app.config['VERIFIER'] = verifier
    print("✅ ML Verification System initialized!")
except Exception as e:
    print(f"⚠️ Warning: ML Verification System failed to initialize: {e}")
    app.config['VERIFIER'] = None

# ---------------------------------------------------------------------------
# Flask-Login
# ---------------------------------------------------------------------------
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'
login_manager.login_message = 'Please log in to access this page.'
login_manager.login_message_category = 'info'


@login_manager.user_loader
def load_user(user_id):
    try:
        from user_model import User
        from db import get_mongodb_db
        db, _ = get_mongodb_db()
        if db is None:
            print("Error loading user: database unavailable")
            return None
        return User.get_by_id(db, user_id)
    except Exception as e:
        print(f"Error loading user: {e}")
        return None


# ---------------------------------------------------------------------------
# CORS Preflight Handler
# ---------------------------------------------------------------------------
@app.before_request
def handle_preflight():
    """Handle CORS preflight requests (OPTIONS) before authentication checks."""
    if request.method == 'OPTIONS':
        response = make_response('OK', 200)
        response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin', '*')
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = request.headers.get('Access-Control-Request-Headers', 'Content-Type, Authorization')
        response.headers['Access-Control-Max-Age'] = '3600'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response


# ---------------------------------------------------------------------------
# File upload folders (ensure they exist)
# ---------------------------------------------------------------------------
_BASE = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(_BASE, 'static', 'uploads', 'profiles')
VERIFICATION_UPLOAD_FOLDER = os.path.join(_BASE, 'static', 'uploads', 'verifications')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(VERIFICATION_UPLOAD_FOLDER, exist_ok=True)


@app.route('/uploads/profiles/<filename>')
def uploaded_profile_picture(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


# ---------------------------------------------------------------------------
# Landing page & static helpers (API only - frontend is React)
# ---------------------------------------------------------------------------
@app.route('/')
def landing():
    return {"message": "FarmtoClick API - Frontend served by React", "status": "running"}, 200


@app.route('/health')
def health_check():
    try:
        from db import get_mongodb_db
        db, _ = get_mongodb_db()
        if db is not None:
            db.command('ping')
            return {"status": "healthy", "database": "connected"}, 200
        return {"status": "unhealthy", "database": "disconnected"}, 503
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}, 503


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------
@app.errorhandler(404)
def not_found(e):
    return "<h1>404 Not Found</h1>", 404


@app.errorhandler(500)
def server_error(e):
    return "<h1>500 Server Error</h1>", 500


# ---------------------------------------------------------------------------
# Register Blueprints
# ---------------------------------------------------------------------------
from routes.auth import auth_bp
from routes.products import products_bp
from routes.cart import cart_bp
from routes.farmers import farmers_bp
from routes.orders import orders_bp
from routes.profile import profile_bp
from routes.admin import admin_bp
from routes.api import api_bp

app.register_blueprint(auth_bp)
app.register_blueprint(products_bp)
app.register_blueprint(cart_bp)
app.register_blueprint(farmers_bp)
app.register_blueprint(orders_bp)
app.register_blueprint(profile_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(api_bp)

# ---------------------------------------------------------------------------
# Test MongoEngine connection on startup
# ---------------------------------------------------------------------------
try:
    from models import User
    User.objects.limit(1).count()
    print("✅ Models imported & MongoDB connection verified!")
except Exception as e:
    print(f"❌ Model/DB test failed: {e}")

# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    print("🚀 Starting FarmtoClick...")
    print("🌐 Starting Flask server on http://127.0.0.1:5001")
    app.run(debug=True, host='0.0.0.0', port=5001, use_reloader=True)
