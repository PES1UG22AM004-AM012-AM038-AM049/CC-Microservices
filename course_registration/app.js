const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const { Registration, Course } = require('./models');

const app = express();
app.use(express.json());

// Environment variables
const PORT = process.env.PORT || 5000;
const STUDENT_ENROLLMENT_SERVICE = process.env.STUDENT_ENROLLMENT_SERVICE || 'http://localhost:8000';

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Course Registration Microservice' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Create a new course
app.post('/courses', async (req, res) => {
  try {
    const { title, description, code, capacity, start_date, end_date } = req.body;

    if (!title || !code) {
      return res.status(400).json({ error: 'Title and course code are required' });
    }

    const existingCourse = await Course.findOne({ code });
    if (existingCourse) {
      return res.status(409).json({
        error: 'Course with this code already exists',
        course_id: existingCourse._id
      });
    }

    const newCourse = await Course.create({
      title,
      description,
      code,
      capacity: capacity || 30,
      start_date,
      end_date
    });

    return res.status(201).json({
      message: 'Course created successfully',
      course_id: newCourse._id,
      course: newCourse
    });
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ error: 'Failed to create course', details: error.message });
  }
});

// Get all courses
app.get('/courses', async (req, res) => {
  try {
    const courses = await Course.find();
    res.status(200).json({ courses });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses', details: error.message });
  }
});

// Get course by ID
app.get('/courses/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.status(200).json(course);
  } catch (error) {
    console.error(`Error fetching course ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch course', details: error.message });
  }
});

// Register a student
app.post('/register', async (req, res) => {
  try {
    const { student_id, course_id } = req.body;

    if (!student_id || !course_id) {
      return res.status(400).json({ error: 'Student ID and Course ID are required' });
    }

    try {
      const studentResponse = await axios.get(`${STUDENT_ENROLLMENT_SERVICE}/validate/${student_id}`);
      if (!studentResponse.data.valid) {
        return res.status(404).json({ error: 'Student not found or invalid' });
      }
    } catch (error) {
      console.error('Error validating student:', error.message);
      return res.status(404).json({ error: 'Student validation failed', details: error.message });
    }

    const course = await Course.findById(course_id);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const existingRegistration = await Registration.findOne({ student_id, course_id });
    if (existingRegistration) {
      return res.status(409).json({
        error: 'Student already registered for this course',
        registration_id: existingRegistration._id
      });
    }

    const registrationCount = await Registration.countDocuments({ course_id });
    if (course.capacity && registrationCount >= course.capacity) {
      return res.status(400).json({ error: 'Course has reached maximum capacity' });
    }

    const registration = await Registration.create({
      student_id,
      course_id,
      status: 'active',
      registration_date: new Date()
    });

    res.status(201).json({
      message: 'Registration successful',
      registration_id: registration._id,
      student_id,
      course_id,
      course_title: course.title
    });
  } catch (error) {
    console.error('Error registering for course:', error);
    res.status(500).json({ error: 'Failed to register for course', details: error.message });
  }
});

// Get student registrations
app.get('/registrations/student/:student_id', async (req, res) => {
  try {
    const studentId = req.params.student_id;

    try {
      await axios.get(`${STUDENT_ENROLLMENT_SERVICE}/validate/${studentId}`);
    } catch (error) {
      console.error('Error validating student:', error.message);
    }

    const registrations = await Registration.find({ student_id: studentId }).populate('course_id');

    res.status(200).json({
      student_id: studentId,
      registrations: registrations.map(reg => ({
        id: reg._id,
        course_id: reg.course_id?._id,
        status: reg.status,
        registration_date: reg.registration_date,
        course: reg.course_id ? {
          title: reg.course_id.title,
          code: reg.course_id.code
        } : null
      }))
    });
  } catch (error) {
    console.error(`Error fetching registrations for student ${req.params.student_id}:`, error);
    res.status(500).json({ error: 'Failed to fetch registrations', details: error.message });
  }
});

// Get course registrations
app.get('/registrations/course/:course_id', async (req, res) => {
  try {
    const courseId = req.params.course_id;
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const registrations = await Registration.find({ course_id: courseId });

    res.status(200).json({
      course_id: courseId,
      course_title: course.title,
      registrations: registrations.map(reg => ({
        id: reg._id,
        student_id: reg.student_id,
        status: reg.status,
        registration_date: reg.registration_date
      }))
    });
  } catch (error) {
    console.error(`Error fetching registrations for course ${req.params.course_id}:`, error);
    res.status(500).json({ error: 'Failed to fetch registrations', details: error.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Course Registration service listening on port ${PORT}`);
});

module.exports = app;
