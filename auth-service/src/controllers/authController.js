const bcrypt = require('bcrypt');
const jwt = require('../services/jwt');
const User = require('../models/User');

exports.signup = async (req, res) => {
  try {
    const { name, email, password, userType } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ name, email, password: hashedPassword, userType });

    const token = jwt.generateToken({ userId: newUser._id, userType: newUser.userType });
    res.status(201).json({ token, userType: newUser.userType, userId: newUser._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.generateToken({ userId: user._id, userType: user.userType });
    res.json({ token, userType: user.userType, userId: user._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
