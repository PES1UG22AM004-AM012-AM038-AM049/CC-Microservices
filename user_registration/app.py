import os
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from models import db, User
import logging
from werkzeug.security import generate_password_hash, check_password_hash

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Configure database
database_url = os.getenv("DATABASE_URL")
app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}

# Initialize database
db.init_app(app)

# Create tables
with app.app_context():
    db.create_all()

@app.route('/')
def index():
    return jsonify({"message": "User Registration Microservice"})

@app.route('/health')
def health():
    return jsonify({"status": "healthy"})

@app.route('/register-user', methods=['POST'])
def register_user():
    """
    Register a new user (instructor or administrator)
    Expected JSON payload:
    {
        "username": "string",
        "password": "string",
        "email": "string",
        "first_name": "string",
        "last_name": "string",
        "role": "instructor" or "admin"
    }
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ["username", "password", "email", "role"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Validate role
        valid_roles = ["instructor", "admin"]
        if data["role"] not in valid_roles:
            return jsonify({"error": f"Invalid role. Must be one of: {', '.join(valid_roles)}"}), 400
        
        # Check if username already exists
        existing_user = User.query.filter_by(username=data["username"]).first()
        if existing_user:
            return jsonify({"error": "Username already exists"}), 409
        
        # Check if email already exists
        existing_email = User.query.filter_by(email=data["email"]).first()
        if existing_email:
            return jsonify({"error": "Email already registered"}), 409
        
        # Hash the password
        hashed_password = generate_password_hash(data["password"])
        
        # Create new user
        new_user = User(
            username=data["username"],
            password_hash=hashed_password,
            email=data["email"],
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
            role=data["role"]
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        logger.info(f"User registered: {new_user.id} (Role: {new_user.role})")
        
        return jsonify({
            "message": "User registered successfully",
            "user_id": new_user.id,
            "username": new_user.username,
            "role": new_user.role
        }), 201
        
    except Exception as e:
        logger.error(f"Error registering user: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Failed to register user", "details": str(e)}), 500

@app.route('/login', methods=['POST'])
def login():
    """
    Authenticate a user
    Expected JSON payload:
    {
        "username": "string",
        "password": "string"
    }
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ["username", "password"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Find user by username
        user = User.query.filter_by(username=data["username"]).first()
        if not user:
            return jsonify({"error": "Invalid username or password"}), 401
        
        # Verify password
        if not check_password_hash(user.password_hash, data["password"]):
            return jsonify({"error": "Invalid username or password"}), 401
        
        logger.info(f"User login successful: {user.id}")
        
        return jsonify({
            "message": "Login successful",
            "user_id": user.id,
            "username": user.username,
            "role": user.role
        }), 200
        
    except Exception as e:
        logger.error(f"Error during login: {str(e)}")
        return jsonify({"error": "Login failed", "details": str(e)}), 500

@app.route('/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    """Get user details by ID"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        return jsonify({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "created_at": user.created_at.isoformat() if user.created_at else None
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrieving user {user_id}: {str(e)}")
        return jsonify({"error": "Failed to retrieve user", "details": str(e)}), 500

@app.route('/users', methods=['GET'])
def list_users():
    """List all users (with optional role filter)"""
    try:
        role = request.args.get('role')
        
        if role:
            users = User.query.filter_by(role=role).all()
        else:
            users = User.query.all()
        
        result = []
        for user in users:
            result.append({
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role
            })
        
        return jsonify({"users": result}), 200
        
    except Exception as e:
        logger.error(f"Error listing users: {str(e)}")
        return jsonify({"error": "Failed to retrieve users", "details": str(e)}), 500

@app.route('/validate/<int:user_id>', methods=['GET'])
def validate_user(user_id):
    """Validate if a user exists and get their role - used by other microservices"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({"valid": False, "error": "User not found"}), 404
        
        return jsonify({
            "valid": True,
            "user_id": user.id,
            "username": user.username,
            "role": user.role
        }), 200
        
    except Exception as e:
        logger.error(f"Error validating user {user_id}: {str(e)}")
        return jsonify({"valid": False, "error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8002, debug=True)
