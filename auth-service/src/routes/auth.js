const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');

// Sign up for Student
router.post('/signup/student', async (req, res) => {
  const { name, email, password, parentEmail } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Student already exists' });

    const parent = await User.findOne({ email: parentEmail, role: 'parent' });
    if (!parent) return res.status(404).json({ error: 'Parent not found. Ask them to sign up first.' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const studentUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'student'
    });

    const studentProfile = await Student.create({
      user: studentUser._id,
      parent: parent._id
    });

    res.status(201).json({ message: 'Student signed up and linked to parent', studentId: studentProfile._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sign up for Parent
router.post('/signup/parent', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Parent already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const parent = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'parent'
    });

    res.status(201).json({ message: 'Parent account created', parentId: parent._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login for Parent/Student
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find the user by email (this will check both parent and student roles)
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check if the password is correct
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' } // expires in 1 hour
    );

    // Send back the token to the user
    res.status(200).json({ message: 'Login successful', token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
