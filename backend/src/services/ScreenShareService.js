// Screen Share Service for CollabNotes Nigeria
const { PrismaClient } = require('@prisma/client');
const { format } = require('date-fns');
const { toZonedTime } = require('date-fns-tz');

const prisma = new PrismaClient();

class ScreenShareService {
  constructor() {
    this.lagosTimezone = 'Africa/Lagos';
    this.activeSessions = new Map(); // Track active screen share sessions
    this.maxSessionDuration = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
    this.maxViewers = 50; // Maximum viewers per session
  }

  /**
   * Start a new screen share session
   */
  async startScreenShare(data) {
    try {
      const session = await prisma.screenShareSession.create({
        data: {
          sessionId: this.generateSessionId(),
          hostId: data.hostId,
          companyId: data.companyId,
          title: data.title,
          description: data.description || null,
          isRecorded: data.isRecorded || false,
          allowAnnotations: data.allowAnnotations || true,
          allowViewerControl: data.allowViewerControl || false,
          maxViewers: data.maxViewers || this.maxViewers,
          quality: data.quality || 'HD',
          status: 'ACTIVE',
          sessionSettings: {
            ...data.sessionSettings,
            lagosTimezone: 'Africa/Lagos',
            allowChat: data.allowChat !== undefined ? data.allowChat : true,
            allowFileSharing: data.allowFileSharing !== undefined ? data.allowFileSharing : true,
            requirePermission: data.requirePermission !== undefined ? data.requirePermission : false
          },
          metadata: data.metadata || {}
        },
        include: {
          host: {
            select: { id: true, firstName: true, lastName: true, email: true }
          },
          company: {
            select: { id: true, name: true }
          }
        }
      });

      // Track active session
      this.activeSessions.set(session.sessionId, {
        id: session.id,
        viewers: [],
        startTime: new Date(),
        lastActivity: new Date()
      });

      console.log(`🖥️ Screen share session started: ${session.title} (${session.sessionId})`);
      return session;
    } catch (error) {
      console.error('Error starting screen share session:', error);
      throw new Error('Failed to start screen share session');
    }
  }

  /**
   * Join a screen share session as viewer
   */
  async joinScreenShare(sessionId, userId, requestedPermissions = []) {
    try {
      const session = await prisma.screenShareSession.findUnique({
        where: { sessionId },
        include: {
          viewers: true,
          host: true
        }
      });

      if (!session) {
        throw new Error('Screen share session not found');
      }

      if (session.status !== 'ACTIVE') {
        throw new Error('Screen share session is not active');
      }

      // Check viewer limit
      if (session.viewers.length >= session.maxViewers) {
        throw new Error('Session has reached maximum viewer capacity');
      }

      // Check if user is already viewing
      const existingViewer = session.viewers.find(v => v.userId === userId);
      if (existingViewer) {
        return {
          session,
          viewer: existingViewer,
          message: 'Already viewing session'
        };
      }

      // Create viewer record
      const viewer = await prisma.screenShareViewer.create({
        data: {
          sessionId: session.id,
          userId: userId,
          joinedAt: new Date(),
          permissions: requestedPermissions,
          isActive: true,
          viewerSettings: {
            quality: 'auto',
            soundEnabled: true,
            annotationsEnabled: session.allowAnnotations
          }
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true }
          }
        }
      });

      // Update active session tracking
      const activeSession = this.activeSessions.get(sessionId);
      if (activeSession) {
        activeSession.viewers.push(userId);
        activeSession.lastActivity = new Date();
      }

