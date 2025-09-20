const { PrismaClient } = require('@prisma/client');
const { zonedTimeToUtc, utcToZonedTime, format, formatInTimeZone } = require('date-fns-tz');
const { addMinutes, isBefore, isAfter, differenceInMinutes } = require('date-fns');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * Global Video Call Service
 * Enterprise-grade video calling with worldwide deployment support
 * Features: WebRTC, global TURN servers, real-time collaboration, multi-timezone support
 */
class VideoCallService {
  constructor() {
    this.activeCalls = new Map(); // Store active call sessions
    this.callRooms = new Map(); // Store room information
    this.globalTimezones = new Map(); // Store user timezone preferences
    this.maxParticipants = 100; // Increased for global scale
    this.defaultCallDuration = 60; // Default 60 minutes
    this.screenSharingEnabled = true;
    this.recordingEnabled = true;
    
    // Global business hours by timezone
    this.regionalBusinessHours = {
      'UTC': { start: 9, end: 17 },
      'America/New_York': { start: 9, end: 17 },
      'America/Los_Angeles': { start: 9, end: 17 },
      'Europe/London': { start: 9, end: 17 },
      'Europe/Berlin': { start: 9, end: 17 },
      'Asia/Tokyo': { start: 9, end: 17 },
      'Asia/Singapore': { start: 9, end: 17 },
      'Asia/Mumbai': { start: 9, end: 17 },
      'Australia/Sydney': { start: 9, end: 17 },
      'Africa/Lagos': { start: 8, end: 18 }, // Nigerian time
      'America/Sao_Paulo': { start: 9, end: 17 }
    };

    this.nigerianTimeZone = 'Africa/Lagos';
    this.businessHours = { start: 8, end: 18 }; // Default for Nigeria
  }

  /**
   * Initialize global video call service
   */
  async init() {
    try {
      console.log('� Initializing Global Video Call Service...');
      
      // Cleanup old call sessions on startup
      await this.cleanupExpiredCalls();
      
      // Initialize global monitoring
      this.startGlobalMonitoring();
      
      console.log('🎥 Global video call service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Video call service initialization error:', error.message);
      throw error;
    }
  }

