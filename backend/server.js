const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');

// Allow multiple origins for CORS
const allowedOrigins = [
  'http://localhost:5173', // Original frontend
  'http://localhost:3000', // Platform admin frontend
  process.env.FRONTEND_URL,
  process.env.ADMIN_FRONTEND_URL
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

const onlineUsers = new Map(); // userId -> socketId
const prisma = require('./src/utils/prisma');
const PORT = process.env.PORT || 5001;

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// CORS configuration - updated to allow multiple origins
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'CollabNotes API is running',
    timestamp: new Date().toISOString()
  });
});

// Import route handlers
const authRoutes = require('./src/routes/auth');
const companyRoutes = require('./src/routes/companies');
const departmentRoutes = require('./src/routes/departments');
const noteRoutes = require('./src/routes/notes');
const taskRoutes = require('./src/routes/tasks');
const messagesEnhancedRoutes = require('./src/routes/messagesEnhanced');
const activityRoutes = require('./src/routes/activity');
const groupRoutes = require('./src/routes/groups');
const notificationRoutes = require('./src/routes/notifications');
const reactionRoutes = require('./src/routes/reactions');
const threadRoutes = require('./src/routes/threads');
const platformAdminRoutes = require('./src/routes/platform-admin');
const companyAdminRoutes = require('./src/routes/company-admin');
const departmentDashboardRoutes = require('./src/routes/department-dashboard');

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/messages-enhanced', messagesEnhancedRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', reactionRoutes);
app.use('/api/threads', threadRoutes);
app.use('/api/platform-admin', platformAdminRoutes);
app.use('/api/company-admin', companyAdminRoutes);
app.use('/api/department-dashboard', departmentDashboardRoutes);

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler - must be last
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Socket.IO events
const typingUsers = new Map(); // userId -> { recipientId, timer }

// Make io available to routes
app.set('socketio', io);

io.on('connection', (socket) => {
  // Client should emit 'auth' with userId after connecting
  socket.on('auth', (userId) => {
    if (!userId) return;
    onlineUsers.set(userId, socket.id);
    // join per-user room for targeted events
    socket.join(`user:${userId}`);
    // send initial presence snapshot
    socket.emit('presence:initial', { onlineUserIds: Array.from(onlineUsers.keys()) });
    // broadcast presence update
    io.emit('presence:update', { userId, online: true });
  });

  socket.on('disconnect', () => {
    // find user by socket
    for (const [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(uid);
        // Clear typing indicator for this user
        if (typingUsers.has(uid)) {
          const { recipientId, timer } = typingUsers.get(uid);
          clearTimeout(timer);
          typingUsers.delete(uid);
          io.to(`user:${recipientId}`).emit('typing:stop', { userId: uid });
        }
        io.emit('presence:update', { userId: uid, online: false });
        break;
      }
    }
  });

  // Typing indicators
  socket.on('typing:start', ({ recipientId, userId }) => {
    if (!recipientId || !userId) return;
    
    // Clear existing timer if any
    if (typingUsers.has(userId)) {
      clearTimeout(typingUsers.get(userId).timer);
    }
    
    // Set new timer to auto-stop typing after 3 seconds
    const timer = setTimeout(() => {
      typingUsers.delete(userId);
      io.to(`user:${recipientId}`).emit('typing:stop', { userId });
    }, 3000);
    
    typingUsers.set(userId, { recipientId, timer });
    io.to(`user:${recipientId}`).emit('typing:start', { userId });
  });

  socket.on('typing:stop', ({ recipientId, userId }) => {
    if (!recipientId || !userId) return;
    
    if (typingUsers.has(userId)) {
      clearTimeout(typingUsers.get(userId).timer);
      typingUsers.delete(userId);
    }
    
    io.to(`user:${recipientId}`).emit('typing:stop', { userId });
  });

  // Recipient acknowledges message delivered
  socket.on('message:delivered', async ({ messageId, userId }) => {
    try {
      if (!messageId || !userId) return;
      const msg = await prisma.message.findUnique({ where: { id: messageId } });
      if (!msg || msg.recipientId !== userId) return; // only recipient can ack
      if (!msg.readAt) {
        // We don't store deliveredAt yet if schema missing; safe no-op
        // Placeholder for future deliveredAt
      }
      io.to(`user:${msg.senderId}`).emit('message:delivered', { messageId });
    } catch (e) {
      console.error('message:delivered handler error', e);
    }
  });

  // Recipient marks message as read
  socket.on('message:read', async ({ messageId, userId }) => {
    try {
      if (!messageId || !userId) return;
      const msg = await prisma.message.findUnique({ where: { id: messageId } });
      if (!msg || msg.recipientId !== userId) return;
      if (!msg.readAt) {
        const updated = await prisma.message.update({ where: { id: messageId }, data: { readAt: new Date() } });
        io.to(`user:${updated.senderId}`).emit('message:read', { messageId, readAt: updated.readAt });
      }
    } catch (e) {
      console.error('message:read handler error', e);
    }
  });

  // Thread room management
  socket.on('thread:join', ({ messageId, userId }) => {
    if (!messageId || !userId) return;
    socket.join(`thread:${messageId}`);
    socket.emit('thread:joined', { messageId });
  });

  socket.on('thread:leave', ({ messageId, userId }) => {
    if (!messageId || !userId) return;
    socket.leave(`thread:${messageId}`);
    socket.emit('thread:left', { messageId });
  });

  // Group room management
  socket.on('group:join', ({ groupId, userId }) => {
    if (!groupId || !userId) return;
    socket.join(`group:${groupId}`);
    socket.emit('group:joined', { groupId });
  });

  socket.on('group:leave', ({ groupId, userId }) => {
    if (!groupId || !userId) return;
    socket.leave(`group:${groupId}`);
    socket.emit('group:left', { groupId });
  });
});

// Make io accessible in routes
app.set('io', io);

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 CORS enabled for origins: ${allowedOrigins.join(', ')}`);
});