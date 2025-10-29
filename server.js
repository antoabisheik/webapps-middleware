import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import organizationsRoutes from './routes/organizations.js';
import devicesRoutes from './routes/devices.js';
import gymsRoutes from './routes/gyms-routes.js';

dotenv.config();

const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser (for session cookies)
app.use(cookieParser());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use('/api', authRoutes);          
app.use('/api', organizationsRoutes); 
app.use('/api', devicesRoutes);       
app.use('/api', gymsRoutes);          

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Server Running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      organizations: '/api/organizations',
      devices: '/api/organizations/:orgId/devices',
      gyms: '/api/organizations/:orgId/gyms'
    }
  });
});


// 404 handler - MUST be after all routes
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    method: req.method,
    path: req.path,
    availableRoutes: [
      'POST /api/auth/signup',
      'POST /api/auth/login',
      'POST /api/auth/google-login',
      'GET /api/auth/profile',
      'POST /api/auth/logout',
      'GET /api/auth/test',
      'GET /api/organizations',
      'POST /api/organizations',
      'GET /api/organizations/:id',
      'PUT /api/organizations/:id',
      'DELETE /api/organizations/:id',
      'GET /api/organizations/:orgId/devices',
      'POST /api/organizations/:orgId/devices',
      'GET /api/organizations/:orgId/devices/:deviceId',
      'PUT /api/organizations/:orgId/devices/:deviceId',
      'DELETE /api/organizations/:orgId/devices/:deviceId',
      'GET /api/organizations/:orgId/gyms',
      'POST /api/organizations/:orgId/gyms',
      'GET /api/organizations/:orgId/gyms/:gymId',
      'PUT /api/organizations/:orgId/gyms/:gymId',
      'DELETE /api/organizations/:orgId/gyms/:gymId'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log();
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log('\nAvailable Routes:');
  console.log('  Authentication:');
  console.log('    POST   /api/auth/signup');
  console.log('    POST   /api/auth/login');
  console.log('    POST   /api/auth/google-login');
  console.log('    GET    /api/auth/profile');
  console.log('    POST   /api/auth/logout');
  console.log('    GET    /api/auth/test');
  console.log('\n  Organizations:');
  console.log('    GET    /api/organizations');
  console.log('    POST   /api/organizations');
  console.log('    GET    /api/organizations/:id');
  console.log('    PUT    /api/organizations/:id');
  console.log('    DELETE /api/organizations/:id');
  console.log('\n  Devices:');
  console.log('    GET    /api/organizations/:orgId/devices');
  console.log('    POST   /api/organizations/:orgId/devices');
  console.log('    GET    /api/organizations/:orgId/devices/:deviceId');
  console.log('    PUT    /api/organizations/:orgId/devices/:deviceId');
  console.log('    DELETE /api/organizations/:orgId/devices/:deviceId');
  console.log('\n  Gyms:');
  console.log('    GET    /api/organizations/:orgId/gyms');
  console.log('    POST   /api/organizations/:orgId/gyms');
  console.log('    GET    /api/organizations/:orgId/gyms/:gymId');
  console.log('    PUT    /api/organizations/:orgId/gyms/:gymId');
  console.log('    DELETE /api/organizations/:orgId/gyms/:gymId');
});

export default app;