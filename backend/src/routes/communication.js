// Global Communication API Routes for CollabNotes
const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const multer = require('multer');
const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  }
});

// Import global services
const RealTimeChatService = require('../services/RealTimeChatService');
const VideoCallService = require('../services/VideoCallService');
const ScreenShareService = require('../services/ScreenShareService');
const VoiceMessageService = require('../services/VoiceMessageService');
const EmailService = require('../services/emailService');
const CollaborativeDocumentService = require('../services/CollaborativeDocumentService');
const FileSharingService = require('../services/FileSharingService');
const { formatInTimeZone } = require('date-fns-tz');

// Middleware for validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Middleware for authentication (implement based on your auth system)
const authenticateToken = async (req, res, next) => {
  try {
    // Implement JWT or session-based authentication
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Verify token and set user info
    // const user = await verifyToken(token);
    // req.user = user;
    
    // For now, mock user data (replace with actual authentication)
    req.user = {
      id: req.headers['x-user-id'] || 'user-1',
      companyId: req.headers['x-company-id'] || 'company-1',
      timezone: req.headers['x-timezone'] || 'UTC'
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid authentication' });
  }
};

// Middleware to ensure users belong to the same company
const requireSameCompany = async (req, res, next) => {
  try {
    // This middleware should verify that the user has access to the company resources
    // For now, we'll assume the user's company ID is already set in req.user
    if (!req.user || !req.user.companyId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Company access required' 
      });
    }
    
    next();
  } catch (error) {
    return res.status(403).json({ 
      success: false, 
      message: 'Company access verification failed' 
    });
  }
};

// ==============================================
// EMAIL INTEGRATION ROUTES
// ==============================================