      console.log(`👁️ User ${userId} joined screen share session ${sessionId}`);
      return { session, viewer };
    } catch (error) {
      console.error('Error joining screen share session:', error);
      throw error;
    }
  }

  /**
   * Leave a screen share session
   */
  async leaveScreenShare(sessionId, userId) {
    try {
      const viewer = await prisma.screenShareViewer.findFirst({
        where: {
          session: { sessionId },
          userId: userId,
          isActive: true
        }
      });

      if (!viewer) {
        throw new Error('Viewer not found in session');
      }

      // Update viewer record
      await prisma.screenShareViewer.update({
        where: { id: viewer.id },
        data: {
          leftAt: new Date(),
          isActive: false
        }
      });

      // Update active session tracking
      const activeSession = this.activeSessions.get(sessionId);
      if (activeSession) {
        activeSession.viewers = activeSession.viewers.filter(id => id !== userId);
        activeSession.lastActivity = new Date();
      }

      console.log(`👁️ User ${userId} left screen share session ${sessionId}`);
      return { success: true };
    } catch (error) {
      console.error('Error leaving screen share session:', error);
      throw error;
    }
  }

  /**
   * End a screen share session
   */
  async endScreenShare(sessionId, userId) {
    try {
      const session = await prisma.screenShareSession.findUnique({
        where: { sessionId },
        include: {
          viewers: {
            where: { isActive: true }
          }
        }
      });

      if (!session) {
        throw new Error('Screen share session not found');
      }

      // Only host can end the session
      if (session.hostId !== userId) {
        throw new Error('Only the host can end the session');
      }

      // Update all active viewers
      await prisma.screenShareViewer.updateMany({
        where: {
          sessionId: session.id,
          isActive: true
        },
        data: {
          leftAt: new Date(),
          isActive: false
        }
      });

      // Update session record
      const updatedSession = await prisma.screenShareSession.update({
        where: { id: session.id },
        data: {
          status: 'ENDED',
          endedAt: new Date()
        }
      });

      // Remove from active sessions tracking
      this.activeSessions.delete(sessionId);

      console.log(`🖥️ Screen share session ended: ${sessionId}`);
      return updatedSession;
    } catch (error) {
      console.error('Error ending screen share session:', error);
      throw error;
    }
  }

  /**
   * Create an annotation during screen share
   */
  async createAnnotation(sessionId, userId, annotationData) {
    try {
      const session = await prisma.screenShareSession.findUnique({
        where: { sessionId }
      });

      if (!session) {
        throw new Error('Screen share session not found');
      }

      if (!session.allowAnnotations) {
        throw new Error('Annotations are not allowed in this session');
      }

      // Check if user is host or has annotation permissions
      const canAnnotate = session.hostId === userId || 
        await this.hasPermission(session.id, userId, 'annotate');

      if (!canAnnotate) {
        throw new Error('You do not have permission to create annotations');
      }

      const annotation = await prisma.screenShareAnnotation.create({
        data: {
          sessionId: session.id,
          userId: userId,
          type: annotationData.type, // 'ARROW', 'CIRCLE', 'TEXT', 'HIGHLIGHT'
          coordinates: annotationData.coordinates,
          content: annotationData.content || null,
          color: annotationData.color || '#FF0000',
          style: annotationData.style || {},
          isVisible: true
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true }
          }
        }
      });

      console.log(`✏️ Annotation created in session ${sessionId} by user ${userId}`);
      return annotation;
    } catch (error) {
      console.error('Error creating annotation:', error);
      throw error;
    }
  }

  /**
   * Update session settings
   */
  async updateSessionSettings(sessionId, hostId, settings) {
    try {
      const session = await prisma.screenShareSession.findUnique({
        where: { sessionId }
      });

      if (!session) {
        throw new Error('Screen share session not found');
      }

      if (session.hostId !== hostId) {
        throw new Error('Only the host can update session settings');
      }

      const updatedSession = await prisma.screenShareSession.update({
        where: { sessionId },
        data: {
          sessionSettings: {
            ...session.sessionSettings,
            ...settings
          }
        }
      });

      console.log(`⚙️ Session settings updated for ${sessionId}`);
      return updatedSession;
    } catch (error) {
      console.error('Error updating session settings:', error);
      throw error;
    }
  }

  /**
   * Grant or revoke viewer permissions
   */
  async updateViewerPermissions(sessionId, hostId, viewerId, permissions) {
    try {
      const session = await prisma.screenShareSession.findUnique({
        where: { sessionId }
      });

      if (!session) {
        throw new Error('Screen share session not found');
      }

      if (session.hostId !== hostId) {
        throw new Error('Only the host can update viewer permissions');
      }

      const viewer = await prisma.screenShareViewer.findFirst({
        where: {
          sessionId: session.id,
          userId: viewerId,
          isActive: true
        }
      });

      if (!viewer) {
        throw new Error('Viewer not found in session');
      }

      const updatedViewer = await prisma.screenShareViewer.update({
        where: { id: viewer.id },
        data: {
          permissions: permissions
        }
      });

      console.log(`🔐 Permissions updated for viewer ${viewerId} in session ${sessionId}`);
      return updatedViewer;
    } catch (error) {
      console.error('Error updating viewer permissions:', error);
      throw error;
    }
  }

  /**
   * Get session details and participants
   */
  async getSessionDetails(sessionId) {
    try {
      const session = await prisma.screenShareSession.findUnique({
        where: { sessionId },
        include: {
          host: {
            select: { id: true, firstName: true, lastName: true, email: true }
          },
          company: {
            select: { id: true, name: true }
          },
          viewers: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, email: true }
              }
            },
            orderBy: { joinedAt: 'asc' }
          },
          annotations: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true }
              }
            },
            where: { isVisible: true },
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!session) {
        throw new Error('Screen share session not found');
      }

      // Add Lagos time formatting
      const lagosTime = toZonedTime(new Date(), this.lagosTimezone);
      
      return {
        ...session,
        localTime: format(lagosTime, 'HH:mm dd/MM/yyyy'),
        timezone: 'WAT',
        duration: session.startedAt && session.endedAt ? 
          Math.floor((session.endedAt - session.startedAt) / 1000 / 60) : 
          session.startedAt ? Math.floor((new Date() - session.startedAt) / 1000 / 60) : 0,
        activeViewers: session.viewers.filter(v => v.isActive).length,
        totalViewers: session.viewers.length,
        annotationCount: session.annotations.length
      };
    } catch (error) {
      console.error('Error getting session details:', error);
      throw error;
    }
  }

  /**
   * Get session history for a company
   */
  async getSessionHistory(companyId, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      
      const sessions = await prisma.screenShareSession.findMany({
        where: { companyId },
        include: {
          host: {
            select: { id: true, firstName: true, lastName: true }
          },
          viewers: {
            select: { userId: true, joinedAt: true, leftAt: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      });

      const total = await prisma.screenShareSession.count({
        where: { companyId }
      });

      return {
        sessions: sessions.map(session => ({
          ...session,
          duration: session.startedAt && session.endedAt ? 
            Math.floor((session.endedAt - session.startedAt) / 1000 / 60) : null,
          viewerCount: session.viewers.length,
          createdAtLagos: format(toZonedTime(session.createdAt, this.lagosTimezone), 'HH:mm dd/MM/yyyy')
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting session history:', error);
      throw error;
    }
  }

  /**
   * Get active sessions for a company
   */
  async getActiveSessions(companyId) {
    try {
      const sessions = await prisma.screenShareSession.findMany({
        where: {
          companyId: companyId,
          status: 'ACTIVE'
        },
        include: {
          host: {
            select: { id: true, firstName: true, lastName: true }
          },
          viewers: {
            where: { isActive: true },
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true }
              }
            }
          }
        },
        orderBy: { startedAt: 'desc' }
      });

      return sessions.map(session => ({
        ...session,
        duration: Math.floor((new Date() - session.startedAt) / 1000 / 60),
        activeViewers: session.viewers.length,
        startedAtLagos: format(toZonedTime(session.startedAt, this.lagosTimezone), 'HH:mm dd/MM/yyyy')
      }));
    } catch (error) {
      console.error('Error getting active sessions:', error);
      throw error;
    }
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(sessionId, userId, permission) {
    try {
      const viewer = await prisma.screenShareViewer.findFirst({
        where: {
          sessionId: sessionId,
          userId: userId,
          isActive: true
        }
      });

      return viewer && viewer.permissions.includes(permission);
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Get screen share analytics
   */
  async getScreenShareAnalytics(companyId, dateRange = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      let totalSessions = 0;
      try {
        totalSessions = await prisma.screenShareSession.count({
          where: {
            companyId: companyId,
            startedAt: { gte: startDate }
          }
        });
      } catch (error) {
        console.error('Error counting screen share sessions:', error);
      }

      let activeSessions = 0;
      try {
        activeSessions = await prisma.screenShareSession.count({
          where: {
            companyId: companyId,
            status: 'ACTIVE'
          }
        });
      } catch (error) {
        console.error('Error counting active sessions:', error);
      }

      let completedSessions = 0;
      try {
        completedSessions = await prisma.screenShareSession.count({
          where: {
            companyId: companyId,
            status: 'ENDED',
            startedAt: { gte: startDate }
          }
        });
      } catch (error) {
        console.error('Error counting completed sessions:', error);
      }

      // Get session durations
      let totalDuration = 0;
      let sessionsWithDuration = [];
      try {
        sessionsWithDuration = await prisma.screenShareSession.findMany({
          where: {
            companyId: companyId,
            startedAt: { not: null },
            endedAt: { not: null },
            startedAt: { gte: startDate }
          },
          select: {
            startedAt: true,
            endedAt: true
          }
        });

        totalDuration = sessionsWithDuration.reduce((sum, session) => {
          return sum + (session.endedAt - session.startedAt);
        }, 0);
      } catch (error) {
        console.error('Error getting session durations:', error);
      }

      // Get total viewers - check if screenShareViewer table exists
      let totalViewers = 0;
      try {
        if (prisma.screenShareViewer) {
          totalViewers = await prisma.screenShareViewer.count({
            where: {
              session: {
                companyId: companyId,
                createdAt: { gte: startDate }
              }
            }
          });
        }
      } catch (error) {
        console.error('ScreenShareViewer table may not exist:', error);
      }

      // Get total annotations - check if screenShareAnnotation table exists
      let totalAnnotations = 0;
      try {
        if (prisma.screenShareAnnotation) {
          totalAnnotations = await prisma.screenShareAnnotation.count({
            where: {
              session: {
                companyId: companyId,
                createdAt: { gte: startDate }
              }
            }
          });
        }
      } catch (error) {
        console.error('ScreenShareAnnotation table may not exist:', error);
      }

      return {
        totalSessions,
        activeSessions,
        completedSessions,
        totalDurationMinutes: Math.floor(totalDuration / 1000 / 60),
        averageSessionDuration: completedSessions > 0 ? 
          Math.floor(totalDuration / completedSessions / 1000 / 60) : 0,
        totalViewers,
        averageViewersPerSession: totalSessions > 0 ? 
          (totalViewers / totalSessions).toFixed(1) : 0,
        totalAnnotations,
        averageAnnotationsPerSession: totalSessions > 0 ? 
          (totalAnnotations / totalSessions).toFixed(1) : 0
      };
    } catch (error) {
      console.error('Error getting screen share analytics:', error);
      throw error;
    }
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `ss-${timestamp}-${random}`;
  }

  /**
   * Clean up ended sessions periodically
   */
  async cleanupEndedSessions() {
    try {
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      // Auto-end sessions that have been inactive
      const staleSessions = await prisma.screenShareSession.findMany({
        where: {
          status: 'ACTIVE',
          startedAt: {
            lt: cutoffTime
          }
        }
      });

      for (const session of staleSessions) {
        await this.endScreenShare(session.sessionId, null);
        console.log(`🧹 Auto-ended stale screen share session: ${session.sessionId}`);
      }

      return staleSessions.length;
    } catch (error) {
      console.error('Error cleaning up ended sessions:', error);
      throw error;
    }
  }
}

module.exports = new ScreenShareService();