const { PrismaClient } = require('@prisma/client');
const { formatInTimeZone } = require('date-fns-tz');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * Global Screen Sharing Service
 * Real-time screen sharing with collaboration features for worldwide deployment
 * Features: Multi-participant sharing, annotations, recording, global optimization
 */
class ScreenSharingService {
  constructor() {
    this.activeSessions = new Map(); // sessionId -> session data
    this.sharedScreens = new Map(); // userId -> shared screen info
    this.collaborationRooms = new Map(); // roomId -> room data
    this.annotations = new Map(); // sessionId -> annotations array
    this.recordings = new Map(); // sessionId -> recording info
    
    // Global configuration
    this.maxViewersPerSession = 100;
    this.maxAnnotationsPerSession = 500;
    this.sessionTimeoutMinutes = 240; // 4 hours max
    this.supportedFormats = ['video/webm', 'video/mp4', 'image/png', 'image/jpeg'];
    
    // Quality settings for different regions/connections
    this.qualityProfiles = {
      'high': { width: 1920, height: 1080, frameRate: 30, bitrate: 5000000 },
      'medium': { width: 1280, height: 720, frameRate: 24, bitrate: 2500000 },
      'low': { width: 854, height: 480, frameRate: 15, bitrate: 1000000 },
      'mobile': { width: 640, height: 360, frameRate: 12, bitrate: 500000 }
    };
  }

  /**
   * Initialize global screen sharing service
   */
  async init(io) {
    try {
      console.log('🖥️ Initializing Global Screen Sharing Service...');
      
      this.io = io;
      this.setupSocketHandlers();
      this.startCleanupInterval();
      
      console.log('🌍 Global screen sharing service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Screen sharing service initialization error:', error.message);
      throw error;
    }
  }

  /**
   * Setup Socket.IO handlers for real-time screen sharing
   */
  setupSocketHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      // Start screen sharing session
      socket.on('screen:share:start', async (data) => {
        await this.handleStartScreenShare(socket, data);
      });

      // Stop screen sharing
      socket.on('screen:share:stop', async (data) => {
        await this.handleStopScreenShare(socket, data);
      });

      // Join as viewer
      socket.on('screen:viewer:join', async (data) => {
        await this.handleViewerJoin(socket, data);
      });

      // Leave viewing session
      socket.on('screen:viewer:leave', async (data) => {
        await this.handleViewerLeave(socket, data);
      });

      // Screen sharing data stream
      socket.on('screen:stream:data', async (data) => {
        await this.handleStreamData(socket, data);
      });

      // Annotation events
      socket.on('annotation:add', async (data) => {
        await this.handleAddAnnotation(socket, data);
      });

      socket.on('annotation:update', async (data) => {
        await this.handleUpdateAnnotation(socket, data);
      });

      socket.on('annotation:remove', async (data) => {
        await this.handleRemoveAnnotation(socket, data);
      });

      // Drawing/whiteboard events
      socket.on('drawing:start', async (data) => {
        await this.handleDrawingStart(socket, data);
      });

      socket.on('drawing:continue', async (data) => {
        await this.handleDrawingContinue(socket, data);
      });

      socket.on('drawing:end', async (data) => {
        await this.handleDrawingEnd(socket, data);
      });

      // Cursor sharing
      socket.on('cursor:move', async (data) => {
        await this.handleCursorMove(socket, data);
      });

      // Quality adjustment
      socket.on('quality:change', async (data) => {
        await this.handleQualityChange(socket, data);
      });

      // Recording controls
      socket.on('recording:start', async (data) => {
        await this.handleStartRecording(socket, data);
      });

      socket.on('recording:stop', async (data) => {
        await this.handleStopRecording(socket, data);
      });

      // Permission requests
      socket.on('permission:request', async (data) => {
        await this.handlePermissionRequest(socket, data);
      });

      socket.on('permission:grant', async (data) => {
        await this.handlePermissionGrant(socket, data);
      });