// Create email template
router.post('/email/templates', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const { name, subject, htmlContent, textContent, category } = req.body;
    
    const template = await EmailService.createEmailTemplate({
      name,
      subject,
      htmlContent,
      textContent,
      category,
      companyId: req.user.companyId,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Email template created successfully',
      data: template
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Send email from template
router.post('/email/send/template', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const { templateId, recipients, variables, scheduledFor } = req.body;
    
    const result = await EmailService.sendEmailFromTemplate(templateId, {
      recipients,
      variables,
      scheduledFor,
      sentBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Email sent successfully',
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Send direct email
router.post('/email/send', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const { to, subject, htmlContent, textContent, scheduledFor } = req.body;
    
    const result = await EmailService.sendEmail({
      to,
      subject,
      htmlContent,
      textContent,
      scheduledFor,
      sentBy: req.user.id,
      companyId: req.user.companyId
    });

    res.json({
      success: true,
      message: 'Email sent successfully',
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get email analytics
router.get('/email/analytics', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const { dateRange } = req.query;
    
    const analytics = await EmailService.getEmailAnalytics(req.user.companyId, parseInt(dateRange) || 30);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Track email open
router.get('/email/track/:emailId', async (req, res) => {
  try {
    await EmailService.trackEmailOpen(req.params.emailId);
    
    // Return 1x1 transparent pixel
    const pixel = Buffer.from([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
      0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0x21,
      0xF9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2C, 0x00, 0x00,
      0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x04,
      0x01, 0x00, 0x3B
    ]);
    
    res.set('Content-Type', 'image/gif');
    res.send(pixel);
  } catch (error) {
    res.status(500).send();
  }
});

// ==============================================
// VIDEO CALLING ROUTES
// ==============================================

// Create video call
router.post('/video/calls', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const { title, description, scheduledFor, participants, settings } = req.body;
    
    const call = await VideoCallService.createVideoCall({
      title,
      description,
      scheduledFor,
      participants,
      settings,
      hostId: req.user.id,
      companyId: req.user.companyId
    });

    res.status(201).json({
      success: true,
      message: 'Video call created successfully',
      data: call
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Join video call
router.post('/video/calls/:callId/join', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const result = await VideoCallService.joinVideoCall(req.params.callId, req.user.id);

    res.json({
      success: true,
      message: 'Joined video call successfully',
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Leave video call
router.post('/video/calls/:callId/leave', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    await VideoCallService.leaveVideoCall(req.params.callId, req.user.id);

    res.json({
      success: true,
      message: 'Left video call successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get call details
router.get('/video/calls/:callId', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const call = await VideoCallService.getCallDetails(req.params.callId, req.user.id);

    res.json({
      success: true,
      data: call
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Toggle call recording
router.post('/video/calls/:callId/recording', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const { action } = req.body; // 'start' or 'stop'
    
    const result = await VideoCallService.toggleRecording(req.params.callId, req.user.id, action);

    res.json({
      success: true,
      message: `Recording ${action}ed successfully`,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// ==============================================
// VOICE MESSAGING ROUTES
// ==============================================

// Upload voice message
router.post('/voice/messages', authenticateToken, requireSameCompany, upload.single('voice'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Voice file is required'
      });
    }

    const { targetId, targetType, duration } = req.body;
    
    const voiceMessage = await VoiceMessageService.uploadVoiceMessage({
      file: req.file,
      targetId,
      targetType,
      duration: parseFloat(duration),
      senderId: req.user.id,
      companyId: req.user.companyId
    });

    res.status(201).json({
      success: true,
      message: 'Voice message uploaded successfully',
      data: voiceMessage
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get voice message
router.get('/voice/messages/:messageId', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const message = await VoiceMessageService.getVoiceMessage(req.params.messageId, req.user.id);

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Record playback
router.post('/voice/messages/:messageId/playback', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    await VoiceMessageService.recordPlayback(req.params.messageId, req.user.id);

    res.json({
      success: true,
      message: 'Playback recorded'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Search voice messages
router.get('/voice/search', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const { query, targetType, page, limit } = req.query;
    
    const results = await VoiceMessageService.searchVoiceMessages(req.user.companyId, {
      query,
      targetType,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// ==============================================
// SCREEN SHARING ROUTES
// ==============================================

// Start screen share session
router.post('/screen-share/sessions', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const { title, description, allowAnnotations, maxViewers } = req.body;
    
    const session = await ScreenShareService.startScreenShare({
      title,
      description,
      allowAnnotations,
      maxViewers,
      hostId: req.user.id,
      companyId: req.user.companyId
    });

    res.status(201).json({
      success: true,
      message: 'Screen share session started',
      data: session
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Join screen share session
router.post('/screen-share/sessions/:sessionId/join', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const result = await ScreenShareService.joinScreenShare(req.params.sessionId, req.user.id);

    res.json({
      success: true,
      message: 'Joined screen share session',
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Create annotation
router.post('/screen-share/sessions/:sessionId/annotations', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const { type, coordinates, content, style } = req.body;
    
    const annotation = await ScreenShareService.createAnnotation(req.params.sessionId, req.user.id, {
      type,
      coordinates,
      content,
      style
    });

    res.status(201).json({
      success: true,
      message: 'Annotation created',
      data: annotation
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get session details
router.get('/screen-share/sessions/:sessionId', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const session = await ScreenShareService.getSessionDetails(req.params.sessionId, req.user.id);

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// ==============================================
// COLLABORATIVE DOCUMENT ROUTES
// ==============================================

// Create document
router.post('/documents', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const { title, content, type, isPublic, settings, metadata } = req.body;
    
    const document = await CollaborativeDocumentService.createDocument({
      title,
      content,
      type,
      isPublic,
      settings,
      metadata,
      ownerId: req.user.id,
      companyId: req.user.companyId
    });

    res.status(201).json({
      success: true,
      message: 'Document created successfully',
      data: document
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Update document content
router.put('/documents/:documentId/content', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const { content, createVersion, changeDescription } = req.body;
    
    const document = await CollaborativeDocumentService.updateDocumentContent(
      req.params.documentId,
      req.user.id,
      {
        content,
        createVersion,
        changeDescription
      }
    );

    res.json({
      success: true,
      message: 'Document updated successfully',
      data: document
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Share document
router.post('/documents/:documentId/share', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const { userId, role, canEdit, canComment, canShare, expiresAt } = req.body;
    
    const permission = await CollaborativeDocumentService.shareDocument(
      req.params.documentId,
      req.user.id,
      {
        userId,
        role,
        canEdit,
        canComment,
        canShare,
        expiresAt
      }
    );

    res.json({
      success: true,
      message: 'Document shared successfully',
      data: permission
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Add comment to document
router.post('/documents/:documentId/comments', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const { content, position, parentId } = req.body;
    
    const comment = await CollaborativeDocumentService.addComment(
      req.params.documentId,
      req.user.id,
      {
        content,
        position,
        parentId
      }
    );

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: comment
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get document
router.get('/documents/:documentId', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const document = await CollaborativeDocumentService.getDocument(req.params.documentId, req.user.id);

    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get user documents
router.get('/documents', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const { page, limit, type, search } = req.query;
    
    const result = await CollaborativeDocumentService.getUserDocuments(
      req.user.id,
      req.user.companyId,
      {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        type,
        search
      }
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get document versions
router.get('/documents/:documentId/versions', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const versions = await CollaborativeDocumentService.getDocumentVersions(req.params.documentId, req.user.id);

    res.json({
      success: true,
      data: versions
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Restore document version
router.post('/documents/:documentId/versions/:versionId/restore', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const document = await CollaborativeDocumentService.restoreDocumentVersion(
      req.params.documentId,
      req.params.versionId,
      req.user.id
    );

    res.json({
      success: true,
      message: 'Document restored successfully',
      data: document
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// ==============================================
// FILE SHARING ROUTES
// ==============================================

// Upload shared file
router.post('/files/share', authenticateToken, requireSameCompany, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File is required'
      });
    }

    const { description, isPublic, allowDownload, allowPreview, password, expiresAt } = req.body;
    
    const sharedFile = await FileSharingService.uploadSharedFile(
      {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        buffer: req.file.buffer,
        description,
        isPublic: isPublic === 'true',
        allowDownload: allowDownload !== 'false',
        allowPreview: allowPreview !== 'false',
        password,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      },
      req.user.id,
      req.user.companyId
    );

    res.status(201).json({
      success: true,
      message: 'File shared successfully',
      data: sharedFile
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Grant file access
router.post('/files/:fileId/access', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const { userId, accessLevel, canDownload, canShare, canDelete, expiresAt } = req.body;
    
    const access = await FileSharingService.grantFileAccess(req.params.fileId, userId, {
      accessLevel,
      canDownload,
      canShare,
      canDelete,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      grantedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'File access granted successfully',
      data: access
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Download file
router.get('/files/:fileId/download', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const { password } = req.query;
    
    const fileInfo = await FileSharingService.downloadFile(req.params.fileId, req.user.id, password);
    
    res.download(fileInfo.filePath, fileInfo.filename, (err) => {
      if (err) {
        res.status(500).json({
          success: false,
          message: 'Error downloading file'
        });
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get file preview
router.get('/files/:fileId/preview', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const preview = await FileSharingService.getFilePreview(req.params.fileId, req.user.id);

    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get shared files
router.get('/files', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const { page, limit, type, search, sortBy, sortOrder } = req.query;
    
    const result = await FileSharingService.getUserSharedFiles(
      req.user.id,
      req.user.companyId,
      {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        type,
        search,
        sortBy,
        sortOrder
      }
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get file details
router.get('/files/:fileId', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const file = await FileSharingService.getFileDetails(req.params.fileId, req.user.id);

    res.json({
      success: true,
      data: file
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Delete shared file
router.delete('/files/:fileId', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    await FileSharingService.deleteSharedFile(req.params.fileId, req.user.id);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// ==============================================
// ANALYTICS ROUTES
// ==============================================

// Get communication analytics
router.get('/analytics', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const { dateRange } = req.query;
    const range = parseInt(dateRange) || 30;

    // Try each analytics call individually to identify issues
    let emailAnalytics, videoAnalytics, voiceAnalytics, screenShareAnalytics, documentAnalytics, fileAnalytics;
    
    try {
      emailAnalytics = await EmailService.getEmailAnalytics(req.user.companyId, range);
    } catch (error) {
      console.error('Email analytics error:', error);
      emailAnalytics = { error: 'Failed to fetch email analytics' };
    }

    try {
      videoAnalytics = await VideoCallService.getCallAnalytics(req.user.companyId, range);
    } catch (error) {
      console.error('Video analytics error:', error);
      videoAnalytics = { error: 'Failed to fetch video analytics' };
    }

    try {
      voiceAnalytics = await VoiceMessageService.getVoiceMessageAnalytics(req.user.companyId, range);
    } catch (error) {
      console.error('Voice analytics error:', error);
      voiceAnalytics = { error: 'Failed to fetch voice analytics' };
    }

    try {
      screenShareAnalytics = await ScreenShareService.getScreenShareAnalytics(req.user.companyId, range);
    } catch (error) {
      console.error('Screen share analytics error:', error);
      screenShareAnalytics = { error: 'Failed to fetch screen share analytics' };
    }

    try {
      documentAnalytics = await CollaborativeDocumentService.getDocumentAnalytics(req.user.companyId, range);
    } catch (error) {
      console.error('Document analytics error:', error);
      documentAnalytics = { error: 'Failed to fetch document analytics' };
    }

    try {
      fileAnalytics = await FileSharingService.getFileSharingAnalytics(req.user.companyId, range);
    } catch (error) {
      console.error('File analytics error:', error);
      fileAnalytics = { error: 'Failed to fetch file analytics' };
    }

    res.json({
      success: true,
      data: {
        email: emailAnalytics,
        video: videoAnalytics,
        voice: voiceAnalytics,
        screenShare: screenShareAnalytics,
        documents: documentAnalytics,
        files: fileAnalytics,
        dateRange: range
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;