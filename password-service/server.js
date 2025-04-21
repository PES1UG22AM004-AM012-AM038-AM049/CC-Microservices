const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const passwordRoutes = require('./routes/passwordRoutes');

dotenv.config();

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/api/password', passwordRoutes);

// Connect to MongoDB and start the server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(process.env.PORT, () => {
      console.log(`Password service running on port ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection error:', err);
  });
