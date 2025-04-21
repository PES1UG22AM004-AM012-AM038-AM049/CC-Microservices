const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  status: { type: String, enum: ['Present', 'Absent'], required: true }
});

const marksSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  exam: { type: String, required: true }, // e.g., "Mid Term", "Final", "Unit Test 1"
  score: { type: Number, required: true },
  outOf: { type: Number, required: true }
});

const ptmSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  notes: String,
  attended: { type: Boolean, default: false }
});

const studentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // student's auth info
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // link to parent
  attendance: [attendanceSchema],
  marks: [marksSchema],
  ptm: [ptmSchema]
});

module.exports = mongoose.model('Student', studentSchema);
