const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const { CourseContent } = require('./models');

const app = express();
app.use(express.json());

// Environment variables
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI;
const COURSE_REGISTRATION_SERVICE = process.env.COURSE_REGISTRATION_SERVICE || 'http://localhost:5000';
const USER_REGISTRATION_SERVICE = process.env.USER_REGISTRATION_SERVICE || 'http://localhost:8000';
const STUDENT_ENROLLMENT_SERVICE = process.env.STUDENT_ENROLLMENT_SERVICE || 'http://localhost:8002';

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Route for service health check
app.get('/', (req, res) => {
  res.json({ message: 'Content Delivery Microservice' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Create course content
app.post('/content', async (req, res) => {
  try {
    const { course_id, title, content_type, content_data, author_id } = req.body;
    
    // Validate required fields
    if (!course_id || !title || !content_type || !content_data || !author_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: course_id, title, content_type, content_data, and author_id are required' 
      });
    }
    
    // Validate content type
    const validContentTypes = ['text', 'video', 'pdf', 'link', 'assignment'];
    if (!validContentTypes.includes(content_type)) {
      return res.status(400).json({ 
        error: `Invalid content type. Must be one of: ${validContentTypes.join(', ')}` 
      });
    }
    
    // Validate author is an instructor or admin
    try {
      const userResponse = await axios.get(`${USER_REGISTRATION_SERVICE}/validate/${author_id}`);
      if (!userResponse.data.valid) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Check user role
      if (userResponse.data.role !== 'instructor' && userResponse.data.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Only instructors and administrators can create content' 
        });
      }
    } catch (error) {
      console.error('Error validating user:', error.message);
      return res.status(500).json({ 
        error: 'Failed to validate user', 
        details: error.response?.data?.error || error.message 
      });
    }
    
    // Check if course exists by calling Course Registration Service
    try {
      await axios.get(`${COURSE_REGISTRATION_SERVICE}/courses/${course_id}`);
      // If no error, course exists
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return res.status(404).json({ error: 'Course not found' });
      }
      console.error('Error verifying course:', error.message);
      // Continue anyway to avoid dependency issues
    }
    
    // Create new content
    const newContent = new CourseContent({
      course_id,
      title,
      content_type,
      content_data,
      author_id,
      order: req.body.order || 0,
      is_published: req.body.is_published !== undefined ? req.body.is_published : true
    });
    
    await newContent.save();
    
    console.log(`Content created: ${newContent._id}`);
    
    return res.status(201).json({
      message: 'Content created successfully',
      content_id: newContent._id,
      content: newContent
    });
  } catch (error) {
    console.error('Error creating content:', error);
    return res.status(500).json({ 
      error: 'Failed to create content', 
      details: error.message 
    });
  }
});

// Get course content by ID
app.get('/content/:content_id', async (req, res) => {
  try {
    const content = await CourseContent.findById(req.params.content_id);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    return res.status(200).json(content);
  } catch (error) {
    console.error(`Error fetching content ${req.params.content_id}:`, error);
    return res.status(500).json({ 
      error: 'Failed to fetch content', 
      details: error.message 
    });
  }
});

// Get all content for a course
app.get('/course/:course_id/content', async (req, res) => {
  try {
    const courseId = req.params.course_id;
    
    // Verify course exists (could be skipped if performance is an issue)
    try {
      await axios.get(`${COURSE_REGISTRATION_SERVICE}/courses/${courseId}`);
      // If no error, course exists
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return res.status(404).json({ error: 'Course not found' });
      }
      console.error('Error verifying course:', error.message);
      // Continue anyway to avoid dependency issues
    }
    
    // Get published content by default
    const publishedOnly = req.query.published !== 'false';
    
    const query = { 
      course_id: courseId 
    };
    
    if (publishedOnly) {
      query.is_published = true;
    }
    
    const content = await CourseContent.find(query).sort({ order: 1 });
    
    return res.status(200).json({
      course_id: courseId,
      content_count: content.length,
      content
    });
  } catch (error) {
    console.error(`Error fetching content for course ${req.params.course_id}:`, error);
    return res.status(500).json({ 
      error: 'Failed to fetch course content', 
      details: error.message 
    });
  }
});

