import requests
import json
import time
import logging
import os
from pprint import pprint

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Service URLs
STUDENT_ENROLLMENT_SERVICE = os.getenv("STUDENT_ENROLLMENT_SERVICE", "http://localhost:8000")
COURSE_REGISTRATION_SERVICE = os.getenv("COURSE_REGISTRATION_SERVICE", "http://localhost:5000")
USER_REGISTRATION_SERVICE = os.getenv("USER_REGISTRATION_SERVICE", "http://localhost:8002")
CONTENT_DELIVERY_SERVICE = os.getenv("CONTENT_DELIVERY_SERVICE", "http://localhost:3000")

def test_health_endpoints():
    """Test the health endpoints of all microservices"""
    services = {
        "Student Enrollment": f"{STUDENT_ENROLLMENT_SERVICE}/health",
        "Course Registration": f"{COURSE_REGISTRATION_SERVICE}/health",
        "User Registration": f"{USER_REGISTRATION_SERVICE}/health",
        "Content Delivery": f"{CONTENT_DELIVERY_SERVICE}/health"
    }

    all_healthy = True

    for service_name, url in services.items():
        try:
            response = requests.get(url)
            if response.status_code == 200 and response.json().get("status") == "healthy":
                logger.info(f"✅ {service_name} service is healthy")
            else:
                logger.error(f"❌ {service_name} service is not healthy. Status: {response.status_code}")
                all_healthy = False
        except requests.RequestException as e:
            logger.error(f"❌ Could not connect to {service_name} service: {str(e)}")
            all_healthy = False

    if all_healthy:
        logger.info("All services are healthy!")
    else:
        logger.warning("Some services are not responding. Please check their status.")

    return all_healthy

def test_user_logins():
    """Test login for multiple users and validate integration with User Registration Service"""
    users = [
        {
            "username": "admin_test",
            "password": "AdminPass@123",
            "email": "admin_test@example.com",
            "first_name": "Alice",
            "last_name": "Admin",
            "role": "admin"
        },
        {
            "username": "instructor_test",
            "password": "InstructorPass@123",
            "email": "instructor_test@example.com",
            "first_name": "Bob",
            "last_name": "Instructor",
            "role": "instructor"
        }
    ]

    logger.info("🔐 Testing user registrations and logins...")

    for user in users:
        try:
            # Attempt to register
            response = requests.post(f"{USER_REGISTRATION_SERVICE}/register-user", json=user)
            assert response.status_code in (201, 409), f"{user['username']}: Unexpected status code {response.status_code}"

            if response.status_code == 409:
                logger.info(f"{user['username']} already exists. Attempting login...")
            else:
                logger.info(f"{user['username']} registered successfully.")

            # Attempt login
            login_data = {"username": user["username"], "password": user["password"]}
            login_response = requests.post(f"{USER_REGISTRATION_SERVICE}/login", json=login_data)
            assert login_response.status_code == 200, f"{user['username']}: Login failed - {login_response.json()}"
            logger.info(f"✅ Login successful for {user['username']}. user_id: {login_response.json().get('user_id')}")

        except requests.RequestException as e:
            logger.error(f"❌ Error during registration/login for {user['username']}: {str(e)}")
        except AssertionError as e:
            logger.error(f"❌ Assertion failed for {user['username']}: {str(e)}")