      // Session control
      socket.on('session:pause', async (data) => {
        await this.handleSessionPause(socket, data);
      });

      socket.on('session:resume', async (data) => {
        await this.handleSessionResume(socket, data);
      });

      // Disconnect handling
      socket.on('disconnect', async () => {
        await this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Start a new screen sharing session
   */
  async handleStartScreenShare(socket, data) {
    try {
      const {
        roomId,
        sessionTitle,
        quality = 'medium',
        allowAnnotations = true,
        allowRecording = true,
        maxViewers = this.maxViewersPerSession,
        timezone = 'UTC'
      } = data;

      const userId = socket.userId;
      const companyId = socket.companyId;

      if (!userId || !roomId) {
        socket.emit('screen:share:error', { message: 'Missing required data' });
        return;
      }

      // Check if user already has an active session
      const existingSession = [...this.activeSessions.values()]
        .find(session => session.hostId === userId && session.status === 'active');

      if (existingSession) {
        socket.emit('screen:share:error', { message: 'You already have an active screen sharing session' });
        return;
      }

      // Generate unique session ID
      const sessionId = crypto.randomUUID();

      // Create session data
      const sessionData = {
        sessionId,
        roomId,
        hostId: userId,
        companyId,
        title: sessionTitle || `Screen Share by ${socket.user?.firstName || 'User'}`,
        status: 'active',
        quality,
        qualityProfile: this.qualityProfiles[quality],
        allowAnnotations,
        allowRecording,
        maxViewers,
        timezone,
        viewers: new Set(),
        startedAt: new Date(),
        lastActivity: new Date(),
        metadata: {
          serverRegion: process.env.SERVER_REGION || 'global',
          clientTimezone: timezone
        }
      };

      // Store session
      this.activeSessions.set(sessionId, sessionData);
      this.sharedScreens.set(userId, { sessionId, roomId, startedAt: new Date() });

      // Create database record
      const dbSession = await prisma.screenSharingSession.create({
        data: {
          id: sessionId,
          title: sessionData.title,
          hostId: userId,
          companyId,
          roomId,
          quality,
          allowAnnotations,
          allowRecording,
          maxViewers,
          startedAt: sessionData.startedAt,
          timezone,
          metadata: sessionData.metadata
        }
      });

      // Join socket to session room
      socket.join(`screen:${sessionId}`);
      socket.screenSessionId = sessionId;

      // Notify room about new screen sharing session
      socket.to(roomId).emit('screen:share:started', {
        sessionId,
        hostId: userId,
        title: sessionData.title,
        quality: sessionData.qualityProfile,
        allowAnnotations,
        allowRecording,
        startedAt: sessionData.startedAt,
        localTime: formatInTimeZone(sessionData.startedAt, timezone, 'yyyy-MM-dd HH:mm:ss zzz')
      });

      // Send success response to host
      socket.emit('screen:share:started', {
        success: true,
        sessionId,
        sessionData: {
          ...sessionData,
          viewers: Array.from(sessionData.viewers)
        },
        webrtcConfig: this.getScreenSharingWebRTCConfig()
      });

      console.log(`🖥️ Screen sharing started by user ${userId} in room ${roomId} (Session: ${sessionId})`);
    } catch (error) {
      console.error('❌ Error starting screen share:', error);
      socket.emit('screen:share:error', { message: 'Failed to start screen sharing' });
    }
  }

  /**
   * Stop screen sharing session
   */
  async handleStopScreenShare(socket, data) {
    try {
      const { sessionId } = data;
      const userId = socket.userId;

      const session = this.activeSessions.get(sessionId);
      if (!session) {
        socket.emit('screen:share:error', { message: 'Session not found' });
        return;
      }

      if (session.hostId !== userId) {
        socket.emit('screen:share:error', { message: 'Not authorized to stop this session' });
        return;
      }

      // Update session status
      session.status = 'ended';
      session.endedAt = new Date();

      // Update database
      await prisma.screenSharingSession.update({
        where: { id: sessionId },
        data: {
          endedAt: session.endedAt,
          duration: Math.floor((session.endedAt - session.startedAt) / 1000), // seconds
          viewerCount: session.viewers.size
        }
      });

      // Notify all viewers
      this.io.to(`screen:${sessionId}`).emit('screen:share:ended', {
        sessionId,
        endedAt: session.endedAt,
        duration: session.endedAt - session.startedAt,
        viewerCount: session.viewers.size
      });

      // Cleanup
      this.activeSessions.delete(sessionId);
      this.sharedScreens.delete(userId);
      this.annotations.delete(sessionId);
      
      // Stop any active recordings
      if (this.recordings.has(sessionId)) {
        await this.stopRecording(sessionId);
      }

      socket.emit('screen:share:stopped', { success: true, sessionId });
      console.log(`🛑 Screen sharing stopped for session ${sessionId}`);
    } catch (error) {
      console.error('❌ Error stopping screen share:', error);
      socket.emit('screen:share:error', { message: 'Failed to stop screen sharing' });
    }
  }

  /**
   * Handle viewer joining a screen sharing session
   */
  async handleViewerJoin(socket, data) {
    try {
      const { sessionId, timezone = 'UTC' } = data;
      const userId = socket.userId;

      const session = this.activeSessions.get(sessionId);
      if (!session) {
        socket.emit('screen:viewer:error', { message: 'Session not found' });
        return;
      }

      if (session.status !== 'active') {
        socket.emit('screen:viewer:error', { message: 'Session is not active' });
        return;
      }

      if (session.viewers.size >= session.maxViewers) {
        socket.emit('screen:viewer:error', { message: 'Session is full' });
        return;
      }

      // Add viewer to session
      session.viewers.add(userId);
      socket.join(`screen:${sessionId}`);
      socket.screenViewingSessionId = sessionId;

      // Store viewer timezone
      this.globalTimezones.set(userId, timezone);

      // Create viewer record
      await prisma.screenSharingViewer.create({
        data: {
          sessionId,
          userId,
          joinedAt: new Date(),
          timezone
        }
      });

      // Send session info to viewer
      socket.emit('screen:viewer:joined', {
        success: true,
        sessionId,
        sessionInfo: {
          title: session.title,
          hostId: session.hostId,
          quality: session.qualityProfile,
          allowAnnotations: session.allowAnnotations,
          startedAt: session.startedAt,
          localTime: formatInTimeZone(session.startedAt, timezone, 'yyyy-MM-dd HH:mm:ss zzz')
        },
        annotations: this.annotations.get(sessionId) || [],
        viewerCount: session.viewers.size
      });

      // Notify host and other viewers
      socket.to(`screen:${sessionId}`).emit('screen:viewer:joined', {
        viewerId: userId,
        viewerCount: session.viewers.size,
        timestamp: new Date().toISOString()
      });

      console.log(`👁️ Viewer ${userId} joined screen sharing session ${sessionId}`);
    } catch (error) {
      console.error('❌ Error handling viewer join:', error);
      socket.emit('screen:viewer:error', { message: 'Failed to join viewing session' });
    }
  }

  /**
   * Handle stream data from screen sharer
   */
  async handleStreamData(socket, data) {
    try {
      const { sessionId, streamData, frameNumber, timestamp } = data;
      const userId = socket.userId;

      const session = this.activeSessions.get(sessionId);
      if (!session || session.hostId !== userId) {
        return;
      }

      // Update last activity
      session.lastActivity = new Date();

      // Broadcast stream data to all viewers
      socket.to(`screen:${sessionId}`).emit('screen:stream:data', {
        sessionId,
        streamData,
        frameNumber,
        timestamp,
        serverTimestamp: new Date().toISOString()
      });

      // Record for active recordings
      if (this.recordings.has(sessionId)) {
        await this.recordFrame(sessionId, streamData, frameNumber);
      }
    } catch (error) {
      console.error('❌ Error handling stream data:', error);
    }
  }

  /**
   * Handle adding annotation
   */
  async handleAddAnnotation(socket, data) {
    try {
      const {
        sessionId,
        type, // 'text', 'arrow', 'rectangle', 'circle', 'freehand'
        position,
        content,
        style = {}
      } = data;

      const userId = socket.userId;
      const session = this.activeSessions.get(sessionId);

      if (!session || !session.allowAnnotations) {
        socket.emit('annotation:error', { message: 'Annotations not allowed' });
        return;
      }

      if (!session.viewers.has(userId) && session.hostId !== userId) {
        socket.emit('annotation:error', { message: 'Not authorized' });
        return;
      }

      const annotationId = crypto.randomUUID();
      const annotation = {
        id: annotationId,
        sessionId,
        userId,
        type,
        position,
        content,
        style: {
          color: style.color || '#ff0000',
          fontSize: style.fontSize || 14,
          strokeWidth: style.strokeWidth || 2,
          ...style
        },
        createdAt: new Date(),
        isVisible: true
      };

      // Store annotation
      if (!this.annotations.has(sessionId)) {
        this.annotations.set(sessionId, []);
      }
      
      const sessionAnnotations = this.annotations.get(sessionId);
      if (sessionAnnotations.length >= this.maxAnnotationsPerSession) {
        socket.emit('annotation:error', { message: 'Maximum annotations reached' });
        return;
      }

      sessionAnnotations.push(annotation);

      // Save to database
      await prisma.screenSharingAnnotation.create({
        data: {
          id: annotationId,
          sessionId,
          userId,
          type: type.toUpperCase(),
          position: JSON.stringify(position),
          content: content || '',
          style: JSON.stringify(annotation.style),
          createdAt: annotation.createdAt
        }
      });

      // Broadcast to all session participants
      this.io.to(`screen:${sessionId}`).emit('annotation:added', annotation);

      console.log(`✏️ Annotation added to session ${sessionId} by user ${userId}`);
    } catch (error) {
      console.error('❌ Error adding annotation:', error);
      socket.emit('annotation:error', { message: 'Failed to add annotation' });
    }
  }

  /**
   * Handle cursor movement sharing
   */
  async handleCursorMove(socket, data) {
    try {
      const { sessionId, position } = data;
      const userId = socket.userId;

      const session = this.activeSessions.get(sessionId);
      if (!session) return;

      // Broadcast cursor position to other participants
      socket.to(`screen:${sessionId}`).emit('cursor:moved', {
        userId,
        position,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('❌ Error handling cursor move:', error);
    }
  }

  /**
   * Handle quality change request
   */
  async handleQualityChange(socket, data) {
    try {
      const { sessionId, quality } = data;
      const userId = socket.userId;

      const session = this.activeSessions.get(sessionId);
      if (!session || session.hostId !== userId) {
        socket.emit('quality:error', { message: 'Not authorized to change quality' });
        return;
      }

      if (!this.qualityProfiles[quality]) {
        socket.emit('quality:error', { message: 'Invalid quality setting' });
        return;
      }

      // Update session quality
      session.quality = quality;
      session.qualityProfile = this.qualityProfiles[quality];

      // Notify all participants about quality change
      this.io.to(`screen:${sessionId}`).emit('quality:changed', {
        quality,
        qualityProfile: session.qualityProfile,
        changedBy: userId,
        timestamp: new Date().toISOString()
      });

      console.log(`🎬 Quality changed to ${quality} for session ${sessionId}`);
    } catch (error) {
      console.error('❌ Error changing quality:', error);
      socket.emit('quality:error', { message: 'Failed to change quality' });
    }
  }

  /**
   * Get WebRTC configuration for screen sharing
   */
  getScreenSharingWebRTCConfig() {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Add TURN servers for better connectivity
        {
          urls: 'turn:global.collabnotes.com:3478',
          username: process.env.TURN_USERNAME || 'webrtc',
          credential: process.env.TURN_PASSWORD || 'secretpass'
        }
      ],
      iceCandidatePoolSize: 10,
      mediaConstraints: {
        video: {
          mediaSource: 'screen',
          frameRate: { ideal: 24, max: 30 },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      }
    };
  }

  /**
   * Start recording a screen sharing session
   */
  async handleStartRecording(socket, data) {
    try {
      const { sessionId } = data;
      const userId = socket.userId;

      const session = this.activeSessions.get(sessionId);
      if (!session) {
        socket.emit('recording:error', { message: 'Session not found' });
        return;
      }

      if (session.hostId !== userId) {
        socket.emit('recording:error', { message: 'Only host can start recording' });
        return;
      }

      if (!session.allowRecording) {
        socket.emit('recording:error', { message: 'Recording not allowed for this session' });
        return;
      }

      if (this.recordings.has(sessionId)) {
        socket.emit('recording:error', { message: 'Recording already in progress' });
        return;
      }

      const recordingId = crypto.randomUUID();
      const recording = {
        id: recordingId,
        sessionId,
        startedAt: new Date(),
        status: 'recording',
        frames: [],
        annotations: []
      };

      this.recordings.set(sessionId, recording);

      // Create database record
      await prisma.screenSharingRecording.create({
        data: {
          id: recordingId,
          sessionId,
          startedAt: recording.startedAt,
          status: 'RECORDING'
        }
      });

      // Notify all participants
      this.io.to(`screen:${sessionId}`).emit('recording:started', {
        recordingId,
        startedAt: recording.startedAt,
        startedBy: userId
      });

      socket.emit('recording:started', { success: true, recordingId });
      console.log(`🎬 Recording started for session ${sessionId}`);
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      socket.emit('recording:error', { message: 'Failed to start recording' });
    }
  }

  /**
   * Stop recording
   */
  async stopRecording(sessionId) {
    try {
      const recording = this.recordings.get(sessionId);
      if (!recording) return;

      recording.status = 'completed';
      recording.endedAt = new Date();
      recording.duration = recording.endedAt - recording.startedAt;

      // Update database
      await prisma.screenSharingRecording.update({
        where: { id: recording.id },
        data: {
          endedAt: recording.endedAt,
          duration: Math.floor(recording.duration / 1000),
          frameCount: recording.frames.length,
          status: 'COMPLETED'
        }
      });

      // Process and save recording (implement based on your storage solution)
      await this.processRecording(recording);

      this.recordings.delete(sessionId);
      console.log(`🎬 Recording completed for session ${sessionId}`);
    } catch (error) {
      console.error('❌ Error stopping recording:', error);
    }
  }

  /**
   * Record a frame during screen sharing
   */
  async recordFrame(sessionId, frameData, frameNumber) {
    try {
      const recording = this.recordings.get(sessionId);
      if (!recording || recording.status !== 'recording') return;

      recording.frames.push({
        frameNumber,
        data: frameData,
        timestamp: new Date()
      });

      // Limit memory usage by processing frames in batches
      if (recording.frames.length >= 100) {
        await this.processFrameBatch(recording);
      }
    } catch (error) {
      console.error('❌ Error recording frame:', error);
    }
  }

  /**
   * Process frame batch for recording
   */
  async processFrameBatch(recording) {
    try {
      // Implement based on your video processing needs
      // This could involve saving to cloud storage, converting formats, etc.
      console.log(`🎞️ Processing frame batch for recording ${recording.id}`);
      
      // Clear processed frames to free memory
      recording.frames = recording.frames.slice(-10); // Keep last 10 frames for continuity
    } catch (error) {
      console.error('❌ Error processing frame batch:', error);
    }
  }

  /**
   * Process completed recording
   */
  async processRecording(recording) {
    try {
      // Implement recording processing logic
      // Convert to standard video format, upload to cloud storage, etc.
      console.log(`🎥 Processing completed recording ${recording.id}`);
    } catch (error) {
      console.error('❌ Error processing recording:', error);
    }
  }

  /**
   * Handle disconnect cleanup
   */
  async handleDisconnect(socket) {
    try {
      const userId = socket.userId;
      if (!userId) return;

      // Clean up if user was hosting a session
      const hostingSession = [...this.activeSessions.values()]
        .find(session => session.hostId === userId);

      if (hostingSession) {
        await this.handleStopScreenShare(socket, { sessionId: hostingSession.sessionId });
      }

      // Clean up if user was viewing a session
      if (socket.screenViewingSessionId) {
        await this.handleViewerLeave(socket, { sessionId: socket.screenViewingSessionId });
      }

      console.log(`🔌 Screen sharing cleanup completed for user ${userId}`);
    } catch (error) {
      console.error('❌ Error in screen sharing disconnect cleanup:', error);
    }
  }

  /**
   * Handle viewer leaving
   */
  async handleViewerLeave(socket, data) {
    try {
      const { sessionId } = data;
      const userId = socket.userId;

      const session = this.activeSessions.get(sessionId);
      if (!session) return;

      // Remove viewer from session
      session.viewers.delete(userId);
      socket.leave(`screen:${sessionId}`);

      // Update database
      await prisma.screenSharingViewer.updateMany({
        where: {
          sessionId,
          userId,
          leftAt: null
        },
        data: {
          leftAt: new Date()
        }
      });

      // Notify other participants
      socket.to(`screen:${sessionId}`).emit('screen:viewer:left', {
        viewerId: userId,
        viewerCount: session.viewers.size,
        timestamp: new Date().toISOString()
      });

      socket.emit('screen:viewer:left', { success: true, sessionId });
      console.log(`👋 Viewer ${userId} left screen sharing session ${sessionId}`);
    } catch (error) {
      console.error('❌ Error handling viewer leave:', error);
    }
  }

  /**
   * Start cleanup interval for expired sessions
   */
  startCleanupInterval() {
    setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      const now = new Date();
      const timeoutMs = this.sessionTimeoutMinutes * 60 * 1000;

      for (const [sessionId, session] of this.activeSessions.entries()) {
        const inactiveTime = now - session.lastActivity;
        
        if (inactiveTime > timeoutMs) {
          console.log(`🧹 Cleaning up expired session ${sessionId}`);
          
          // Notify participants
          this.io.to(`screen:${sessionId}`).emit('screen:share:expired', {
            sessionId,
            reason: 'Session expired due to inactivity'
          });

          // Stop recording if active
          if (this.recordings.has(sessionId)) {
            await this.stopRecording(sessionId);
          }

          // Update database
          await prisma.screenSharingSession.update({
            where: { id: sessionId },
            data: {
              endedAt: now,
              duration: Math.floor((now - session.startedAt) / 1000)
            }
          });

          // Cleanup
          this.activeSessions.delete(sessionId);
          this.sharedScreens.delete(session.hostId);
          this.annotations.delete(sessionId);
        }
      }
    } catch (error) {
      console.error('❌ Error cleaning up expired sessions:', error);
    }
  }

  // Additional handler methods for remaining socket events...
  async handleUpdateAnnotation(socket, data) {
    // Implementation for updating annotations
  }

  async handleRemoveAnnotation(socket, data) {
    // Implementation for removing annotations
  }

  async handleDrawingStart(socket, data) {
    // Implementation for drawing start
  }

  async handleDrawingContinue(socket, data) {
    // Implementation for drawing continue
  }

  async handleDrawingEnd(socket, data) {
    // Implementation for drawing end
  }

  async handlePermissionRequest(socket, data) {
    // Implementation for permission requests
  }

  async handlePermissionGrant(socket, data) {
    // Implementation for permission grants
  }

  async handleSessionPause(socket, data) {
    // Implementation for session pause
  }

  async handleSessionResume(socket, data) {
    // Implementation for session resume
  }

  async handleStopRecording(socket, data) {
    // Implementation for stopping recording
  }
}

module.exports = ScreenSharingService;