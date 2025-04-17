import os
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from models import db, Student
import logging
from datetime import datetime

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
    return jsonify({"message": "Student Enrollment Microservice"})

@app.route('/health')
def health():
    return jsonify({"status": "healthy"})

@app.route('/enroll', methods=['POST'])
def enroll_student():
    """
    Enroll a new student in the system
    Expected JSON payload:
    {
        "first_name": "string",
        "last_name": "string",
        "email": "string",
        "date_of_birth": "YYYY-MM-DD",
        "phone": "string"
    }
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ["first_name", "last_name", "email", "date_of_birth"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Check if student already exists
        existing_student = Student.query.filter_by(email=data["email"]).first()
        if existing_student:
            return jsonify({"error": "Student with this email already exists", "student_id": existing_student.id}), 409
        
        # Create new student
        try:
            # Parse date of birth
            dob = datetime.strptime(data["date_of_birth"], "%Y-%m-%d").date()
            
            new_student = Student(
                first_name=data["first_name"],
                last_name=data["last_name"],
                email=data["email"],
                date_of_birth=dob,
                phone=data.get("phone", "")
            )
            
            db.session.add(new_student)
            db.session.commit()
            
            logger.info(f"Student enrolled: {new_student.id}")
            
            return jsonify({
                "message": "Student enrolled successfully",
                "student_id": new_student.id
            }), 201
            
        except ValueError:
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
            
    except Exception as e:
        logger.error(f"Error enrolling student: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Failed to enroll student", "details": str(e)}), 500

@app.route('/students/<int:student_id>', methods=['GET'])
def get_student(student_id):
    """Get student details by ID"""
    try:
        student = Student.query.get(student_id)
        if not student:
            return jsonify({"error": "Student not found"}), 404
        
        return jsonify({
            "id": student.id,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "email": student.email,
            "date_of_birth": student.date_of_birth.strftime("%Y-%m-%d") if student.date_of_birth else None,
            "phone": student.phone,
            "created_at": student.created_at.isoformat() if student.created_at else None
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrieving student {student_id}: {str(e)}")
        return jsonify({"error": "Failed to retrieve student", "details": str(e)}), 500

@app.route('/students', methods=['GET'])
def list_students():
    """List all enrolled students"""
    try:
        students = Student.query.all()
        result = []
        
        for student in students:
            result.append({
                "id": student.id,
                "first_name": student.first_name,
                "last_name": student.last_name,
                "email": student.email
            })
        
        return jsonify({"students": result}), 200
        
    except Exception as e:
        logger.error(f"Error listing students: {str(e)}")
        return jsonify({"error": "Failed to retrieve students", "details": str(e)}), 500

@app.route('/validate/<int:student_id>', methods=['GET'])
def validate_student(student_id):
    """Validate if a student exists - used by other microservices"""
    try:
        student = Student.query.get(student_id)
        if not student:
            return jsonify({"valid": False, "error": "Student not found"}), 404
        
        return jsonify({
            "valid": True,
            "student_id": student.id,
            "name": f"{student.first_name} {student.last_name}",
            "email": student.email
        }), 200
        
    except Exception as e:
        logger.error(f"Error validating student {student_id}: {str(e)}")
        return jsonify({"valid": False, "error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
