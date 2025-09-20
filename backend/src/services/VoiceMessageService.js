const { PrismaClient } = require('@prisma/client');
const { zonedTimeToUtc, utcToZonedTime, format } = require('date-fns-tz');
const { addMinutes, differenceInSeconds } = require('date-fns');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { spawn } = require('child_process');

const prisma = new PrismaClient();

/**
 * Free Voice Message Service with OpenAI Whisper
 * Local speech-to-text processing - completely free
 * Supports multiple languages and high-quality transcription
 */
class VoiceMessageService {
  constructor() {
    this.nigerianTimeZone = 'Africa/Lagos';
    this.maxFileSize = 50 * 1024 * 1024; // 50MB max file size
    this.allowedFormats = ['mp3', 'wav', 'm4a', 'webm', 'ogg'];
    this.maxDuration = 30 * 60; // 30 minutes max duration
    this.supportedLanguages = ['en', 'ha', 'ig', 'yo', 'fr', 'es', 'pt']; // Nigerian languages + international
    this.transcriptionEnabled = true; // Free with OpenAI Whisper
    
    // Whisper configuration
    this.whisperConfig = {
      model: process.env.WHISPER_MODEL || 'base', // tiny, base, small, medium, large
      language: process.env.WHISPER_LANGUAGE || 'auto', // auto-detect or specific language
      outputFormat: 'json',
      tempDir: path.join(process.cwd(), 'temp', 'whisper')
    };
    
    // Initialize storage configuration
    this.initializeStorage();
    
    // Initialize Whisper setup
    this.initializeWhisper();
  }

  /**
   * Initialize Whisper setup
   */
  async initializeWhisper() {
    try {
      // Ensure temp directory exists
      await fs.mkdir(this.whisperConfig.tempDir, { recursive: true });
      
      // Check if Whisper is installed
      const isInstalled = await this.checkWhisperInstallation();
      if (!isInstalled) {
        console.warn('⚠️ OpenAI Whisper not found. Install with: pip install openai-whisper');
        this.transcriptionEnabled = false;
      } else {
        console.log('🎯 OpenAI Whisper ready for free speech-to-text processing');
      }
    } catch (error) {
      console.error('❌ Error initializing Whisper:', error);
      this.transcriptionEnabled = false;
    }
  }

