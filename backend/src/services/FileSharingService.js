// File Sharing Service for CollabNotes Nigeria
const { PrismaClient } = require('@prisma/client');
const { format } = require('date-fns');
const { toZonedTime } = require('date-fns-tz');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const prisma = new PrismaClient();

class FileSharingService {
  constructor() {
    this.lagosTimezone = 'Africa/Lagos';
    this.maxFileSize = 500 * 1024 * 1024; // 500MB per file
    this.allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/plain',
      'text/csv',
      'application/json',
      'application/zip',
      'application/x-rar-compressed',
      'video/mp4',
      'video/avi',
      'video/quicktime',
      'audio/mpeg',
      'audio/wav',
      'audio/mp4'
    ];
    this.uploadDirectory = path.join(process.cwd(), 'uploads', 'shared_files');
  }

  /**
   * Upload and share a file
   */
  async uploadSharedFile(fileData, uploaderId, companyId) {
    try {
      // Validate file
      const validation = this.validateFile(fileData);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Ensure upload directory exists
      await this.ensureUploadDirectory();

      // Generate unique filename
      const fileExtension = path.extname(fileData.originalName);
      const uniqueFilename = `${crypto.randomUUID()}${fileExtension}`;
      const filePath = path.join(this.uploadDirectory, uniqueFilename);

      // Save file to disk (simulate file upload)
      await fs.writeFile(filePath, fileData.buffer);

      // Calculate file hash for duplicate detection
      const fileHash = crypto.createHash('md5').update(fileData.buffer).digest('hex');

      // Create file record
      const sharedFile = await prisma.sharedFile.create({
        data: {
          filename: fileData.originalName,
          originalName: fileData.originalName,
          storedFilename: uniqueFilename,
          mimeType: fileData.mimeType,
          size: fileData.size,
          filePath: filePath,
          fileHash: fileHash,
          uploaderId: uploaderId,
          companyId: companyId,
          description: fileData.description || '',
          isPublic: fileData.isPublic || false,
          allowDownload: fileData.allowDownload !== undefined ? fileData.allowDownload : true,
          allowPreview: fileData.allowPreview !== undefined ? fileData.allowPreview : true,
          passwordProtected: !!fileData.password,
          password: fileData.password ? this.hashPassword(fileData.password) : null,
          expiresAt: fileData.expiresAt || null,
          metadata: {
            ...fileData.metadata,
            uploadedFromIP: fileData.uploadIP || 'unknown',
            userAgent: fileData.userAgent || 'unknown',
            lagosTimezone: 'Africa/Lagos'
          }
        },
        include: {
          uploader: {
            select: { id: true, firstName: true, lastName: true, email: true }
          },
          company: {
            select: { id: true, name: true }
          }
        }
      });

      // Create initial access record for uploader
      await this.grantFileAccess(sharedFile.id, uploaderId, {
        accessLevel: 'OWNER',
        canDownload: true,
        canShare: true,
        canDelete: true
      });

      console.log(`📎 File shared: ${fileData.originalName} (${sharedFile.id}) by user ${uploaderId}`);
      return sharedFile;
    } catch (error) {
      console.error('Error uploading shared file:', error);
      throw error;
    }
  }

  /**
   * Grant file access to user
   */
  async grantFileAccess(fileId, userId, accessData) {
    try {
      const file = await prisma.sharedFile.findUnique({
        where: { id: fileId }
      });

      if (!file) {
        throw new Error('File not found');
      }

      // Check if access already exists
      const existingAccess = await prisma.fileAccess.findFirst({
        where: {
          fileId: fileId,
          userId: userId
        }
      });

      if (existingAccess) {
        // Update existing access
        const updatedAccess = await prisma.fileAccess.update({
          where: { id: existingAccess.id },
          data: {
            accessLevel: accessData.accessLevel,
            canDownload: accessData.canDownload !== undefined ? accessData.canDownload : true,
            canShare: accessData.canShare !== undefined ? accessData.canShare : false,
            canDelete: accessData.canDelete !== undefined ? accessData.canDelete : false,
            expiresAt: accessData.expiresAt || null
          }
        });

        return updatedAccess;
      } else {
        // Create new access
        const fileAccess = await prisma.fileAccess.create({
          data: {
            fileId: fileId,
            userId: userId,
            grantedBy: accessData.grantedBy,
            accessLevel: accessData.accessLevel,
            canDownload: accessData.canDownload !== undefined ? accessData.canDownload : true,
            canShare: accessData.canShare !== undefined ? accessData.canShare : false,
            canDelete: accessData.canDelete !== undefined ? accessData.canDelete : false,
            expiresAt: accessData.expiresAt || null
          },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true }
            }
          }
        });

        console.log(`🔑 File access granted: ${fileId} to user ${userId}`);
        return fileAccess;
      }
    } catch (error) {
      console.error('Error granting file access:', error);
      throw error;
    }
  }

  /**
   * Download file
   */
  async downloadFile(fileId, userId, password = null) {
    try {
      const file = await prisma.sharedFile.findUnique({
        where: { id: fileId },
        include: {
          access: {
            where: { userId: userId }
          },
          uploader: {
            select: { id: true, firstName: true, lastName: true }
          }
        }
      });

      if (!file) {
        throw new Error('File not found');
      }

      // Check if file has expired
      if (file.expiresAt && file.expiresAt < new Date()) {
        throw new Error('File has expired');
      }

      // Check password if file is password protected
      if (file.passwordProtected) {
        if (!password || !this.verifyPassword(password, file.password)) {
          throw new Error('Invalid password');
        }
      }

      // Check access permissions
      const hasAccess = await this.canUserAccessFile(fileId, userId);
      if (!hasAccess) {
        throw new Error('You do not have permission to access this file');
      }

      const userAccess = file.access[0];
      if (userAccess && !userAccess.canDownload) {
        throw new Error('You do not have download permission for this file');
      }

      // Check if file exists on disk
      const fileExists = await fs.access(file.filePath).then(() => true).catch(() => false);
      if (!fileExists) {
        throw new Error('File not found on server');
      }

      // Record download
      await this.recordFileDownload(fileId, userId);

      // Return file information for download
      return {
        filePath: file.filePath,
        filename: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        downloadCount: await this.getFileDownloadCount(fileId)
      };
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }

  /**
   * Get file preview (for supported file types)
   */
  async getFilePreview(fileId, userId) {
    try {
      const file = await prisma.sharedFile.findUnique({
        where: { id: fileId },
        include: {
          access: {
            where: { userId: userId }
          }
        }
      });

      if (!file) {
        throw new Error('File not found');
      }

      if (!file.allowPreview) {
        throw new Error('Preview not allowed for this file');
      }

      const hasAccess = await this.canUserAccessFile(fileId, userId);
      if (!hasAccess) {
        throw new Error('You do not have permission to access this file');
      }

      // Check if file type supports preview
      const previewSupported = this.isPreviewSupported(file.mimeType);
      if (!previewSupported) {
        throw new Error('Preview not supported for this file type');
      }

      // For images, return base64 encoded content
      if (file.mimeType.startsWith('image/')) {
        const fileContent = await fs.readFile(file.filePath);
        const base64Content = fileContent.toString('base64');
        return {
          type: 'image',
          content: `data:${file.mimeType};base64,${base64Content}`,
          filename: file.originalName
        };
      }

      // For text files, return text content
      if (file.mimeType.startsWith('text/')) {
        const textContent = await fs.readFile(file.filePath, 'utf-8');
        return {
          type: 'text',
          content: textContent,
          filename: file.originalName
        };
      }

      // For other files, return metadata
      return {
        type: 'metadata',
        filename: file.originalName,
        size: file.size,
        mimeType: file.mimeType,
        uploadedAt: file.createdAt
      };
    } catch (error) {
      console.error('Error getting file preview:', error);
      throw error;
    }
  }

  /**
   * Get shared files accessible to user
   */
  async getUserSharedFiles(userId, companyId, filters = {}) {
    try {
      const { page = 1, limit = 20, type, search, sortBy = 'createdAt', sortOrder = 'desc' } = filters;
      const offset = (page - 1) * limit;

      const where = {
        companyId: companyId,
        OR: [
          { uploaderId: userId },
          {
            access: {
              some: {
                userId: userId,
                OR: [
                  { expiresAt: null },
                  { expiresAt: { gt: new Date() } }
                ]
              }
            }
          },
          { isPublic: true }
        ],
        // Only include non-expired files
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      };

      if (type) where.mimeType = { contains: type };
      if (search) {
        where.OR = [
          { originalName: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      const files = await prisma.sharedFile.findMany({
        where,
        include: {
          uploader: {
            select: { id: true, firstName: true, lastName: true }
          },
          access: {
            where: { userId: userId }
          },
          _count: {
            select: {
              access: true,
              downloads: true
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip: offset,
        take: limit
      });

      const total = await prisma.sharedFile.count({ where });

      return {
        files: files.map(file => ({
          ...file,
          createdAtLagos: format(
            toZonedTime(file.createdAt, this.lagosTimezone), 
            'HH:mm dd/MM/yyyy'
          ),
          userAccess: file.access[0] || null,
          isOwner: file.uploaderId === userId,
          accessCount: file._count.access,
          downloadCount: file._count.downloads,
          fileSizeFormatted: this.formatFileSize(file.size),
          previewSupported: this.isPreviewSupported(file.mimeType)
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting user shared files:', error);
      throw error;
    }
  }

  /**
   * Get file details
   */
  async getFileDetails(fileId, userId) {
    try {
      const file = await prisma.sharedFile.findUnique({
        where: { id: fileId },
        include: {
          uploader: {
            select: { id: true, firstName: true, lastName: true, email: true }
          },
          company: {
            select: { id: true, name: true }
          },
          access: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, email: true }
              }
            }
          },
          downloads: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true }
              }
            },
            orderBy: { downloadedAt: 'desc' },
            take: 10
          }
        }
      });

      if (!file) {
        throw new Error('File not found');
      }

      const hasAccess = await this.canUserAccessFile(fileId, userId);
      if (!hasAccess) {
        throw new Error('You do not have permission to access this file');
      }

      const userAccess = file.access.find(access => access.userId === userId);

      return {
        ...file,
        createdAtLagos: format(toZonedTime(file.createdAt, this.lagosTimezone), 'HH:mm dd/MM/yyyy'),
        fileSizeFormatted: this.formatFileSize(file.size),
        userAccess: userAccess || null,
        isOwner: file.uploaderId === userId,
        accessCount: file.access.length,
        downloadCount: file.downloads.length,
        previewSupported: this.isPreviewSupported(file.mimeType),
        recentDownloads: file.downloads.map(download => ({
          ...download,
          downloadedAtLagos: format(toZonedTime(download.downloadedAt, this.lagosTimezone), 'HH:mm dd/MM/yyyy')
        }))
      };
    } catch (error) {
      console.error('Error getting file details:', error);
      throw error;
    }
  }

  /**
   * Delete shared file
   */
  async deleteSharedFile(fileId, userId) {
    try {
      const file = await prisma.sharedFile.findUnique({
        where: { id: fileId },
        include: {
          access: {
            where: { userId: userId }
          }
        }
      });

      if (!file) {
        throw new Error('File not found');
      }

      // Check if user can delete
      const canDelete = file.uploaderId === userId || 
                       (file.access[0] && file.access[0].canDelete);

      if (!canDelete) {
        throw new Error('You do not have permission to delete this file');
      }

      // Delete file from disk
      try {
        await fs.unlink(file.filePath);
      } catch (error) {
        console.warn('File not found on disk:', file.filePath);
      }

      // Delete from database (cascade will handle related records)
      await prisma.sharedFile.delete({
        where: { id: fileId }
      });

      console.log(`🗑️ Shared file deleted: ${file.originalName} (${fileId})`);
      return true;
    } catch (error) {
      console.error('Error deleting shared file:', error);
      throw error;
    }
  }

  /**
   * Record file download
   */
  async recordFileDownload(fileId, userId) {
    try {
      await prisma.fileDownload.create({
        data: {
          fileId: fileId,
          userId: userId,
          downloadedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error recording file download:', error);
    }
  }

  /**
   * Check if user can access file
   */
  async canUserAccessFile(fileId, userId) {
    try {
      const file = await prisma.sharedFile.findUnique({
        where: { id: fileId },
        include: {
          access: {
            where: { userId: userId }
          }
        }
      });

      if (!file) return false;
      if (file.uploaderId === userId) return true;
      if (file.isPublic) return true;

      const access = file.access[0];
      if (access && (!access.expiresAt || access.expiresAt > new Date())) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking file access:', error);
      return false;
    }
  }

  /**
   * Get file download count
   */
  async getFileDownloadCount(fileId) {
    try {
      return await prisma.fileDownload.count({
        where: { fileId: fileId }
      });
    } catch (error) {
      console.error('Error getting download count:', error);
      return 0;
    }
  }

  /**
   * Validate uploaded file
   */
  validateFile(fileData) {
    if (!fileData.originalName || !fileData.size || !fileData.mimeType) {
      return { valid: false, error: 'Missing required file information' };
    }

    if (fileData.size > this.maxFileSize) {
      return { 
        valid: false, 
        error: `File too large. Maximum size is ${this.formatFileSize(this.maxFileSize)}` 
      };
    }

    if (!this.allowedMimeTypes.includes(fileData.mimeType)) {
      return { valid: false, error: 'File type not allowed' };
    }

    return { valid: true };
  }

  /**
   * Check if file type supports preview
   */
  isPreviewSupported(mimeType) {
    const previewableMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/plain',
      'text/csv',
      'application/json'
    ];

    return previewableMimeTypes.includes(mimeType);
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Ensure upload directory exists
   */
  async ensureUploadDirectory() {
    try {
      await fs.mkdir(this.uploadDirectory, { recursive: true });
    } catch (error) {
      console.error('Error creating upload directory:', error);
    }
  }

  /**
   * Hash password for file protection
   */
  hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * Verify password for file access
   */
  verifyPassword(password, hashedPassword) {
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    return hash === hashedPassword;
  }

  /**
   * Get file sharing analytics
   */
  async getFileSharingAnalytics(companyId, dateRange = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      let totalFiles = 0;
      try {
        totalFiles = await prisma.sharedFile.count({
          where: {
            companyId: companyId,
            createdAt: { gte: startDate }
          }
        });
      } catch (error) {
        console.error('Error counting shared files:', error);
      }

      let totalDownloads = 0;
      try {
        // Check if fileDownload table exists before using it
        if (prisma.fileDownload) {
          totalDownloads = await prisma.fileDownload.count({
            where: {
              file: {
                companyId: companyId
              },
              downloadedAt: { gte: startDate }
            }
          });
        }
      } catch (error) {
        console.error('FileDownload table may not exist:', error);
      }

      let totalFileSize = 0;
      try {
        const fileSizeResult = await prisma.sharedFile.aggregate({
          where: {
            companyId: companyId,
            createdAt: { gte: startDate }
          },
          _sum: {
            fileSize: true
          }
        });
        totalFileSize = fileSizeResult._sum.fileSize || 0;
      } catch (error) {
        console.error('Error aggregating file sizes:', error);
      }

      let totalSharedAccess = 0;
      try {
        // Check if fileAccess table exists before using it
        if (prisma.fileAccess) {
          totalSharedAccess = await prisma.fileAccess.count({
            where: {
              file: {
                companyId: companyId
              },
              accessedAt: { gte: startDate }
            }
          });
        }
      } catch (error) {
        console.error('FileAccess table may not exist:', error);
      }

      let popularFiles = [];
      try {
        popularFiles = await prisma.sharedFile.findMany({
          where: {
            companyId: companyId,
            createdAt: { gte: startDate }
          },
          select: {
            id: true,
            fileName: true,
            originalName: true,
            fileSize: true,
            mimeType: true,
            downloadCount: true,
            createdAt: true
          },
          orderBy: {
            downloadCount: 'desc'
          },
          take: 5
        });
      } catch (error) {
        console.error('Error getting popular files:', error);
      }

      return {
        totalFiles,
        totalDownloads,
        totalFileSize: totalFileSize,
        totalFileSizeFormatted: this.formatFileSize(totalFileSize),
        totalSharedAccess,
        averageDownloadsPerFile: totalFiles > 0 ? (totalDownloads / totalFiles).toFixed(1) : 0,
        averageAccessPerFile: totalFiles > 0 ? (totalSharedAccess / totalFiles).toFixed(1) : 0,
        popularFiles: popularFiles.map(file => ({
          id: file.id,
          name: file.originalName || file.fileName,
          downloadCount: file.downloadCount || 0,
          size: this.formatFileSize(file.fileSize || 0)
        }))
      };
    } catch (error) {
      console.error('Error getting file sharing analytics:', error);
      throw error;
    }
  }

  /**
   * Clean up expired files
   */
  async cleanupExpiredFiles() {
    try {
      const expiredFiles = await prisma.sharedFile.findMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      for (const file of expiredFiles) {
        try {
          await fs.unlink(file.filePath);
        } catch (error) {
          console.warn('Could not delete expired file:', file.filePath);
        }
      }

      const deletedCount = await prisma.sharedFile.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      console.log(`🧹 Cleaned up ${deletedCount.count} expired files`);
      return deletedCount.count;
    } catch (error) {
      console.error('Error cleaning up expired files:', error);
      throw error;
    }
  }
}

module.exports = new FileSharingService();