def test_complete_flow():
    """Test the complete flow from user registration to content delivery"""
    # Step 1: Register an admin user
    admin_data = {
        "username": "admin_user",
        "password": "Admin@123",
        "email": "admin@example.com",
        "first_name": "Admin",
        "last_name": "User",
        "role": "admin"
    }

    logger.info("1. Registering admin user...")
    try:
        admin_response = requests.post(f"{USER_REGISTRATION_SERVICE}/register-user", json=admin_data)
        assert admin_response.status_code in (201, 409), f"Expected status 201 or 409, got {admin_response.status_code}"

        if admin_response.status_code == 409:
            logger.info("Admin user already exists, attempting login...")
            login_response = requests.post(f"{USER_REGISTRATION_SERVICE}/login",
                                           json={"username": admin_data["username"], "password": admin_data["password"]})
            assert login_response.status_code == 200, f"Login failed: {login_response.json()}"
            admin_id = login_response.json()["user_id"]
            logger.info(f"Admin login successful, user_id: {admin_id}")
        else:
            admin_id = admin_response.json()["user_id"]
            logger.info(f"Admin user registered successfully, user_id: {admin_id}")

    except requests.RequestException as e:
        logger.error(f"Failed to register admin user: {str(e)}")
        return False
    except AssertionError as e:
        logger.error(f"Admin registration assertion failed: {str(e)}")
        return False

    # Step 2: Register an instructor
    instructor_data = {
        "username": "instructor_user",
        "password": "Instructor@123",
        "email": "instructor@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "role": "instructor"
    }

    logger.info("2. Registering instructor user...")
    try:
        instructor_response = requests.post(f"{USER_REGISTRATION_SERVICE}/register-user", json=instructor_data)
        assert instructor_response.status_code in (201, 409), f"Expected status 201 or 409, got {instructor_response.status_code}"

        if instructor_response.status_code == 409:
            logger.info("Instructor user already exists, attempting login...")
            login_response = requests.post(f"{USER_REGISTRATION_SERVICE}/login",
                                           json={"username": instructor_data["username"], "password": instructor_data["password"]})
            assert login_response.status_code == 200, f"Login failed: {login_response.json()}"
            instructor_id = login_response.json()["user_id"]
            logger.info(f"Instructor login successful, user_id: {instructor_id}")
        else:
            instructor_id = instructor_response.json()["user_id"]
            logger.info(f"Instructor user registered successfully, user_id: {instructor_id}")

    except requests.RequestException as e:
        logger.error(f"Failed to register instructor user: {str(e)}")
        return False
    except AssertionError as e:
        logger.error(f"Instructor registration assertion failed: {str(e)}")
        return False

    # Step 3: Enroll a student
    student_data = {
        "first_name": "Jane",
        "last_name": "Smith",
        "email": "jane.smith@example.com",
        "date_of_birth": "1995-05-15",
        "phone": "123-456-7890"
    }

    logger.info("3. Enrolling a student...")
    try:
        student_response = requests.post(f"{STUDENT_ENROLLMENT_SERVICE}/enroll", json=student_data)
        assert student_response.status_code in (201, 409), f"Expected status 201 or 409, got {student_response.status_code}"

        if student_response.status_code == 409:
            student_id = student_response.json()["student_id"]
            logger.info(f"Student already enrolled, student_id: {student_id}")
        else:
            student_id = student_response.json()["student_id"]
            logger.info(f"Student enrolled successfully, student_id: {student_id}")

    except requests.RequestException as e:
        logger.error(f"Failed to enroll student: {str(e)}")
        return False
    except AssertionError as e:
        logger.error(f"Student enrollment assertion failed: {str(e)}")
        return False

    # Step 4: Create a course
    course_data = {
        "title": "Introduction to Microservices",
        "description": "Learn how to build and deploy microservices architecture",
        "code": "CS-301",
        "capacity": 30,
        "start_date": "2023-01-15",
        "end_date": "2023-05-15"
    }

    logger.info("4. Creating a course...")
    try:
        course_response = requests.post(f"{COURSE_REGISTRATION_SERVICE}/courses", json=course_data)
        assert course_response.status_code in (201, 409), f"Expected status 201 or 409, got {course_response.status_code}"

        if course_response.status_code == 409:
            course_id = course_response.json().get("course_id")
            if not course_id:
                courses_response = requests.get(f"{COURSE_REGISTRATION_SERVICE}/courses")
                courses = courses_response.json().get("courses", [])
                for course in courses:
                    if course.get("code") == course_data["code"]:
                        course_id = course.get("id")
                        break
            logger.info(f"Course already exists, course_id: {course_id}")
        else:
            course_id = course_response.json()["course_id"]
            logger.info(f"Course created successfully, course_id: {course_id}")

    except requests.RequestException as e:
        logger.error(f"Failed to create course: {str(e)}")
        return False
    except AssertionError as e:
        logger.error(f"Course creation assertion failed: {str(e)}")
        return False

    # Step 5: Register student for the course
    registration_data = {
        "student_id": student_id,
        "course_id": course_id
    }

    logger.info("5. Registering student for the course...")
    try:
        registration_response = requests.post(f"{COURSE_REGISTRATION_SERVICE}/register", json=registration_data)
        assert registration_response.status_code in (201, 409), f"Expected status 201 or 409, got {registration_response.status_code}"

        if registration_response.status_code == 409:
            logger.info(f"Student already registered for this course")
        else:
            logger.info(f"Student registered successfully for the course")

    except requests.RequestException as e:
        logger.error(f"Failed to register student for course: {str(e)}")
        return False
    except AssertionError as e:
        logger.error(f"Course registration assertion failed: {str(e)}")
        return False

    # Step 6: Create course content
    content_data = {
    "course_id": "CS-301",
    "title": "Microservices Basics",
    "content_type": "text",
    "content_data": "This is the first lesson on Microservices.",
    "author_id": 2,
    "is_published": True,
    "order": 1
}


    logger.info("6. Creating course content...")
    try:
        content_response = requests.post(f"{CONTENT_DELIVERY_SERVICE}/content", json=content_data)
        assert content_response.status_code == 201, f"Expected status 201, got {content_response.status_code}"

        content_id = content_response.json()["content_id"]
        logger.info(f"Course content created successfully, content_id: {content_id}")

    except requests.RequestException as e:
        logger.error(f"Failed to create course content: {str(e)}")
        return False
    except AssertionError as e:
        logger.error(f"Content creation assertion failed: {str(e)}")
        return False

    # Step 7: Retrieve content as a student
    # logger.info("7. Retrieving content as a student...")
    # try:
    #     content_retrieval_response = requests.get(
    #         f"{CONTENT_DELIVERY_SERVICE}/get-content?student_id={student_id}&course_id={course_id}"
    #     )
    #     assert content_retrieval_response.status_code == 200, f"Expected status 200, got {content_retrieval_response.status_code}"

    #     content = content_retrieval_response.json().get("content", [])
    #     assert len(content) > 0, "No content retrieved"

    #     logger.info(f"Retrieved {len(content)} content items for the student")

    # except requests.RequestException as e:
    #     logger.error(f"Failed to retrieve content: {str(e)}")
    #     return False
    # except AssertionError as e:
    #     logger.error(f"Content retrieval assertion failed: {str(e)}")
    #     return False

    logger.info("✅ Complete flow test successful!")
    return True

if __name__ == "__main__":
    logger.info("🚀 Testing Course Delivery Management System...")

    if test_health_endpoints():
        test_user_logins()  # New user login test step
        test_complete_flow()
    else:
        logger.error("❌ Service health check failed. Please ensure all microservices are running.")