// Get content for a student (with verification)
app.get('/get-content', async (req, res) => {
  try {
    const { student_id, course_id } = req.query;
    
    if (!student_id || !course_id) {
      return res.status(400).json({ 
        error: 'student_id and course_id are required query parameters' 
      });
    }
    
    // Validate student exists
    try {
      const studentResponse = await axios.get(`${STUDENT_ENROLLMENT_SERVICE}/validate/${student_id}`);
      if (!studentResponse.data.valid) {
        return res.status(404).json({ error: 'Student not found' });
      }
    } catch (error) {
      console.error('Error validating student:', error.message);
      return res.status(404).json({ 
        error: 'Student validation failed', 
        details: error.response?.data?.error || error.message 
      });
    }
    
    // Verify student is registered for the course
    try {
      const registrationResponse = await axios.get(
        `${COURSE_REGISTRATION_SERVICE}/registrations/student/${student_id}`
      );
      
      const registrations = registrationResponse.data.registrations || [];
      const isRegistered = registrations.some(reg => 
        reg.course_id.toString() === course_id && reg.status === 'active'
      );
      
      if (!isRegistered) {
        return res.status(403).json({ 
          error: 'Student is not registered for this course or registration is not active' 
        });
      }
    } catch (error) {
      console.error('Error verifying course registration:', error.message);
      return res.status(500).json({ 
        error: 'Failed to verify course registration', 
        details: error.response?.data?.error || error.message 
      });
    }
    
    // Get published content only for students
    const content = await CourseContent.find({
      course_id,
      is_published: true
    }).sort({ order: 1 });
    
    return res.status(200).json({
      student_id,
      course_id,
      content_count: content.length,
      content
    });
  } catch (error) {
    console.error('Error getting content for student:', error);
    return res.status(500).json({ 
      error: 'Failed to get content', 
      details: error.message 
    });
  }
});

// Update course content
app.put('/content/:content_id', async (req, res) => {
  try {
    const contentId = req.params.content_id;
    const { title, content_type, content_data, is_published, order } = req.body;
    const author_id = req.body.author_id;
    
    // Validate that content exists
    const content = await CourseContent.findById(contentId);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    // If author_id is provided, validate author permissions
    if (author_id) {
      try {
        const userResponse = await axios.get(`${USER_REGISTRATION_SERVICE}/validate/${author_id}`);
        if (!userResponse.data.valid) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        // Check user role
        if (userResponse.data.role !== 'instructor' && userResponse.data.role !== 'admin') {
          return res.status(403).json({ 
            error: 'Only instructors and administrators can update content' 
          });
        }
      } catch (error) {
        console.error('Error validating user:', error.message);
        return res.status(500).json({ 
          error: 'Failed to validate user', 
          details: error.response?.data?.error || error.message 
        });
      }
    }
    
    // Update the content
    const updatedContent = await CourseContent.findByIdAndUpdate(
      contentId,
      {
        ...(title && { title }),
        ...(content_type && { content_type }),
        ...(content_data && { content_data }),
        ...(is_published !== undefined && { is_published }),
        ...(order !== undefined && { order }),
        ...(author_id && { author_id }),
        updated_at: new Date()
      },
      { new: true }
    );
    
    console.log(`Content updated: ${contentId}`);
    
    return res.status(200).json({
      message: 'Content updated successfully',
      content: updatedContent
    });
  } catch (error) {
    console.error(`Error updating content ${req.params.content_id}:`, error);
    return res.status(500).json({ 
      error: 'Failed to update content', 
      details: error.message 
    });
  }
});

// Delete course content
app.delete('/content/:content_id', async (req, res) => {
  try {
    const contentId = req.params.content_id;
    const author_id = req.query.author_id;
    
    if (!author_id) {
      return res.status(400).json({ 
        error: 'author_id is required as a query parameter' 
      });
    }
    
    // Validate that content exists
    const content = await CourseContent.findById(contentId);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    // Validate user permissions
    try {
      const userResponse = await axios.get(`${USER_REGISTRATION_SERVICE}/validate/${author_id}`);
      if (!userResponse.data.valid) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Check user role (only creator or admin can delete)
      const isAuthor = content.author_id.toString() === author_id;
      const isAdmin = userResponse.data.role === 'admin';
      
      if (!isAuthor && !isAdmin) {
        return res.status(403).json({ 
          error: 'Only the content creator or administrators can delete content' 
        });
      }
    } catch (error) {
      console.error('Error validating user:', error.message);
      return res.status(500).json({ 
        error: 'Failed to validate user', 
        details: error.response?.data?.error || error.message 
      });
    }
    
    // Delete the content
    await CourseContent.findByIdAndDelete(contentId);
    
    console.log(`Content deleted: ${contentId}`);
    
    return res.status(200).json({
      message: 'Content deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting content ${req.params.content_id}:`, error);
    return res.status(500).json({ 
      error: 'Failed to delete content', 
      details: error.message 
    });
  }
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Content Delivery service listening on port ${PORT}`);
});

module.exports = app;