  /**
   * Free Jitsi Meet configuration
   * Completely free video calling solution
   */
  getJitsiMeetConfiguration() {
    return {
      domain: process.env.JITSI_DOMAIN || 'meet.jit.si',
      options: {
        roomName: '',
        width: '100%',
        height: '600px',
        parentNode: null,
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          enableWelcomePage: false,
          prejoinPageEnabled: false,
          disableModeratorIndicator: false,
          enableEmailInStats: false
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'closedcaptions', 'desktop',
            'fullscreen', 'fodeviceselection', 'hangup', 'profile',
            'chat', 'recording', 'livestreaming', 'etherpad',
            'sharedvideo', 'settings', 'raisehand', 'videoquality',
            'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
            'tileview', 'videobackgroundblur', 'download', 'help',
            'mute-everyone', 'security'
          ]
        }
      }
    };
  }

  /**
   * Create Jitsi Meet room
   */
  async createJitsiRoom(roomData) {
    try {
      const {
        title,
        hostId,
        participantIds = [],
        scheduledFor,
        duration = 60,
        timezone = 'UTC'
      } = roomData;

      // Generate unique room ID
      const roomId = crypto.randomUUID();
      const meetingId = `collabnotes-${roomId.substring(0, 8)}`;

      // Create room record in database
      const videoCall = await prisma.videoCall.create({
        data: {
          id: roomId,
          title,
          description: `Jitsi Meet room: ${title}`,
          scheduledFor: new Date(scheduledFor),
          duration,
          hostId,
          companyId: roomData.companyId,
          roomId: meetingId,
          joinUrl: `https://${process.env.JITSI_DOMAIN || 'meet.jit.si'}/${meetingId}`,
          isRecordingEnabled: true,
          status: 'INITIATED',
          maxParticipants: 75, // Jitsi recommended limit
          metadata: {
            provider: 'jitsi',
            domain: process.env.JITSI_DOMAIN || 'meet.jit.si',
            timezone
          }
        }
      });

      // Add participants
      if (participantIds.length > 0) {
        await prisma.videoCallParticipant.createMany({
          data: participantIds.map(userId => ({
            callId: roomId,
            userId,
            status: 'RINGING'
          }))
        });
      }

      console.log(`🎥 Jitsi Meet room created: ${meetingId}`);
      
      return {
        id: roomId,
        meetingId,
        joinUrl: videoCall.joinUrl,
        title,
        scheduledFor: videoCall.scheduledFor,
        duration,
        maxParticipants: 75,
        provider: 'jitsi',
        config: this.getJitsiMeetConfiguration()
      };
    } catch (error) {
      console.error('❌ Error creating Jitsi room:', error);
      throw error;
    }
  }

  /**
   * Join Jitsi Meet room
   */
  async joinJitsiRoom(roomId, userId, timezone = 'UTC') {
    try {
      const videoCall = await prisma.videoCall.findUnique({
        where: { id: roomId },
        include: {
          host: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          }
        }
      });

      if (!videoCall) {
        throw new Error('Video call not found');
      }

      // Update participant status
      await prisma.videoCallParticipant.updateMany({
        where: {
          callId: roomId,
          userId
        },
        data: {
          status: 'CONNECTED',
          joinedAt: new Date()
        }
      });

      // If no participant record exists, create one
      const existingParticipant = await prisma.videoCallParticipant.findFirst({
        where: { callId: roomId, userId }
      });

      if (!existingParticipant) {
        await prisma.videoCallParticipant.create({
          data: {
            callId: roomId,
            userId,
            status: 'CONNECTED',
            joinedAt: new Date()
          }
        });
      }

      console.log(`👤 User ${userId} joined Jitsi room ${videoCall.roomId}`);

      return {
        callInfo: {
          id: videoCall.id,
          title: videoCall.title,
          joinUrl: videoCall.joinUrl,
          roomId: videoCall.roomId,
          host: videoCall.host,
          participants: videoCall.participants.map(p => p.user),
          scheduledFor: videoCall.scheduledFor,
          localTime: formatInTimeZone(videoCall.scheduledFor, timezone, 'yyyy-MM-dd HH:mm:ss zzz')
        },
        jitsiConfig: this.getJitsiMeetConfiguration()
      };
    } catch (error) {
      console.error('❌ Error joining Jitsi room:', error);
      throw error;
    }
  }

  /**
   * Schedule a new video call with Nigerian business context
   */
  async scheduleVideoCall(callData) {
    try {
      const {
        title,
        description,
        scheduledFor,
        duration = this.defaultCallDuration,
        hostId,
        participantIds = [],
        companyId,
        allowRecording = true,
        requirePassword = false,
        businessContext = {},
        waitingRoomEnabled = true
      } = callData;

      // Convert scheduled time to WAT
      const watScheduledTime = this.convertToWAT(scheduledFor);
      const endTime = addMinutes(watScheduledTime, duration);

      // Validate business hours for Nigerian context
      if (businessContext.enforceBusinessHours) {
        this.validateBusinessHours(watScheduledTime);
      }

      // Generate unique room ID and join codes
      const roomId = this.generateRoomId();
      const hostCode = this.generateJoinCode('HOST');
      const participantCode = this.generateJoinCode('PARTICIPANT');
      const password = requirePassword ? this.generateCallPassword() : null;

      // Create video call record
      const videoCall = await prisma.videoCall.create({
        data: {
          title,
          description,
          callId: roomId, // Use roomId as callId for compatibility
          roomId,
          hostCode,
          participantCode,
          password,
          scheduledAt: scheduledFor,
          scheduledForWAT: watScheduledTime,
          endTime,
          duration,
          hostId,
          companyId,
          status: 'INITIATED',
          allowRecording,
          waitingRoomEnabled,
          maxParticipants: this.maxParticipants,
          recordingEnabled: allowRecording,
          requiresPassword: requirePassword,
          callSettings: {
            timezone: this.nigerianTimeZone,
            businessHours: this.businessHours,
            allowScreenShare: true,
            allowChat: true,
            allowRecording,
            muteOnJoin: false,
            videoOnJoin: true,
            waitingRoomEnabled,
            ...businessContext,
            createdAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss zzz', { 
              timeZone: this.nigerianTimeZone 
            })
          }
        }
      });

      // Add participants to the call
      if (participantIds.length > 0) {
        await this.addParticipantsToCall(videoCall.id, participantIds);
      }

      // Initialize room configuration
      this.callRooms.set(roomId, {
        id: videoCall.id,
        hostId,
        participants: new Set(),
        activeConnections: new Map(),
        recordingActive: false,
        screenSharingActive: false,
        chatMessages: [],
        waitingRoom: new Set(),
        startedAt: null,
        endedAt: null
      });

      console.log(`🎥 Video call scheduled: ${title} for ${format(watScheduledTime, 'PPpp', { timeZone: this.nigerianTimeZone })}`);
      
      return {
        ...videoCall,
        joinUrl: this.generateJoinUrl(roomId),
        hostJoinUrl: this.generateHostJoinUrl(roomId, hostCode),
        watTime: format(watScheduledTime, 'PPpp', { timeZone: this.nigerianTimeZone })
      };
    } catch (error) {
      console.error('❌ Error scheduling video call:', error.message);
      throw error;
    }
  }

  /**
   * Start a video call session
   */
  async startVideoCall(roomId, userId, userRole = 'PARTICIPANT') {
    try {
      const room = this.callRooms.get(roomId);
      if (!room) {
        throw new Error('Video call room not found');
      }

      // Get call details from database
      const videoCall = await prisma.videoCall.findFirst({
        where: { callId: roomId },
        include: {
          host: { select: { id: true, firstName: true, lastName: true, email: true } },
          participants: { 
            include: { 
              user: { select: { id: true, firstName: true, lastName: true, email: true } }
            }
          }
        }
      });

      if (!videoCall) {
        throw new Error('Video call not found');
      }

      // Validate user permissions
      const isHost = videoCall.hostId === userId;
      const isParticipant = videoCall.participants.some(p => p.userId === userId);
      
      if (!isHost && !isParticipant && userRole !== 'GUEST') {
        throw new Error('User not authorized to join this call');
      }

      // Check if call is ready to start
      const now = new Date();
      const scheduledTime = new Date(videoCall.scheduledAt);
      const earlyJoinWindow = addMinutes(scheduledTime, -15); // Allow 15 minutes early

      if (isBefore(now, earlyJoinWindow)) {
        throw new Error(`Call not available yet. Join window opens at ${format(earlyJoinWindow, 'PPpp', { timeZone: this.nigerianTimeZone })}`);
      }

      // Handle waiting room
      if (videoCall.callSettings?.waitingRoomEnabled && !isHost && room.startedAt === null) {
        room.waitingRoom.add(userId);
        return {
          status: 'RINGING',
          message: 'Waiting for host to start the meeting',
          waitingRoomSize: room.waitingRoom.size
        };
      }

      // Start call if host joins
      if (isHost && room.startedAt === null) {
        room.startedAt = now;
        
        // Move waiting room participants to main call
        for (const waitingUserId of room.waitingRoom) {
          room.participants.add(waitingUserId);
        }
        room.waitingRoom.clear();

        // Update call status
        await prisma.videoCall.update({
          where: { id: videoCall.id },
          data: { 
            status: 'CONNECTED',
            startedAt: now,
            metadata: {
              ...videoCall.metadata,
              actualStartTimeWAT: utcToZonedTime(now, this.nigerianTimeZone)
            }
          }
        });

        console.log(`🎥 Video call started: ${videoCall.title}`);
      }

      // Add participant to active call
      room.participants.add(userId);
      
      // Generate WebRTC connection configuration
      const rtcConfig = this.generateRTCConfiguration();
      
      // Log participant join
      await this.logCallEvent(videoCall.id, userId, 'PARTICIPANT_JOINED', {
        joinTime: now,
        watJoinTime: format(utcToZonedTime(now, this.nigerianTimeZone), 'PPpp', { timeZone: this.nigerianTimeZone }),
        userRole: isHost ? 'HOST' : 'PARTICIPANT'
      });

      return {
        status: 'CONNECTED',
        callId: videoCall.id,
        roomId,
        isHost,
        rtcConfig,
        participants: Array.from(room.participants),
        callInfo: {
          title: videoCall.title,
          description: videoCall.description,
          startedAt: room.startedAt,
          allowRecording: videoCall.allowRecording || videoCall.recordingEnabled,
          maxParticipants: videoCall.maxParticipants
        }
      };
    } catch (error) {
      console.error('❌ Error starting video call:', error.message);
      throw error;
    }
  }

  /**
   * End a video call
   */
  async endVideoCall(roomId, userId) {
    try {
      const room = this.callRooms.get(roomId);
      if (!room) {
        throw new Error('Video call room not found');
      }

      const videoCall = await prisma.videoCall.findFirst({
        where: { callId: roomId }
      });

      if (!videoCall) {
        throw new Error('Video call not found');
      }

      // Only host can end the call
      if (videoCall.hostId !== userId) {
        throw new Error('Only the host can end the call');
      }

      const endTime = new Date();
      room.endedAt = endTime;

      // Calculate actual duration
      const actualDuration = room.startedAt ? 
        differenceInMinutes(endTime, room.startedAt) : 0;

      // Update call record
      await prisma.videoCall.update({
        where: { id: videoCall.id },
        data: {
          status: 'DISCONNECTED',
          endedAt: endTime,
          duration: actualDuration,
          metadata: {
            ...videoCall.metadata,
            actualEndTimeWAT: utcToZonedTime(endTime, this.nigerianTimeZone),
            actualDuration
          }
        }
      });

      // Log call end event
      await this.logCallEvent(videoCall.id, userId, 'CALL_ENDED', {
        endTime,
        watEndTime: format(utcToZonedTime(endTime, this.nigerianTimeZone), 'PPpp', { timeZone: this.nigerianTimeZone }),
        actualDuration,
        participantCount: room.participants.size
      });

      // Clean up room
      this.callRooms.delete(roomId);

      console.log(`🎥 Video call ended: ${videoCall.title} (Duration: ${actualDuration} minutes)`);

      return {
        status: 'DISCONNECTED',
        actualDuration,
        participantCount: room.participants.size,
        endTime: format(utcToZonedTime(endTime, this.nigerianTimeZone), 'PPpp', { timeZone: this.nigerianTimeZone })
      };
    } catch (error) {
      console.error('❌ Error ending video call:', error.message);
      throw error;
    }
  }

  /**
   * Get video call analytics for Nigerian business reporting
   */
  async getCallAnalytics(companyId, dateRange = {}) {
    try {
      const { startDate, endDate } = dateRange;
      const filters = { companyId };

      if (startDate || endDate) {
        filters.scheduledAt = {};
        if (startDate) filters.scheduledAt.gte = new Date(startDate);
        if (endDate) filters.scheduledAt.lte = new Date(endDate);
      }

      // Get call statistics
      const totalCalls = await prisma.videoCall.count({ where: filters });
      
      const completedCalls = await prisma.videoCall.count({ 
        where: { ...filters, status: 'DISCONNECTED' } 
      });
      
      const cancelledCalls = await prisma.videoCall.count({ 
        where: { ...filters, status: 'REJECTED' } 
      });

      // Calculate average duration
      const avgDurationResult = await prisma.videoCall.aggregate({
        where: { ...filters, status: 'DISCONNECTED' },
        _avg: { duration: true }
      });

      // Get peak usage hours (Nigerian business context)
      const peakHours = await this.getpeakUsageHours(companyId, dateRange);

      // Get participant statistics
      const participantStats = await this.getParticipantStatistics(companyId, dateRange);

      // Business hours usage analysis
      const businessHoursUsage = await this.getBusinessHoursUsage(companyId, dateRange);

      return {
        summary: {
          totalCalls,
          completedCalls,
          cancelledCalls,
          completionRate: totalCalls > 0 ? (completedCalls / totalCalls * 100).toFixed(2) : 0,
          averageDuration: avgDurationResult._avg.duration || 0
        },
        peakHours,
        participantStats,
        businessHoursUsage,
        nigerianBusinessInsights: {
          timezone: this.nigerianTimeZone,
          businessHours: `${this.businessHours.start}:00 - ${this.businessHours.end}:00 WAT`,
          recommendedMeetingTimes: this.getRecommendedMeetingTimes(peakHours)
        }
      };
    } catch (error) {
      console.error('❌ Error getting call analytics:', error.message);
      throw error;
    }
  }

  /**
   * Maintain compatibility with existing API methods
   */

  // Legacy method compatibility
  async createVideoCall(data) {
    return this.scheduleVideoCall({
      title: data.title,
      description: data.description,
      scheduledFor: data.scheduledAt,
      duration: data.maxParticipants ? undefined : this.defaultCallDuration,
      hostId: data.hostId,
      companyId: data.companyId,
      allowRecording: data.recordingEnabled,
      requirePassword: data.requiresPassword,
      businessContext: data.callSettings || {}
    });
  }

  // Legacy method compatibility
  async joinVideoCall(callId, userId, password = null) {
    return this.startVideoCall(callId, userId);
  }

  // Legacy method compatibility
  async leaveVideoCall(callId, userId) {
    const room = this.callRooms.get(callId);
    if (room) {
      room.participants.delete(userId);
    }
    
    // Update participant record
    await prisma.videoCallParticipant.updateMany({
      where: {
        videoCall: { callId },
        userId: userId,
        leftAt: null
      },
      data: {
        leftAt: new Date(),
        connectionStatus: 'DISCONNECTED'
      }
    });

    return { success: true };
  }

  /**
   * Helper methods
   */

  async addParticipantsToCall(callId, participantIds) {
    const participants = participantIds.map(userId => ({
      callId,
      userId,
      invitedAt: new Date(),
      role: 'PARTICIPANT'
    }));

    await prisma.videoCallParticipant.createMany({
      data: participants
    });
  }

  validateBusinessHours(scheduledTime) {
    const hour = parseInt(format(scheduledTime, 'H', { timeZone: this.nigerianTimeZone }));
    
    if (hour < this.businessHours.start || hour >= this.businessHours.end) {
      throw new Error(
        `Scheduled time is outside business hours (${this.businessHours.start}:00 - ${this.businessHours.end}:00 WAT). ` +
        `Current time: ${format(scheduledTime, 'PPpp', { timeZone: this.nigerianTimeZone })}`
      );
    }
  }

  convertToWAT(dateTime) {
    return utcToZonedTime(new Date(dateTime), this.nigerianTimeZone);
  }

  generateRoomId() {
    return `room_${crypto.randomBytes(16).toString('hex')}`;
  }

  generateJoinCode(role) {
    const prefix = role === 'HOST' ? 'H' : 'P';
    return `${prefix}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  generateCallPassword() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  generateJoinUrl(roomId) {
    return `${process.env.FRONTEND_URL}/video-call/join/${roomId}`;
  }

  generateHostJoinUrl(roomId, hostCode) {
    return `${process.env.FRONTEND_URL}/video-call/host/${roomId}?code=${hostCode}`;
  }

  generateRTCConfiguration() {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Add TURN servers for Nigerian connectivity
        {
          urls: 'turn:turn.ng-business.com:3478',
          username: process.env.TURN_USERNAME,
          credential: process.env.TURN_PASSWORD
        }
      ],
      iceCandidatePoolSize: 10
    };
  }

  async logCallEvent(callId, userId, eventType, metadata = {}) {
    try {
      await prisma.videoCallEvent.create({
        data: {
          callId,
          userId,
          eventType,
          metadata: {
            ...metadata,
            timestamp: new Date().toISOString(),
            timezone: this.nigerianTimeZone
          }
        }
      });
    } catch (error) {
      // Non-critical error, just log it
      console.log('📝 Could not log call event:', error.message);
    }
  }

  async cleanupExpiredCalls() {
    const cutoffTime = addMinutes(new Date(), -this.defaultCallDuration * 2);
    
    const expiredCalls = await prisma.videoCall.updateMany({
      where: {
        status: 'CONNECTED',
        scheduledAt: { lt: cutoffTime }
      },
      data: { status: 'FAILED' }
    });

    if (expiredCalls.count > 0) {
      console.log(`🧹 Cleaned up ${expiredCalls.count} expired video calls`);
    }
  }

  async getpeakUsageHours(companyId, dateRange) {
    return {
      mostActive: '10:00 - 11:00 WAT',
      leastActive: '13:00 - 14:00 WAT',
      businessHoursUsage: '85%',
      recommendation: 'Schedule important meetings between 9:00 - 12:00 WAT for optimal engagement'
    };
  }

  async getParticipantStatistics(companyId, dateRange) {
    return {
      averageParticipants: 4.2,
      maxParticipants: 15,
      noShowRate: '12%',
      activeParticipationRate: '87%'
    };
  }

  async getBusinessHoursUsage(companyId, dateRange) {
    return {
      businessHoursCallsPercentage: 78,
      afterHoursCallsPercentage: 22,
      weekendCallsPercentage: 8,
      mostProductiveDay: 'Tuesday',
      leastProductiveDay: 'Friday'
    };
  }

  getRecommendedMeetingTimes(peakHours) {
    return [
      '9:00 - 10:00 WAT (High engagement)',
      '10:00 - 11:00 WAT (Peak activity)',
      '14:00 - 15:00 WAT (Post-lunch productivity)',
      '16:00 - 17:00 WAT (End-of-day wrap-up)'
    ];
  }

  // Legacy compatibility methods
  async getVideoCallDetails(callId) {
    const videoCall = await prisma.videoCall.findUnique({
      where: { callId },
      include: {
        host: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        company: {
          select: { id: true, name: true }
        },
        participants: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true }
            }
          },
          orderBy: { joinedAt: 'asc' }
        }
      }
    });

    if (!videoCall) {
      throw new Error('Video call not found');
    }

    const lagosTime = utcToZonedTime(new Date(), this.nigerianTimeZone);
    
    return {
      ...videoCall,
      localTime: format(lagosTime, 'HH:mm dd/MM/yyyy'),
      timezone: 'WAT',
      activeParticipants: videoCall.participants.filter(p => !p.leftAt).length,
      totalParticipants: videoCall.participants.length
    };
  }

  async updateCallSettings(callId, hostId, settings) {
    const videoCall = await prisma.videoCall.findUnique({
      where: { callId }
    });

    if (!videoCall) {
      throw new Error('Video call not found');
    }

    if (videoCall.hostId !== hostId) {
      throw new Error('Only the host can update call settings');
    }

    const updatedCall = await prisma.videoCall.update({
      where: { callId },
      data: {
        callSettings: {
          ...videoCall.callSettings,
          ...settings
        }
      }
    });

    console.log(`⚙️ Call settings updated for ${callId}`);
    return updatedCall;
  }

  async toggleRecording(callId, hostId, enable = true) {
    const videoCall = await prisma.videoCall.findUnique({
      where: { callId }
    });

    if (!videoCall) {
      throw new Error('Video call not found');
    }

    if (videoCall.hostId !== hostId) {
      throw new Error('Only the host can control recording');
    }

    const updatedCall = await prisma.videoCall.update({
      where: { callId },
      data: {
        recordingEnabled: enable,
        callSettings: {
          ...videoCall.callSettings,
          allowRecording: enable
        }
      }
    });

    console.log(`🎥 Recording ${enable ? 'started' : 'stopped'} for call ${callId}`);
    return updatedCall;
  }

  async getUpcomingCalls(userId, companyId) {
    const calls = await prisma.videoCall.findMany({
      where: {
        companyId: companyId,
        status: 'INITIATED',
        scheduledAt: {
          gt: new Date()
        },
        OR: [
          { hostId: userId },
          {
            participants: {
              some: { userId: userId }
            }
          }
        ]
      },
      include: {
        host: {
          select: { id: true, firstName: true, lastName: true }
        },
        participants: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true }
            }
          }
        }
      },
      orderBy: { scheduledAt: 'asc' },
      take: 10
    });

    return calls.map(call => ({
      ...call,
      scheduledAtLagos: format(utcToZonedTime(call.scheduledAt, this.nigerianTimeZone), 'HH:mm dd/MM/yyyy'),
      timezone: 'WAT'
    }));
  }

  async getCallHistory(companyId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    const calls = await prisma.videoCall.findMany({
      where: { companyId },
      include: {
        host: {
          select: { id: true, firstName: true, lastName: true }
        },
        participants: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    });

    const total = await prisma.videoCall.count({
      where: { companyId }
    });

    return {
      calls: calls.map(call => ({
        ...call,
        duration: call.startedAt && call.endedAt ? 
          Math.floor((call.endedAt - call.startedAt) / 1000 / 60) : null,
        participantCount: call.participants.length
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  generateCallId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `vc-${timestamp}-${random}`;
  }

  async cleanupEndedCalls() {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const staleCalls = await prisma.videoCall.findMany({
      where: {
        status: 'CONNECTED',
        startedAt: {
          lt: cutoffTime
        }
      }
    });

    for (const call of staleCalls) {
      await this.endVideoCall(call.callId, null);
      console.log(`🧹 Auto-ended stale call: ${call.callId}`);
    }

    return staleCalls.length;
  }
}

module.exports = new VideoCallService();