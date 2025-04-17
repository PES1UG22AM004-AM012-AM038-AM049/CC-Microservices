const mongoose = require('mongoose');
const { Schema } = mongoose;

// Course Content Schema
const courseContentSchema = new Schema({
  course_id: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  content_type: {
    type: String,
    required: true,
    enum: ['text', 'video', 'pdf', 'link', 'assignment'],
    default: 'text'
  },
  content_data: {
    type: Schema.Types.Mixed,
    required: true
  },
  author_id: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    default: 0
  },
  is_published: {
    type: Boolean,
    default: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Text schema example (to be stored in content_data for text type)
const textContentSchema = new Schema({
  text: String,
  format: {
    type: String,
    enum: ['plain', 'markdown', 'html'],
    default: 'plain'
  }
});

// Video schema example (to be stored in content_data for video type)
const videoContentSchema = new Schema({
  url: String,
  provider: String,
  duration: Number
});

// Link schema example (to be stored in content_data for link type)
const linkContentSchema = new Schema({
  url: String,
  description: String
});

// Assignment schema example (to be stored in content_data for assignment type)
const assignmentContentSchema = new Schema({
  description: String,
  due_date: Date,
  total_points: Number,
  questions: [Schema.Types.Mixed]
});

// Create model
const CourseContent = mongoose.model('CourseContent', courseContentSchema);

module.exports = {
  CourseContent
};