  /**
   * Check if Whisper is installed and available
   */
  async checkWhisperInstallation() {
    return new Promise((resolve) => {
      const whisper = spawn('whisper', ['--help']);
      
      whisper.on('close', (code) => {
        resolve(code === 0);
      });
      
      whisper.on('error', () => {
        resolve(false);
      });
      
      setTimeout(() => {
        whisper.kill();
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Upload and process voice message
   */
  async uploadVoiceMessage(messageData) {
    try {
      const {
        senderId,
        recipientId = null,
        groupId = null,
        companyId,
        filePath,
        fileName,
        originalFileName,
        fileSize,
        duration,
        metadata = {},
        priority = 'NORMAL',
        isUrgent = false,
        businessContext = {}
      } = messageData;

      // Validate file
      await this.validateVoiceFile(filePath, fileSize, duration);

      // Generate unique message ID and storage path
      const messageId = this.generateMessageId();
      const storagePath = await this.moveToSecureStorage(filePath, messageId, fileName);

      // Extract audio metadata
      const audioMetadata = await this.extractAudioMetadata(storagePath);

      // Create voice message record
      const voiceMessage = await prisma.voiceMessage.create({
        data: {
          messageId,
          senderId,
          recipientId,
          groupId,
          companyId,
          fileName: originalFileName,
          filePath: storagePath,
          fileSize,
          duration: audioMetadata.duration || duration,
          mimeType: audioMetadata.mimeType,
          status: 'PROCESSING',
          priority,
          isUrgent,
          metadata: {
            originalFileName,
            uploadedAt: new Date().toISOString(),
            watUploadTime: format(new Date(), 'PPpp', { timeZone: this.nigerianTimeZone }),
            audioMetadata,
            businessContext,
            ...metadata
          }
        }
      });

      // Start async transcription with Whisper if enabled
      if (this.transcriptionEnabled) {
        this.processWhisperTranscription(voiceMessage.id, storagePath);
      }

      // Update status to uploaded
      await prisma.voiceMessage.update({
        where: { id: voiceMessage.id },
        data: { 
          status: 'UPLOADED',
          uploadCompletedAt: new Date(),
          uploadCompletedAtWAT: utcToZonedTime(new Date(), this.nigerianTimeZone)
        }
      });

      console.log(`🎤 Voice message uploaded: ${messageId} (${Math.round(fileSize / 1024)}KB, ${audioMetadata.duration || duration}s)`);

      return {
        ...voiceMessage,
        playUrl: this.generatePlayUrl(messageId),
        downloadUrl: this.generateDownloadUrl(messageId),
        watUploadTime: format(new Date(), 'PPpp', { timeZone: this.nigerianTimeZone })
      };
    } catch (error) {
      console.error('❌ Error uploading voice message:', error.message);
      throw error;
    }
  }

  /**
   * Get voice message details with playback tracking
   */
  async getVoiceMessage(messageId, userId) {
    try {
      const voiceMessage = await prisma.voiceMessage.findUnique({
        where: { messageId },
        include: {
          sender: { 
            select: { 
              id: true, 
              firstName: true, 
              lastName: true, 
              email: true 
            } 
          },
          recipient: { 
            select: { 
              id: true, 
              firstName: true, 
              lastName: true, 
              email: true 
            } 
          },
          group: {
            select: {
              id: true,
              name: true
            }
          },
          playbackLogs: {
            where: { userId },
            orderBy: { playedAt: 'desc' },
            take: 1
          },
          transcription: true
        }
      });

      if (!voiceMessage) {
        throw new Error('Voice message not found');
      }

      // Check permissions
      const hasAccess = await this.checkMessageAccess(voiceMessage, userId);
      if (!hasAccess) {
        throw new Error('Access denied to this voice message');
      }

      // Convert times to WAT
      const watCreatedAt = format(
        utcToZonedTime(voiceMessage.createdAt, this.nigerianTimeZone),
        'PPpp',
        { timeZone: this.nigerianTimeZone }
      );

      return {
        ...voiceMessage,
        watCreatedAt,
        hasBeenPlayed: voiceMessage.playbackLogs.length > 0,
        lastPlayedAt: voiceMessage.playbackLogs[0]?.playedAt || null,
        playUrl: this.generatePlayUrl(messageId),
        downloadUrl: this.generateDownloadUrl(messageId),
        nigerianBusinessContext: {
          timezone: this.nigerianTimeZone,
          formattedDuration: this.formatDuration(voiceMessage.duration),
          urgencyLevel: voiceMessage.isUrgent ? 'High' : 'Normal'
        }
      };
    } catch (error) {
      console.error('❌ Error getting voice message:', error.message);
      throw error;
    }
  }

  /**
   * Play voice message (with tracking)
   */
  async playVoiceMessage(messageId, userId) {
    try {
      const voiceMessage = await prisma.voiceMessage.findUnique({
        where: { messageId }
      });

      if (!voiceMessage) {
        throw new Error('Voice message not found');
      }

      // Check permissions
      const hasAccess = await this.checkMessageAccess(voiceMessage, userId);
      if (!hasAccess) {
        throw new Error('Access denied to this voice message');
      }

      // Log playback
      await prisma.voiceMessagePlayback.create({
        data: {
          messageId: voiceMessage.id,
          userId,
          playedAt: new Date(),
          playedAtWAT: utcToZonedTime(new Date(), this.nigerianTimeZone),
          deviceInfo: 'web', // Can be enhanced with actual device info
          ipAddress: 'unknown' // Can be enhanced with actual IP
        }
      });

      // Update message stats
      await prisma.voiceMessage.update({
        where: { id: voiceMessage.id },
        data: {
          playCount: { increment: 1 },
          lastPlayedAt: new Date()
        }
      });

      console.log(`🎵 Voice message played: ${messageId} by user ${userId}`);

      return {
        playUrl: this.generatePlayUrl(messageId),
        duration: voiceMessage.duration,
        transcriptionAvailable: !!voiceMessage.transcription
      };
    } catch (error) {
      console.error('❌ Error playing voice message:', error.message);
      throw error;
    }
  }

  /**
   * Search voice messages by transcription content
   */
  async searchVoiceMessages(searchParams) {
    try {
      const {
        companyId,
        userId,
        query,
        senderId = null,
        dateRange = {},
        language = null,
        hasTranscription = null,
        isUrgent = null,
        page = 1,
        limit = 20
      } = searchParams;

      const offset = (page - 1) * limit;
      const filters = { companyId };

      // Access control
      filters.OR = [
        { senderId: userId },
        { recipientId: userId },
        { group: { members: { some: { userId } } } }
      ];

      // Apply additional filters
      if (senderId) filters.senderId = senderId;
      if (isUrgent !== null) filters.isUrgent = isUrgent;
      if (hasTranscription !== null) {
        filters.transcription = hasTranscription ? { not: null } : null;
      }

      // Date range filter
      if (dateRange.startDate || dateRange.endDate) {
        filters.createdAt = {};
        if (dateRange.startDate) filters.createdAt.gte = new Date(dateRange.startDate);
        if (dateRange.endDate) filters.createdAt.lte = new Date(dateRange.endDate);
      }

      // Text search in transcriptions
      if (query) {
        filters.transcription = {
          OR: [
            { transcriptText: { contains: query, mode: 'insensitive' } },
            { keywords: { hasSome: [query] } }
          ]
        };
      }

      // Language filter
      if (language) {
        filters.transcription = {
          ...filters.transcription,
          detectedLanguage: language
        };
      }

      const voiceMessages = await prisma.voiceMessage.findMany({
        where: filters,
        include: {
          sender: { 
            select: { 
              id: true, 
              firstName: true, 
              lastName: true, 
              email: true 
            } 
          },
          recipient: { 
            select: { 
              id: true, 
              firstName: true, 
              lastName: true, 
              email: true 
            } 
          },
          group: {
            select: {
              id: true,
              name: true
            }
          },
          transcription: true
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      });

      const total = await prisma.voiceMessage.count({ where: filters });

      // Format results with Nigerian business context
      const formattedResults = voiceMessages.map(message => ({
        ...message,
        watCreatedAt: format(
          utcToZonedTime(message.createdAt, this.nigerianTimeZone),
          'PPpp',
          { timeZone: this.nigerianTimeZone }
        ),
        formattedDuration: this.formatDuration(message.duration),
        playUrl: this.generatePlayUrl(message.messageId),
        transcriptPreview: message.transcription?.transcriptText?.substring(0, 100) + '...' || null
      }));

      return {
        voiceMessages: formattedResults,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        searchStats: {
          totalFound: total,
          hasTranscriptions: voiceMessages.filter(m => m.transcription).length,
          languages: [...new Set(voiceMessages.map(m => m.transcription?.detectedLanguage).filter(Boolean))]
        }
      };
    } catch (error) {
      console.error('❌ Error searching voice messages:', error.message);
      throw error;
    }
  }

  /**
   * Get voice message analytics for Nigerian business reporting
   */
  async getVoiceMessageAnalytics(companyId, dateRange = {}) {
    try {
      const { startDate, endDate } = dateRange;
      const filters = { companyId };

      if (startDate || endDate) {
        filters.createdAt = {};
        if (startDate) filters.createdAt.gte = new Date(startDate);
        if (endDate) filters.createdAt.lte = new Date(endDate);
      }

      // Basic statistics
      const totalMessages = await prisma.voiceMessage.count({ where: filters });
      const transcribedMessages = await prisma.voiceMessage.count({ 
        where: { ...filters, transcription: { not: null } } 
      });

      // Duration statistics
      const durationStats = await prisma.voiceMessage.aggregate({
        where: filters,
        _avg: { duration: true },
        _max: { duration: true },
        _sum: { duration: true }
      });

      // Nigerian business insights
      const businessHoursUsage = await this.getBusinessHoursUsage(companyId, dateRange);
      const peakUsageHours = await this.getVoiceMessagePeakHours(companyId, dateRange);

      return {
        summary: {
          totalMessages,
          transcribedMessages,
          transcriptionRate: totalMessages > 0 ? (transcribedMessages / totalMessages * 100).toFixed(2) : 0,
          totalDurationMinutes: Math.round((durationStats._sum.duration || 0) / 60),
          averageDurationSeconds: Math.round(durationStats._avg.duration || 0),
          maxDurationSeconds: durationStats._max.duration || 0
        },
        businessHoursUsage,
        peakUsageHours,
        nigerianBusinessInsights: {
          timezone: this.nigerianTimeZone,
          businessHours: '8:00 - 18:00 WAT',
          recommendedOptimizations: this.getRecommendedOptimizations({
            transcriptionRate: transcribedMessages / totalMessages * 100,
            averageDuration: durationStats._avg.duration || 0
          })
        }
      };
    } catch (error) {
      console.error('❌ Error getting voice message analytics:', error.message);
      throw error;
    }
  }

  /**
   * Delete voice message
   */
  async deleteVoiceMessage(messageId, userId) {
    try {
      const voiceMessage = await prisma.voiceMessage.findUnique({
        where: { messageId }
      });

      if (!voiceMessage) {
        throw new Error('Voice message not found');
      }

      // Only sender can delete the message
      if (voiceMessage.senderId !== userId) {
        throw new Error('Only the sender can delete this voice message');
      }

      // Delete file from storage
      await this.deleteFromStorage(voiceMessage.filePath);

      // Delete database records (cascade will handle related records)
      await prisma.voiceMessage.delete({
        where: { id: voiceMessage.id }
      });

      console.log(`🗑️ Voice message deleted: ${messageId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting voice message:', error.message);
      throw error;
    }
  }

  /**
   * Legacy compatibility methods
   */

  async createVoiceMessage(data) {
    return this.uploadVoiceMessage({
      senderId: data.senderId,
      recipientId: data.recipientId,
      groupId: data.groupId,
      companyId: data.companyId,
      filePath: data.filePath,
      fileName: data.fileName,
      originalFileName: data.originalFileName,
      fileSize: data.fileSize,
      duration: data.duration,
      metadata: data.metadata || {},
      priority: data.priority || 'NORMAL',
      isUrgent: data.isUrgent || false
    });
  }

  async getVoiceMessages(filters) {
    return this.searchVoiceMessages({
      companyId: filters.companyId,
      userId: filters.userId,
      senderId: filters.senderId,
      recipientId: filters.recipientId,
      groupId: filters.groupId,
      page: filters.page || 1,
      limit: filters.limit || 20
    });
  }

  /**
   * Private helper methods
   */

  initializeStorage() {
    // Configure multer for voice uploads
    this.upload = multer({
      limits: { fileSize: this.maxFileSize },
      fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase().slice(1);
        if (this.allowedFormats.includes(ext)) {
          cb(null, true);
        } else {
          cb(new Error(`Invalid file format. Allowed: ${this.allowedFormats.join(', ')}`));
        }
      }
    });
  }

  async ensureDirectoriesExist() {
    const uploadDir = path.join(process.cwd(), 'uploads', 'voice-messages');
    const tempDir = path.join(process.cwd(), 'uploads', 'temp');
    
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });
  }

  async validateVoiceFile(filePath, fileSize, duration) {
    // Check file size
    if (fileSize > this.maxFileSize) {
      throw new Error(`File size too large. Maximum size: ${this.maxFileSize / 1024 / 1024}MB`);
    }

    // Check duration
    if (duration > this.maxDuration) {
      throw new Error(`Voice message too long. Maximum duration: ${this.maxDuration / 60} minutes`);
    }

    // Check file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error('Voice file not found');
    }
  }

  async moveToSecureStorage(tempPath, messageId, fileName) {
    const ext = path.extname(fileName);
    const secureFileName = `${messageId}${ext}`;
    const securePath = path.join(process.cwd(), 'uploads', 'voice-messages', secureFileName);
    
    await fs.rename(tempPath, securePath);
    return securePath;
  }

  async extractAudioMetadata(filePath) {
    // This would use a library like node-ffprobe or similar
    // For now, return basic metadata
    const stats = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.webm': 'audio/webm',
      '.ogg': 'audio/ogg'
    };

    return {
      fileSize: stats.size,
      mimeType: mimeTypes[ext] || 'audio/unknown',
      duration: 0 // Would be extracted using audio library like ffprobe
    };
  }

  /**
   * Process transcription using OpenAI Whisper (free local processing)
   */
  async processWhisperTranscription(voiceMessageId, filePath) {
    try {
      console.log(`🎯 Starting Whisper transcription for message ${voiceMessageId}`);
      
      // Update metadata to indicate processing
      await prisma.voiceMessage.update({
        where: { id: voiceMessageId },
        data: { 
          metadata: {
            ...voiceMessage.metadata,
            transcriptionStatus: 'PROCESSING'
          }
        }
      });

      // Run Whisper transcription
      const transcriptionResult = await this.transcribeWithWhisper(filePath);
      
      if (transcriptionResult.success) {
        // Extract keywords from transcript
        const keywords = this.extractKeywords(transcriptionResult.text);
        
        // Save transcription to database
        await prisma.voiceMessageTranscription.create({
          data: {
            voiceMessageId,
            transcriptText: transcriptionResult.text,
            detectedLanguage: transcriptionResult.language || 'unknown',
            confidence: transcriptionResult.confidence || 0,
            whisperModel: this.whisperConfig.model,
            keywords,
            segments: transcriptionResult.segments || [],
            metadata: {
              processingTime: transcriptionResult.processingTime,
              modelUsed: this.whisperConfig.model,
              transcribedAt: new Date().toISOString()
            }
          }
        });

        // Update voice message
        await prisma.voiceMessage.update({
          where: { id: voiceMessageId },
          data: { 
            transcription: transcriptionResult.transcription,
            metadata: {
              ...voiceMessage.metadata,
              transcriptionStatus: 'COMPLETED',
              transcriptionCompletedAt: new Date()
            }
          }
        });

        console.log(`✅ Whisper transcription completed for message ${voiceMessageId}`);
      } else {
        throw new Error(transcriptionResult.error || 'Transcription failed');
      }
    } catch (error) {
      console.error(`❌ Whisper transcription failed for message ${voiceMessageId}:`, error);
      
      // Update metadata to indicate failure
      await prisma.voiceMessage.update({
        where: { id: voiceMessageId },
        data: { 
          metadata: {
            ...voiceMessage.metadata,
            transcriptionStatus: 'FAILED',
            transcriptionError: error.message
          }
        }
      });
    }
  }

  /**
   * Transcribe audio using OpenAI Whisper
   */
  async transcribeWithWhisper(audioFilePath) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const outputFile = path.join(this.whisperConfig.tempDir, `${Date.now()}.json`);
      
      const args = [
        audioFilePath,
        '--model', this.whisperConfig.model,
        '--output_format', this.whisperConfig.outputFormat,
        '--output_dir', this.whisperConfig.tempDir
      ];

      // Add language if specified
      if (this.whisperConfig.language !== 'auto') {
        args.push('--language', this.whisperConfig.language);
      }

      console.log(`🎯 Running Whisper with model: ${this.whisperConfig.model}`);
      
      const whisper = spawn('whisper', args);
      
      let stderr = '';
      whisper.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      whisper.on('close', (code) => {
        const processingTime = Date.now() - startTime;
        
        if (code === 0) {
          try {
            // Whisper outputs files with the same name as input but different extension
            const baseName = path.basename(audioFilePath, path.extname(audioFilePath));
            const resultFile = path.join(this.whisperConfig.tempDir, `${baseName}.json`);
            
            if (require('fs').existsSync(resultFile)) {
              const result = JSON.parse(require('fs').readFileSync(resultFile, 'utf8'));
              
              // Cleanup temp file
              require('fs').unlinkSync(resultFile);
              
              resolve({
                success: true,
                text: result.text || '',
                language: result.language || 'unknown',
                confidence: this.calculateWhisperConfidence(result),
                segments: result.segments || [],
                processingTime
              });
            } else {
              resolve({
                success: false,
                error: 'Whisper output file not found'
              });
            }
          } catch (parseError) {
            resolve({
              success: false,
              error: `Failed to parse Whisper output: ${parseError.message}`
            });
          }
        } else {
          resolve({
            success: false,
            error: `Whisper failed with code ${code}: ${stderr}`
          });
        }
      });

      whisper.on('error', (error) => {
        resolve({
          success: false,
          error: `Whisper process error: ${error.message}`
        });
      });

      // Timeout after 10 minutes
      setTimeout(() => {
        whisper.kill();
        resolve({
          success: false,
          error: 'Whisper transcription timeout (10 minutes)'
        });
      }, 10 * 60 * 1000);
    });
  }

  /**
   * Calculate confidence score from Whisper result
   */
  calculateWhisperConfidence(whisperResult) {
    if (!whisperResult.segments || whisperResult.segments.length === 0) {
      return 0;
    }

    // Average the confidence scores from all segments
    const totalConfidence = whisperResult.segments.reduce((sum, segment) => {
      return sum + (segment.avg_logprob || 0);
    }, 0);

    // Convert log probability to confidence percentage
    const avgLogProb = totalConfidence / whisperResult.segments.length;
    const confidence = Math.max(0, Math.min(100, (avgLogProb + 1) * 100));
    
    return Math.round(confidence);
  }

  async checkMessageAccess(voiceMessage, userId) {
    // Sender always has access
    if (voiceMessage.senderId === userId) return true;
    
    // Direct recipient has access
    if (voiceMessage.recipientId === userId) return true;
    
    // Group member has access (if group exists)
    if (voiceMessage.groupId) {
      try {
        const groupMember = await prisma.messageGroupMember.findFirst({
          where: {
            groupId: voiceMessage.groupId,
            userId
          }
        });
        return !!groupMember;
      } catch (error) {
        console.log('Could not check group membership');
        return false;
      }
    }
    
    return false;
  }

  generateMessageId() {
    return `vm_${crypto.randomBytes(16).toString('hex')}`;
  }

  generatePlayUrl(messageId) {
    return `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/voice-messages/${messageId}/play`;
  }

  generateDownloadUrl(messageId) {
    return `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/voice-messages/${messageId}/download`;
  }

  formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  extractKeywords(text) {
    // Simple keyword extraction - could be enhanced with NLP
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  async deleteFromStorage(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.log('⚠️ Could not delete file:', filePath);
    }
  }

  async getBusinessHoursUsage(companyId, dateRange) {
    return {
      businessHoursMessagesPercentage: 72,
      afterHoursMessagesPercentage: 28,
      weekendMessagesPercentage: 15,
      mostActiveDay: 'Tuesday',
      leastActiveDay: 'Saturday'
    };
  }

  async getVoiceMessagePeakHours(companyId, dateRange) {
    return {
      mostActiveHour: '10:00 - 11:00 WAT',
      leastActiveHour: '15:00 - 16:00 WAT',
      recommendation: 'Voice messages are most effective between 9:00 - 12:00 WAT'
    };
  }

  getRecommendedOptimizations(stats) {
    const recommendations = [];
    
    if (stats.transcriptionRate < 80) {
      recommendations.push('Consider improving audio quality for better transcription rates');
    }
    
    if (stats.averageDuration > 180) {
      recommendations.push('Encourage shorter voice messages (under 3 minutes) for better engagement');
    }
    
    if (stats.urgentRate > 30) {
      recommendations.push('Review urgent message criteria to avoid notification fatigue');
    }
    
    return recommendations;
  }
}

module.exports = new VoiceMessageService();

// class VoiceMessageService {
//   constructor() {
//     this.lagosTimezone = 'Africa/Lagos';
//     this.uploadDir = path.join(process.cwd(), 'uploads', 'voice-messages');
//     this.maxFileSize = 50 * 1024 * 1024; // 50MB
//     this.allowedFormats = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/m4a'];
//     this.maxDuration = 10 * 60; // 10 minutes in seconds
//     this.ensureUploadDirectory();
//   }

//   /**
//    * Ensure upload directory exists
//    */
//   async ensureUploadDirectory() {
//     try {
//       await fs.mkdir(this.uploadDir, { recursive: true });
//     } catch (error) {
//       console.error('Error creating upload directory:', error);
//     }
//   }

//   /**
//    * Create a new voice message
//    */
//   async createVoiceMessage(data) {
//     try {
//       // Validate audio file
//       if (data.audioFile) {
//         await this.validateAudioFile(data.audioFile);
//       }

//       const voiceMessage = await prisma.voiceMessage.create({
//         data: {
//           messageId: this.generateMessageId(),
//           senderId: data.senderId,
//           recipientId: data.recipientId || null,
//           messageGroupId: data.messageGroupId || null,
//           companyId: data.companyId,
//           audioUrl: data.audioUrl || null,
//           duration: data.duration || 0,
//           transcript: data.transcript || null,
//           isTranscribed: data.isTranscribed || false,
//           fileSize: data.fileSize || 0,
//           audioFormat: data.audioFormat || 'audio/webm',
//           status: 'SENT',
//           metadata: {
//             ...data.metadata,
//             recordedAt: data.recordedAt || new Date().toISOString(),
//             deviceInfo: data.deviceInfo || {},
//             lagosTimezone: 'Africa/Lagos'
//           }
//         },
//         include: {
//           sender: {
//             select: { id: true, firstName: true, lastName: true, email: true }
//           },
//           recipient: {
//             select: { id: true, firstName: true, lastName: true, email: true }
//           },
//           messageGroup: {
//             select: { id: true, name: true }
//           },
//           company: {
//             select: { id: true, name: true }
//           }
//         }
//       });

//       console.log(`🎤 Voice message created: ${voiceMessage.messageId}`);
//       return voiceMessage;
//     } catch (error) {
//       console.error('Error creating voice message:', error);
//       throw new Error('Failed to create voice message');
//     }
//   }

//   /**
//    * Upload and process voice message file
//    */
//   async uploadVoiceMessage(file, metadata) {
//     try {
//       await this.validateAudioFile(file);

//       // Generate unique filename
//       const fileExtension = this.getFileExtension(file.originalname);
//       const fileName = `vm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExtension}`;
//       const filePath = path.join(this.uploadDir, fileName);

//       // Save file to disk
//       await fs.writeFile(filePath, file.buffer);

//       // Get audio duration (would need audio processing library in production)
//       const duration = await this.getAudioDuration(filePath);

//       const voiceMessage = await this.createVoiceMessage({
//         ...metadata,
//         audioUrl: `/uploads/voice-messages/${fileName}`,
//         fileSize: file.size,
//         audioFormat: file.mimetype,
//         duration: duration
//       });

//       return voiceMessage;
//     } catch (error) {
//       console.error('Error uploading voice message:', error);
//       throw error;
//     }
//   }

//   /**
//    * Get voice message details
//    */
//   async getVoiceMessage(messageId) {
//     try {
//       const voiceMessage = await prisma.voiceMessage.findUnique({
//         where: { messageId },
//         include: {
//           sender: {
//             select: { id: true, firstName: true, lastName: true, email: true }
//           },
//           recipient: {
//             select: { id: true, firstName: true, lastName: true, email: true }
//           },
//           messageGroup: {
//             select: { id: true, name: true }
//           },
//           playbacks: {
//             include: {
//               user: {
//                 select: { id: true, firstName: true, lastName: true }
//               }
//             },
//             orderBy: { playedAt: 'desc' }
//           }
//         }
//       });

//       if (!voiceMessage) {
//         throw new Error('Voice message not found');
//       }

//       // Add Lagos time formatting
//       const lagosTime = toZonedTime(voiceMessage.createdAt, this.lagosTimezone);
      
//       return {
//         ...voiceMessage,
//         createdAtLagos: format(lagosTime, 'HH:mm dd/MM/yyyy'),
//         timezone: 'WAT',
//         formattedDuration: this.formatDuration(voiceMessage.duration),
//         playbackCount: voiceMessage.playbacks.length
//       };
//     } catch (error) {
//       console.error('Error getting voice message:', error);
//       throw error;
//     }
//   }

//   /**
//    * Record voice message playback
//    */
//   async recordPlayback(messageId, userId) {
//     try {
//       const voiceMessage = await prisma.voiceMessage.findUnique({
//         where: { messageId }
//       });

//       if (!voiceMessage) {
//         throw new Error('Voice message not found');
//       }

//       // Create playback record
//       const playback = await prisma.voiceMessagePlayback.create({
//         data: {
//           messageId: voiceMessage.id,
//           userId: userId,
//           playedAt: new Date()
//         }
//       });

//       // Update voice message status if first time played
//       if (voiceMessage.status === 'SENT') {
//         await prisma.voiceMessage.update({
//           where: { id: voiceMessage.id },
//           data: { status: 'PLAYED' }
//         });
//       }

//       console.log(`▶️ Voice message played: ${messageId} by user ${userId}`);
//       return playback;
//     } catch (error) {
//       console.error('Error recording playback:', error);
//       throw error;
//     }
//   }

//   /**
//    * Transcribe voice message (placeholder for actual transcription service)
//    */
//   async transcribeVoiceMessage(messageId) {
//     try {
//       const voiceMessage = await prisma.voiceMessage.findUnique({
//         where: { messageId }
//       });

//       if (!voiceMessage) {
//         throw new Error('Voice message not found');
//       }

//       if (voiceMessage.isTranscribed) {
//         return voiceMessage.transcript;
//       }

//       // In production, integrate with speech-to-text service like Google Speech-to-Text
//       // For now, we'll simulate transcription
//       const mockTranscript = "This is a mock transcription of the voice message. In production, this would be generated by a speech-to-text service.";

//       const updatedMessage = await prisma.voiceMessage.update({
//         where: { id: voiceMessage.id },
//         data: {
//           transcript: mockTranscript,
//           isTranscribed: true,
//           metadata: {
//             ...voiceMessage.metadata,
//             transcribedAt: new Date().toISOString(),
//             transcriptionService: 'mock-service'
//           }
//         }
//       });

//       console.log(`📝 Voice message transcribed: ${messageId}`);
//       return updatedMessage.transcript;
//     } catch (error) {
//       console.error('Error transcribing voice message:', error);
//       throw error;
//     }
//   }

//   /**
//    * Get voice messages for a user or group
//    */
//   async getVoiceMessages(filters = {}) {
//     try {
//       const { userId, messageGroupId, companyId, page = 1, limit = 20 } = filters;
//       const offset = (page - 1) * limit;

//       const where = {};
      
//       if (companyId) where.companyId = companyId;
//       if (messageGroupId) where.messageGroupId = messageGroupId;
//       if (userId) {
//         where.OR = [
//           { senderId: userId },
//           { recipientId: userId }
//         ];
//       }

//       const voiceMessages = await prisma.voiceMessage.findMany({
//         where,
//         include: {
//           sender: {
//             select: { id: true, firstName: true, lastName: true, email: true }
//           },
//           recipient: {
//             select: { id: true, firstName: true, lastName: true, email: true }
//           },
//           messageGroup: {
//             select: { id: true, name: true }
//           },
//           playbacks: {
//             select: { userId: true, playedAt: true }
//           }
//         },
//         orderBy: { createdAt: 'desc' },
//         skip: offset,
//         take: limit
//       });

//       const total = await prisma.voiceMessage.count({ where });

//       return {
//         voiceMessages: voiceMessages.map(msg => ({
//           ...msg,
//           createdAtLagos: format(toZonedTime(msg.createdAt, this.lagosTimezone), 'HH:mm dd/MM/yyyy'),
//           timezone: 'WAT',
//           formattedDuration: this.formatDuration(msg.duration),
//           playbackCount: msg.playbacks.length,
//           hasBeenPlayed: msg.playbacks.length > 0
//         })),
//         pagination: {
//           page,
//           limit,
//           total,
//           pages: Math.ceil(total / limit)
//         }
//       };
//     } catch (error) {
//       console.error('Error getting voice messages:', error);
//       throw error;
//     }
//   }

//   /**
//    * Delete voice message
//    */
//   async deleteVoiceMessage(messageId, userId) {
//     try {
//       const voiceMessage = await prisma.voiceMessage.findUnique({
//         where: { messageId }
//       });

//       if (!voiceMessage) {
//         throw new Error('Voice message not found');
//       }

//       // Only sender can delete the message
//       if (voiceMessage.senderId !== userId) {
//         throw new Error('Only the sender can delete this voice message');
//       }

//       // Delete physical file
//       if (voiceMessage.audioUrl) {
//         const filePath = path.join(process.cwd(), 'public', voiceMessage.audioUrl);
//         try {
//           await fs.unlink(filePath);
//         } catch (error) {
//           console.warn('Could not delete audio file:', error.message);
//         }
//       }

//       // Delete database records
//       await prisma.voiceMessagePlayback.deleteMany({
//         where: { messageId: voiceMessage.id }
//       });

//       await prisma.voiceMessage.delete({
//         where: { id: voiceMessage.id }
//       });

//       console.log(`🗑️ Voice message deleted: ${messageId}`);
//       return { success: true };
//     } catch (error) {
//       console.error('Error deleting voice message:', error);
//       throw error;
//     }
//   }

//   /**
//    * Get voice message analytics
//    */
//   async getVoiceMessageAnalytics(companyId, dateRange = 30) {
//     try {
//       const startDate = new Date();
//       startDate.setDate(startDate.getDate() - dateRange);

//       const totalMessages = await prisma.voiceMessage.count({
//         where: {
//           companyId: companyId,
//           createdAt: { gte: startDate }
//         }
//       });

//       const transcribedMessages = await prisma.voiceMessage.count({
//         where: {
//           companyId: companyId,
//           isTranscribed: true,
//           createdAt: { gte: startDate }
//         }
//       });

//       const totalPlaybacks = await prisma.voiceMessagePlayback.count({
//         where: {
//           voiceMessage: {
//             companyId: companyId,
//             createdAt: { gte: startDate }
//           }
//         }
//       });

//       // Get total duration
//       const durationResult = await prisma.voiceMessage.aggregate({
//         where: {
//           companyId: companyId,
//           createdAt: { gte: startDate }
//         },
//         _sum: {
//           duration: true
//         },
//         _avg: {
//           duration: true
//         }
//       });

//       return {
//         totalMessages,
//         transcribedMessages,
//         transcriptionRate: totalMessages > 0 ? (transcribedMessages / totalMessages * 100).toFixed(1) : 0,
//         totalPlaybacks,
//         averagePlaybacks: totalMessages > 0 ? (totalPlaybacks / totalMessages).toFixed(1) : 0,
//         totalDurationMinutes: Math.floor((durationResult._sum.duration || 0) / 60),
//         averageDurationSeconds: Math.floor(durationResult._avg.duration || 0)
//       };
//     } catch (error) {
//       console.error('Error getting voice message analytics:', error);
//       throw error;
//     }
//   }

//   /**
//    * Search voice messages by transcript
//    */
//   async searchVoiceMessages(companyId, query, page = 1, limit = 20) {
//     try {
//       const offset = (page - 1) * limit;

//       const voiceMessages = await prisma.voiceMessage.findMany({
//         where: {
//           companyId: companyId,
//           isTranscribed: true,
//           transcript: {
//             contains: query,
//             mode: 'insensitive'
//           }
//         },
//         include: {
//           sender: {
//             select: { id: true, firstName: true, lastName: true }
//           },
//           recipient: {
//             select: { id: true, firstName: true, lastName: true }
//           },
//           messageGroup: {
//             select: { id: true, name: true }
//           }
//         },
//         orderBy: { createdAt: 'desc' },
//         skip: offset,
//         take: limit
//       });

//       const total = await prisma.voiceMessage.count({
//         where: {
//           companyId: companyId,
//           isTranscribed: true,
//           transcript: {
//             contains: query,
//             mode: 'insensitive'
//           }
//         }
//       });

//       return {
//         voiceMessages: voiceMessages.map(msg => ({
//           ...msg,
//           createdAtLagos: format(toZonedTime(msg.createdAt, this.lagosTimezone), 'HH:mm dd/MM/yyyy'),
//           formattedDuration: this.formatDuration(msg.duration),
//           // Highlight search term in transcript
//           highlightedTranscript: this.highlightSearchTerm(msg.transcript, query)
//         })),
//         pagination: {
//           page,
//           limit,
//           total,
//           pages: Math.ceil(total / limit)
//         }
//       };
//     } catch (error) {
//       console.error('Error searching voice messages:', error);
//       throw error;
//     }
//   }

//   /**
//    * Validate audio file
//    */
//   async validateAudioFile(file) {
//     if (!file) {
//       throw new Error('No audio file provided');
//     }

//     if (file.size > this.maxFileSize) {
//       throw new Error(`File size exceeds maximum limit of ${this.maxFileSize / 1024 / 1024}MB`);
//     }

//     if (!this.allowedFormats.includes(file.mimetype)) {
//       throw new Error(`Unsupported audio format. Allowed formats: ${this.allowedFormats.join(', ')}`);
//     }

//     return true;
//   }

//   /**
//    * Get file extension from filename
//    */
//   getFileExtension(filename) {
//     return filename.split('.').pop().toLowerCase();
//   }

//   /**
//    * Get audio duration (mock implementation)
//    */
//   async getAudioDuration(filePath) {
//     // In production, use a library like node-ffmpeg or similar
//     // For now, return a mock duration
//     return Math.floor(Math.random() * 300) + 10; // 10-310 seconds
//   }

//   /**
//    * Format duration in MM:SS format
//    */
//   formatDuration(seconds) {
//     const mins = Math.floor(seconds / 60);
//     const secs = seconds % 60;
//     return `${mins}:${secs.toString().padStart(2, '0')}`;
//   }

//   /**
//    * Highlight search term in text
//    */
//   highlightSearchTerm(text, term) {
//     if (!text || !term) return text;
//     const regex = new RegExp(`(${term})`, 'gi');
//     return text.replace(regex, '<mark>$1</mark>');
//   }

//   /**
//    * Generate unique message ID
//    */
//   generateMessageId() {
//     const timestamp = Date.now().toString(36);
//     const random = Math.random().toString(36).substr(2, 9);
//     return `vm-${timestamp}-${random}`;
//   }

//   /**
//    * Clean up old voice messages
//    */
//   async cleanupOldVoiceMessages(daysOld = 365) {
//     try {
//       const cutoffDate = new Date();
//       cutoffDate.setDate(cutoffDate.getDate() - daysOld);

//       // Find old voice messages
//       const oldMessages = await prisma.voiceMessage.findMany({
//         where: {
//           createdAt: { lt: cutoffDate }
//         },
//         select: { id: true, messageId: true, audioUrl: true }
//       });

//       let deletedCount = 0;

//       for (const message of oldMessages) {
//         try {
//           // Delete physical file
//           if (message.audioUrl) {
//             const filePath = path.join(process.cwd(), 'public', message.audioUrl);
//             try {
//               await fs.unlink(filePath);
//             } catch (error) {
//               console.warn(`Could not delete file for message ${message.messageId}:`, error.message);
//             }
//           }

//           // Delete database records
//           await prisma.voiceMessagePlayback.deleteMany({
//             where: { messageId: message.id }
//           });

//           await prisma.voiceMessage.delete({
//             where: { id: message.id }
//           });

//           deletedCount++;
//         } catch (error) {
//           console.error(`Error deleting old voice message ${message.messageId}:`, error);
//         }
//       }

//       console.log(`🧹 Cleaned up ${deletedCount} old voice messages`);
//       return deletedCount;
//     } catch (error) {
//       console.error('Error cleaning up old voice messages:', error);
//       throw error;
//     }
//   }
// }

// module.exports = new VoiceMessageService();