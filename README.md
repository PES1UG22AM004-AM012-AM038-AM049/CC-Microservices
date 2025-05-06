# Course Delivery Management System

## Team Name : PES1UG22AM004_012_038_049

Contributers : 

1. B C Samrudh
2. Abhimanyu Suresh
3. Aditya G H
4. Charan S K


A microservices-based system for managing course enrollment, registration, user management, and content delivery.

## Architecture

The system consists of four microservices:

1. **Student Enrollment Service** (Python/Flask)
   - Manages student enrollment
   - Stores student data in PostgreSQL

2. **Course Registration Service** (Node.js/Express)
   - Manages course registration
   - Allows students to register for courses
   - Stores registration data in PostgreSQL

3. **User Registration Service** (Python/Flask)
   - Handles registration for instructors and administrators
   - Manages user roles
   - Stores user data in PostgreSQL

4. **Content Delivery Service** (Node.js/Express)
   - Distributes course content to students
   - Stores course materials in MongoDB

## Prerequisites

- Python 3.8+
- Node.js 14+
- PostgreSQL
- MongoDB
