require('dotenv').config();
const express = require('express');
const connectDB = require('./utils/db');
const passwordRoutes = require('./routes/password');

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/api/password', passwordRoutes);

// Connect to database and start server
connectDB().then(() => {
  app.listen(process.env.PORT, () => {
    console.log(`Password service running on port ${process.env.PORT}`);
  });
});
