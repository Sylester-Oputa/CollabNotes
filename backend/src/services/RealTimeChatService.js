const { PrismaClient } = require('@prisma/client');
const { Server } = require('socket.io');
const { formatInTimeZone, utcToZonedTime } = require('date-fns-tz');
const { differenceInSeconds, addMinutes } = require('date-fns');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * Global Real-time Chat Service
 * Comprehensive chat system with Socket.IO for worldwide deployment
 * Features: Real-time messaging, typing indicators, file attachments, multi-timezone support
 */
class RealTimeChatService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> {socketId, timezone, status, lastSeen}
    this.activeRooms = new Map(); // roomId -> {participants, typingUsers, metadata}
    this.messageQueue = new Map(); // For offline message delivery
    this.globalTimezones = new Map(); // userId -> timezone preference
    
    // Rate limiting
    this.rateLimits = new Map(); // userId -> {messages: count, resetTime}
    this.maxMessagesPerMinute = 60;
    
    // Typing indicators
    this.typingTimeouts = new Map(); // userId -> timeoutId
    this.typingTimeoutDuration = 3000; // 3 seconds
  }

  /**
   * Initialize real-time chat service with Socket.IO
   */
  async init(server) {
    try {
      console.log('💬 Initializing Global Real-time Chat Service...');
      
      // Initialize Socket.IO with CORS for worldwide access
      this.io = new Server(server, {
        cors: {
          origin: process.env.FRONTEND_URLS?.split(',') || ["http://localhost:3000", "http://localhost:3000"],
          methods: ["GET", "POST"],
          credentials: true
        },
        transports: ['websocket', 'polling'], // Fallback for global connectivity
        pingTimeout: 60000,
        pingInterval: 25000
      });

      // Setup Socket.IO event handlers
      this.setupSocketHandlers();
      
      // Cleanup inactive connections periodically
      this.startCleanupInterval();
      
      console.log('🌍 Global real-time chat service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Real-time chat service initialization error:', error.message);
      throw error;
    }
  }

  /**
   * Setup Socket.IO event handlers
   */
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 New connection: ${socket.id}`);

      // User authentication and join
      socket.on('user:join', async (data) => {
        await this.handleUserJoin(socket, data);
      });

      // Join chat room
      socket.on('room:join', async (data) => {
        await this.handleRoomJoin(socket, data);
      });

      // Leave chat room
      socket.on('room:leave', async (data) => {
        await this.handleRoomLeave(socket, data);
      });

      // Send message
      socket.on('message:send', async (data) => {
        await this.handleMessageSend(socket, data);
      });

      // Message delivery confirmation
      socket.on('message:delivered', async (data) => {
        await this.handleMessageDelivered(socket, data);
      });

      // Message read confirmation
      socket.on('message:read', async (data) => {
        await this.handleMessageRead(socket, data);
      });

      // Typing indicators
      socket.on('typing:start', async (data) => {
        await this.handleTypingStart(socket, data);
      });

      socket.on('typing:stop', async (data) => {
        await this.handleTypingStop(socket, data);
      });

      // Emoji reactions
      socket.on('message:react', async (data) => {
        await this.handleMessageReaction(socket, data);
      });

      // File attachment
      socket.on('file:upload', async (data) => {
        await this.handleFileUpload(socket, data);
      });

      // User status updates
      socket.on('status:update', async (data) => {
        await this.handleStatusUpdate(socket, data);
      });

      // Video call integration
      socket.on('video:invite', async (data) => {
        await this.handleVideoCallInvite(socket, data);
      });

      // Voice message integration
      socket.on('voice:send', async (data) => {
        await this.handleVoiceMessage(socket, data);
      });

      // Disconnect handling
      socket.on('disconnect', async () => {
        await this.handleUserDisconnect(socket);
      });

      // Error handling
      socket.on('error', (error) => {
        console.error(`❌ Socket error for ${socket.id}:`, error);
      });
    });
  }

  /**
   * Handle user joining the chat system
   */
  async handleUserJoin(socket, data) {
    try {
      const { userId, companyId, timezone = 'UTC', accessToken } = data;

      // Verify user authentication (you would implement actual auth verification)
      const user = await this.verifyUserAccess(userId, companyId, accessToken);
      if (!user) {
        socket.emit('auth:error', { message: 'Authentication failed' });
        return;
      }

      // Store user connection info
      this.connectedUsers.set(userId, {
        socketId: socket.id,
        timezone,
        status: 'online',
        lastSeen: new Date(),
        companyId,
        user
      });

      // Store timezone preference
      this.globalTimezones.set(userId, timezone);

      // Join user to their personal room
      socket.join(`user:${userId}`);
      socket.join(`company:${companyId}`);

      // Store user info in socket
      socket.userId = userId;
      socket.companyId = companyId;
      socket.timezone = timezone;

      // Notify user's contacts about online status
      await this.broadcastUserStatus(userId, 'online');

      // Send pending offline messages
      await this.deliverOfflineMessages(userId);

      socket.emit('user:joined', {
        success: true,
        userId,
        timezone,
        serverTime: new Date().toISOString(),
        localTime: formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd HH:mm:ss zzz')
      });

      console.log(`👤 User ${userId} joined from ${timezone} timezone`);
    } catch (error) {
      console.error('❌ Error handling user join:', error);
      socket.emit('user:join:error', { message: 'Failed to join chat system' });
    }
  }

  /**
   * Handle user joining a chat room
   */
  async handleRoomJoin(socket, data) {
    try {
      const { roomId, roomType = 'group' } = data; // 'direct', 'group', 'channel'
      const userId = socket.userId;

      if (!userId) {
        socket.emit('room:join:error', { message: 'User not authenticated' });
        return;
      }

      // Verify room access permissions
      const hasAccess = await this.verifyRoomAccess(userId, roomId, roomType);
      if (!hasAccess) {
        socket.emit('room:join:error', { message: 'Access denied to this room' });
        return;
      }

      // Join socket room
      socket.join(roomId);

      // Update active rooms tracking
      if (!this.activeRooms.has(roomId)) {
        this.activeRooms.set(roomId, {
          participants: new Set(),
          typingUsers: new Set(),
          metadata: { roomType, createdAt: new Date() }
        });
      }

      const room = this.activeRooms.get(roomId);
      room.participants.add(userId);

      // Load recent messages with timezone formatting
      const recentMessages = await this.getRecentMessages(roomId, userId, socket.timezone);

      // Get room info
      const roomInfo = await this.getRoomInfo(roomId, roomType);

      socket.emit('room:joined', {
        success: true,
        roomId,
        roomType,
        roomInfo,
        recentMessages,
        participantCount: room.participants.size
      });

      // Notify other participants
      socket.to(roomId).emit('room:user:joined', {
        userId,
        roomId,
        participantCount: room.participants.size,
        timestamp: new Date().toISOString()
      });

      console.log(`👥 User ${userId} joined room ${roomId} (${roomType})`);
    } catch (error) {
      console.error('❌ Error handling room join:', error);
      socket.emit('room:join:error', { message: 'Failed to join room' });
    }
  }

  /**
   * Handle user leaving a chat room
   */
  async handleRoomLeave(socket, data) {
    try {
      const { roomId } = data;
      const userId = socket.userId;

      if (!userId) return;

      // Leave socket room
      socket.leave(roomId);

      // Update active rooms tracking
      const room = this.activeRooms.get(roomId);
      if (room) {
        room.participants.delete(userId);
        room.typingUsers.delete(userId);

        // Remove room if no participants
        if (room.participants.size === 0) {
          this.activeRooms.delete(roomId);
        }
      }

      // Notify other participants
      socket.to(roomId).emit('room:user:left', {
        userId,
        roomId,
        participantCount: room?.participants.size || 0,
        timestamp: new Date().toISOString()
      });

      // Stop typing indicator if active
      await this.handleTypingStop(socket, { roomId });

      socket.emit('room:left', { success: true, roomId });
      console.log(`👋 User ${userId} left room ${roomId}`);
    } catch (error) {
      console.error('❌ Error handling room leave:', error);
    }
  }

  /**
   * Handle sending a message
   */
  async handleMessageSend(socket, data) {
    try {
      const {
        roomId,
        content,
        type = 'text', // 'text', 'file', 'image', 'voice', 'video_invite'
        replyToId = null,
        metadata = {}
      } = data;
      
      const userId = socket.userId;
      const companyId = socket.companyId;

      if (!userId || !roomId || !content) {
        socket.emit('message:send:error', { message: 'Invalid message data' });
        return;
      }

      // Rate limiting
      if (!this.checkRateLimit(userId)) {
        socket.emit('message:send:error', { message: 'Rate limit exceeded' });
        return;
      }

      // Verify room access
      const hasAccess = await this.verifyRoomAccess(userId, roomId);
      if (!hasAccess) {
        socket.emit('message:send:error', { message: 'Access denied' });
        return;
      }

      // Create message in database
      const message = await prisma.message.create({
        data: {
          content,
          type: type.toUpperCase(),
          senderId: userId,
          groupId: roomId.startsWith('group:') ? roomId.replace('group:', '') : null,
          recipientId: roomId.startsWith('direct:') ? this.extractRecipientId(roomId, userId) : null,
          companyId,
          parentId: replyToId,
          metadata: {
            timezone: socket.timezone,
            serverTime: new Date().toISOString(),
            clientTime: metadata.clientTime,
            ...metadata
          }
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profilePicture: true
            }
          },
          parent: {
            select: {
              id: true,
              content: true,
              sender: {
                select: { firstName: true, lastName: true }
              }
            }
          }
        }
      });

      // Format message with timezone info
      const formattedMessage = this.formatMessageForClients(message);

      // Broadcast to room participants
      this.io.to(roomId).emit('message:new', formattedMessage);

      // Send delivery confirmations to sender
      socket.emit('message:sent', {
        messageId: message.id,
        tempId: metadata.tempId,
        timestamp: message.createdAt,
        status: 'sent'
      });

      // Handle offline users - queue messages for delivery
      await this.queueMessageForOfflineUsers(roomId, message);

      // Stop typing indicator for sender
      await this.handleTypingStop(socket, { roomId });

      console.log(`💬 Message sent by ${userId} in room ${roomId}: ${type}`);
    } catch (error) {
      console.error('❌ Error handling message send:', error);
      socket.emit('message:send:error', { message: 'Failed to send message' });
    }
  }

  /**
   * Handle typing start
   */
  async handleTypingStart(socket, data) {
    try {
      const { roomId } = data;
      const userId = socket.userId;

      if (!userId || !roomId) return;

      const room = this.activeRooms.get(roomId);
      if (!room) return;

      // Add user to typing users
      room.typingUsers.add(userId);

      // Clear existing typing timeout
      if (this.typingTimeouts.has(userId)) {
        clearTimeout(this.typingTimeouts.get(userId));
      }

      // Broadcast typing indicator to other users in room
      socket.to(roomId).emit('typing:start', {
        userId,
        roomId,
        timestamp: new Date().toISOString()
      });

      // Auto-stop typing after timeout
      const timeoutId = setTimeout(() => {
        this.handleTypingStop(socket, { roomId });
      }, this.typingTimeoutDuration);

      this.typingTimeouts.set(userId, timeoutId);
    } catch (error) {
      console.error('❌ Error handling typing start:', error);
    }
  }

  /**
   * Handle typing stop
   */
  async handleTypingStop(socket, data) {
    try {
      const { roomId } = data;
      const userId = socket.userId;

      if (!userId || !roomId) return;

      const room = this.activeRooms.get(roomId);
      if (!room) return;

      // Remove user from typing users
      room.typingUsers.delete(userId);

      // Clear typing timeout
      if (this.typingTimeouts.has(userId)) {
        clearTimeout(this.typingTimeouts.get(userId));
        this.typingTimeouts.delete(userId);
      }

      // Broadcast typing stop to other users in room
      socket.to(roomId).emit('typing:stop', {
        userId,
        roomId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error handling typing stop:', error);
    }
  }

  /**
   * Handle message reactions
   */
  async handleMessageReaction(socket, data) {
    try {
      const { messageId, emoji, action = 'add' } = data; // 'add' or 'remove'
      const userId = socket.userId;

      if (!userId || !messageId || !emoji) return;

      // Get message to verify access
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { reactions: true }
      });

      if (!message) {
        socket.emit('message:react:error', { message: 'Message not found' });
        return;
      }

      // Verify user has access to this message
      const hasAccess = await this.verifyMessageAccess(userId, message);
      if (!hasAccess) {
        socket.emit('message:react:error', { message: 'Access denied' });
        return;
      }

      let reaction;
      if (action === 'add') {
        // Add or update reaction
        reaction = await prisma.messageReaction.upsert({
          where: {
            messageId_userId: {
              messageId,
              userId
            }
          },
          update: { emoji },
          create: {
            messageId,
            userId,
            emoji
          }
        });
      } else {
        // Remove reaction
        await prisma.messageReaction.delete({
          where: {
            messageId_userId: {
              messageId,
              userId
            }
          }
        });
      }

      // Get updated reactions count
      const reactionsCount = await this.getMessageReactionsCount(messageId);

      // Determine room ID for broadcasting
      const roomId = message.groupId ? `group:${message.groupId}` : `direct:${message.senderId}:${message.recipientId}`;

      // Broadcast reaction update
      this.io.to(roomId).emit('message:reaction:updated', {
        messageId,
        userId,
        emoji,
        action,
        reactionsCount,
        timestamp: new Date().toISOString()
      });

      console.log(`${action === 'add' ? '👍' : '👎'} Reaction ${action} by ${userId} on message ${messageId}: ${emoji}`);
    } catch (error) {
      console.error('❌ Error handling message reaction:', error);
      socket.emit('message:react:error', { message: 'Failed to update reaction' });
    }
  }

  /**
   * Handle user disconnect
   */
  async handleUserDisconnect(socket) {
    try {
      const userId = socket.userId;
      if (!userId) return;

      // Update user status
      this.connectedUsers.delete(userId);

      // Clean up typing indicators
      if (this.typingTimeouts.has(userId)) {
        clearTimeout(this.typingTimeouts.get(userId));
        this.typingTimeouts.delete(userId);
      }

      // Remove from active rooms
      for (const [roomId, room] of this.activeRooms.entries()) {
        if (room.participants.has(userId)) {
          room.participants.delete(userId);
          room.typingUsers.delete(userId);

          // Notify room about user leaving
          this.io.to(roomId).emit('room:user:left', {
            userId,
            roomId,
            participantCount: room.participants.size,
            timestamp: new Date().toISOString()
          });

          // Remove empty rooms
          if (room.participants.size === 0) {
            this.activeRooms.delete(roomId);
          }
        }
      }

      // Update user's last seen
      await this.updateUserLastSeen(userId);

      // Broadcast user offline status
      await this.broadcastUserStatus(userId, 'offline');

      console.log(`🔌 User ${userId} disconnected from ${socket.id}`);
    } catch (error) {
      console.error('❌ Error handling user disconnect:', error);
    }
  }

  /**
   * Helper methods
   */

  async verifyUserAccess(userId, companyId, accessToken) {
    try {
      // Implement actual JWT verification or session validation
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          companyId: companyId,
          isActive: true
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          companyId: true
        }
      });

      return user;
    } catch (error) {
      console.error('❌ Error verifying user access:', error);
      return null;
    }
  }

  async verifyRoomAccess(userId, roomId, roomType = 'group') {
    try {
      if (roomId.startsWith('direct:')) {
        // Direct message room - check if user is part of the conversation
        const userIds = roomId.replace('direct:', '').split(':');
        return userIds.includes(userId);
      }

      if (roomId.startsWith('group:')) {
        // Group room - check group membership
        const groupId = roomId.replace('group:', '');
        const membership = await prisma.messageGroupMember.findFirst({
          where: {
            groupId,
            userId,
            isActive: true
          }
        });
        return !!membership;
      }

      return false;
    } catch (error) {
      console.error('❌ Error verifying room access:', error);
      return false;
    }
  }

  async getRecentMessages(roomId, userId, timezone) {
    try {
      const isDirectRoom = roomId.startsWith('direct:');
      const groupId = roomId.startsWith('group:') ? roomId.replace('group:', '') : null;
      const recipientId = isDirectRoom ? this.extractRecipientId(roomId, userId) : null;

      const messages = await prisma.message.findMany({
        where: {
          ...(groupId ? { groupId } : { 
            OR: [
              { senderId: userId, recipientId },
              { senderId: recipientId, recipientId: userId }
            ]
          }),
          deletedAt: null
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePicture: true
            }
          },
          reactions: {
            include: {
              user: {
                select: { firstName: true, lastName: true }
              }
            }
          },
          parent: {
            select: {
              id: true,
              content: true,
              sender: {
                select: { firstName: true, lastName: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      // Format messages with user's timezone
      return messages.map(message => this.formatMessageForClients(message, timezone)).reverse();
    } catch (error) {
      console.error('❌ Error getting recent messages:', error);
      return [];
    }
  }

  formatMessageForClients(message, timezone = 'UTC') {
    return {
      ...message,
      localTime: formatInTimeZone(message.createdAt, timezone, 'yyyy-MM-dd HH:mm:ss zzz'),
      timeAgo: this.getTimeAgo(message.createdAt),
      reactions: this.groupReactionsByEmoji(message.reactions || [])
    };
  }

  groupReactionsByEmoji(reactions) {
    const grouped = {};
    reactions.forEach(reaction => {
      if (!grouped[reaction.emoji]) {
        grouped[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: []
        };
      }
      grouped[reaction.emoji].count++;
      grouped[reaction.emoji].users.push({
        id: reaction.userId,
        name: `${reaction.user.firstName} ${reaction.user.lastName}`
      });
    });
    return Object.values(grouped);
  }

  extractRecipientId(directRoomId, currentUserId) {
    const userIds = directRoomId.replace('direct:', '').split(':');
    return userIds.find(id => id !== currentUserId);
  }

  checkRateLimit(userId) {
    const now = Date.now();
    const userLimit = this.rateLimits.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      // Reset or initialize rate limit
      this.rateLimits.set(userId, {
        messages: 1,
        resetTime: now + 60000 // 1 minute
      });
      return true;
    }

    if (userLimit.messages >= this.maxMessagesPerMinute) {
      return false;
    }

    userLimit.messages++;
    return true;
  }

  getTimeAgo(date) {
    const seconds = differenceInSeconds(new Date(), date);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  async broadcastUserStatus(userId, status) {
    // Broadcast to user's contacts and company
    const user = this.connectedUsers.get(userId);
    if (user) {
      this.io.to(`company:${user.companyId}`).emit('user:status:changed', {
        userId,
        status,
        lastSeen: new Date().toISOString()
      });
    }
  }

  async updateUserLastSeen(userId) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { lastSeen: new Date() }
      });
    } catch (error) {
      console.error('❌ Error updating last seen:', error);
    }
  }

  startCleanupInterval() {
    // Clean up inactive connections every 5 minutes
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, 5 * 60 * 1000);
  }

  cleanupInactiveConnections() {
    const now = new Date();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

    for (const [userId, userData] of this.connectedUsers.entries()) {
      if (now - userData.lastSeen > inactiveThreshold) {
        this.connectedUsers.delete(userId);
        console.log(`🧹 Cleaned up inactive connection for user ${userId}`);
      }
    }
  }

  // Integration methods for video calls and voice messages
  async handleVideoCallInvite(socket, data) {
    const { roomId, callId, participants } = data;
    
    // Broadcast video call invitation to room participants
    socket.to(roomId).emit('video:invite:received', {
      callId,
      invitedBy: socket.userId,
      roomId,
      participants,
      timestamp: new Date().toISOString()
    });
  }

  async handleVoiceMessage(socket, data) {
    // Handle voice message through VoiceMessageService
    const voiceMessageService = require('./VoiceMessageService');
    const result = await voiceMessageService.uploadVoiceMessage(data);
    
    // Broadcast voice message to room
    this.io.to(data.roomId).emit('message:new', {
      ...result,
      type: 'voice',
      sender: this.connectedUsers.get(socket.userId)?.user
    });
  }

  // Additional helper methods
  async getRoomInfo(roomId, roomType) {
    if (roomType === 'group') {
      const groupId = roomId.replace('group:', '');
      return await prisma.messageGroup.findUnique({
        where: { id: groupId },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profilePicture: true
                }
              }
            }
          }
        }
      });
    }
    return null;
  }

  async verifyMessageAccess(userId, message) {
    // Check if user has access to the message
    if (message.senderId === userId) return true;
    if (message.recipientId === userId) return true;
    
    if (message.groupId) {
      const membership = await prisma.messageGroupMember.findFirst({
        where: {
          groupId: message.groupId,
          userId,
          isActive: true
        }
      });
      return !!membership;
    }
    
    return false;
  }

  async getMessageReactionsCount(messageId) {
    const reactions = await prisma.messageReaction.groupBy({
      by: ['emoji'],
      where: { messageId },
      _count: { emoji: true }
    });

    return reactions.reduce((acc, reaction) => {
      acc[reaction.emoji] = reaction._count.emoji;
      return acc;
    }, {});
  }

  async deliverOfflineMessages(userId) {
    // Implement offline message delivery
    const queuedMessages = this.messageQueue.get(userId) || [];
    
    if (queuedMessages.length > 0) {
      const userSocket = this.connectedUsers.get(userId)?.socketId;
      if (userSocket) {
        this.io.to(userSocket).emit('messages:offline:delivery', {
          messages: queuedMessages,
          count: queuedMessages.length
        });
      }
      
      // Clear delivered messages
      this.messageQueue.delete(userId);
    }
  }

  async queueMessageForOfflineUsers(roomId, message) {
    // Queue messages for offline users in the room
    // This would be implemented based on your specific needs
  }

  async handleMessageDelivered(socket, data) {
    // Handle message delivery confirmation
    const { messageId } = data;
    
    // Update message delivery status
    await prisma.message.update({
      where: { id: messageId },
      data: { deliveredAt: new Date() }
    });
    
    // Notify sender about delivery
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { senderId: true }
    });
    
    if (message) {
      const senderConnection = this.connectedUsers.get(message.senderId);
      if (senderConnection) {
        this.io.to(senderConnection.socketId).emit('message:delivery:confirmed', {
          messageId,
          deliveredAt: new Date().toISOString()
        });
      }
    }
  }

  async handleMessageRead(socket, data) {
    // Handle message read confirmation
    const { messageId } = data;
    
    // Update message read status
    await prisma.message.update({
      where: { id: messageId },
      data: { readAt: new Date() }
    });
    
    // Notify sender about read receipt
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { senderId: true }
    });
    
    if (message) {
      const senderConnection = this.connectedUsers.get(message.senderId);
      if (senderConnection) {
        this.io.to(senderConnection.socketId).emit('message:read:confirmed', {
          messageId,
          readAt: new Date().toISOString(),
          readBy: socket.userId
        });
      }
    }
  }

  async handleStatusUpdate(socket, data) {
    // Handle user status updates (online, away, busy, etc.)
    const { status } = data;
    const userId = socket.userId;
    
    if (!userId) return;
    
    // Update stored user status
    const userConnection = this.connectedUsers.get(userId);
    if (userConnection) {
      userConnection.status = status;
      userConnection.lastSeen = new Date();
    }
    
    // Broadcast status change
    await this.broadcastUserStatus(userId, status);
  }

  async handleFileUpload(socket, data) {
    // Handle file upload integration
    const { roomId, fileName, fileSize, fileType, fileUrl } = data;
    
    // Create file message
    await this.handleMessageSend(socket, {
      roomId,
      content: fileName,
      type: 'file',
      metadata: {
        fileName,
        fileSize,
        fileType,
        fileUrl
      }
    });
  }
}

module.exports = RealTimeChatService;