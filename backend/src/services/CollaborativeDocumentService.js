// Collaborative Document Service for CollabNotes Nigeria
const { PrismaClient } = require("@prisma/client");
const { format } = require("date-fns");
const { toZonedTime } = require("date-fns-tz");

const prisma = new PrismaClient();

class CollaborativeDocumentService {
  constructor() {
    this.lagosTimezone = "Africa/Lagos";
    this.activeEditSessions = new Map(); // Track active editing sessions
    this.maxFileSize = 100 * 1024 * 1024; // 100MB
    this.autoSaveInterval = 30000; // 30 seconds
  }

  /**
   * Create a new collaborative document
   */
  async createDocument(data) {
    try {
      const document = await prisma.collaborativeDocument.create({
        data: {
          title: data.title,
          content: data.content || "",
          type: data.type || "TEXT",
          ownerId: data.ownerId,
          companyId: data.companyId,
          isPublic: data.isPublic || false,
          allowedEditRoles: data.allowedEditRoles || ["OWNER", "EDITOR"],
          allowedViewRoles: data.allowedViewRoles || [
            "OWNER",
            "EDITOR",
            "VIEWER",
          ],
          version: 1,
          settings: {
            ...data.settings,
            enableComments:
              data.enableComments !== undefined ? data.enableComments : true,
            enableSuggestions:
              data.enableSuggestions !== undefined
                ? data.enableSuggestions
                : true,
            enableVersionHistory:
              data.enableVersionHistory !== undefined
                ? data.enableVersionHistory
                : true,
            autoSave: data.autoSave !== undefined ? data.autoSave : true,
            lagosTimezone: "Africa/Lagos",
          },
          metadata: data.metadata || {},
        },
        include: {
          owner: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          company: {
            select: { id: true, name: true },
          },
        },
      });

      // Create initial version
      await this.createDocumentVersion(document.id, {
        content: document.content,
        changeDescription: "Initial document creation",
        authorId: data.ownerId,
      });

      console.log(
        `📄 Collaborative document created: ${document.title} (${document.id})`
      );
      return document;
    } catch (error) {
      console.error("Error creating collaborative document:", error);
      throw new Error("Failed to create collaborative document");
    }
  }

  /**
   * Update document content
   */
  async updateDocumentContent(documentId, userId, contentData) {
    try {
      const document = await prisma.collaborativeDocument.findUnique({
        where: { id: documentId },
        include: {
          permissions: {
            where: { userId: userId },
          },
        },
      });

      if (!document) {
        throw new Error("Document not found");
      }

      // Check permissions
      const canEdit = await this.canUserEdit(documentId, userId);
      if (!canEdit) {
        throw new Error("You do not have permission to edit this document");
      }

      // Update document
      const updatedDocument = await prisma.collaborativeDocument.update({
        where: { id: documentId },
        data: {
          content: contentData.content,
          lastEditedAt: new Date(),
          lastEditedBy: userId,
          version: { increment: 1 },
        },
      });

      // Create version if significant change
      if (contentData.createVersion) {
        await this.createDocumentVersion(documentId, {
          content: contentData.content,
          changeDescription:
            contentData.changeDescription || "Document updated",
          authorId: userId,
        });
      }

      // Track editing activity
      await this.trackEditingActivity(documentId, userId, "CONTENT_UPDATE");

      console.log(`📝 Document updated: ${documentId} by user ${userId}`);
      return updatedDocument;
    } catch (error) {
      console.error("Error updating document content:", error);
      throw error;
    }
  }

  /**
   * Add user to document with specific permissions
   */
  async shareDocument(documentId, ownerId, shareData) {
    try {
      const document = await prisma.collaborativeDocument.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw new Error("Document not found");
      }

      if (document.ownerId !== ownerId) {
        throw new Error("Only the document owner can share the document");
      }

      // Check if permission already exists
      const existingPermission = await prisma.documentPermission.findFirst({
        where: {
          documentId: documentId,
          userId: shareData.userId,
        },
      });

      if (existingPermission) {
        // Update existing permission
        const updatedPermission = await prisma.documentPermission.update({
          where: { id: existingPermission.id },
          data: {
            role: shareData.role,
            canEdit:
              shareData.canEdit !== undefined ? shareData.canEdit : false,
            canComment:
              shareData.canComment !== undefined ? shareData.canComment : true,
            canShare:
              shareData.canShare !== undefined ? shareData.canShare : false,
            expiresAt: shareData.expiresAt || null,
          },
        });

        return updatedPermission;
      } else {
        // Create new permission
        const permission = await prisma.documentPermission.create({
          data: {
            documentId: documentId,
            userId: shareData.userId,
            grantedBy: ownerId,
            role: shareData.role,
            canEdit:
              shareData.canEdit !== undefined ? shareData.canEdit : false,
            canComment:
              shareData.canComment !== undefined ? shareData.canComment : true,
            canShare:
              shareData.canShare !== undefined ? shareData.canShare : false,
            expiresAt: shareData.expiresAt || null,
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });

        console.log(
          `🤝 Document shared: ${documentId} with user ${shareData.userId}`
        );
        return permission;
      }
    } catch (error) {
      console.error("Error sharing document:", error);
      throw error;
    }
  }

  /**
   * Add comment to document
   */
  async addComment(documentId, userId, commentData) {
    try {
      const canComment = await this.canUserComment(documentId, userId);
      if (!canComment) {
        throw new Error(
          "You do not have permission to comment on this document"
        );
      }

      const comment = await prisma.documentComment.create({
        data: {
          documentId: documentId,
          authorId: userId,
          content: commentData.content,
          position: commentData.position || null, // For positioning comments in the document
          parentId: commentData.parentId || null, // For threaded comments
          isResolved: false,
        },
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          replies: {
            include: {
              author: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      });

      // Track commenting activity
      await this.trackEditingActivity(documentId, userId, "COMMENT_ADDED");

      console.log(
        `💬 Comment added to document ${documentId} by user ${userId}`
      );
      return comment;
    } catch (error) {
      console.error("Error adding comment:", error);
      throw error;
    }
  }

  /**
   * Get document with full details
   */
  async getDocument(documentId, userId) {
    try {
      const document = await prisma.collaborativeDocument.findUnique({
        where: { id: documentId },
        include: {
          owner: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          company: {
            select: { id: true, name: true },
          },
          permissions: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          comments: {
            where: { parentId: null }, // Only top-level comments
            include: {
              author: {
                select: { id: true, firstName: true, lastName: true },
              },
              replies: {
                include: {
                  author: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          versions: {
            select: {
              id: true,
              version: true,
              createdAt: true,
              changeDescription: true,
            },
            orderBy: { version: "desc" },
            take: 5,
          },
        },
      });

      if (!document) {
        throw new Error("Document not found");
      }

      // Check if user can view
      const canView = await this.canUserView(documentId, userId);
      if (!canView) {
        throw new Error("You do not have permission to view this document");
      }

      // Add user permissions
      const userPermissions = {
        canEdit: await this.canUserEdit(documentId, userId),
        canComment: await this.canUserComment(documentId, userId),
        canShare: await this.canUserShare(documentId, userId),
        isOwner: document.ownerId === userId,
      };

      // Add Lagos time formatting
      const lagosTime = toZonedTime(
        document.lastEditedAt || document.createdAt,
        this.lagosTimezone
      );

      return {
        ...document,
        userPermissions,
        lastEditedAtLagos: format(lagosTime, "HH:mm dd/MM/yyyy"),
        timezone: "WAT",
        commentCount: document.comments.length,
        collaboratorCount: document.permissions.length + 1, // +1 for owner
      };
    } catch (error) {
      console.error("Error getting document:", error);
      throw error;
    }
  }

  /**
   * Get documents accessible to user
   */
  async getUserDocuments(userId, companyId, filters = {}) {
    try {
      const { page = 1, limit = 20, type, search } = filters;
      const offset = (page - 1) * limit;

      const where = {
        companyId: companyId,
        OR: [
          { createdBy: userId },
          {
            permissions: {
              some: {
                userId: userId,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
            },
          },
          // Remove isPublic check since this field doesn't exist in schema
        ],
      };

      if (type) where.type = type;
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { content: { contains: search, mode: "insensitive" } },
        ];
      }

      const documents = await prisma.collaborativeDocument.findMany({
        where,
        include: {
          creator: {
            select: { id: true, name: true, email: true },
          },
          permissions: {
            select: { userId: true, permission: true },
          },
          _count: {
            select: {
              permissions: true,
              collaborations: true,
            },
          },
        },
        orderBy: { lastEditedAt: "desc" },
        skip: offset,
        take: limit,
      });

      const total = await prisma.collaborativeDocument.count({ where });

      return {
        documents: documents.map((doc) => ({
          ...doc,
          lastEditedAtLagos: format(
            toZonedTime(doc.lastEditedAt || doc.createdAt, this.lagosTimezone),
            "HH:mm dd/MM/yyyy"
          ),
          collaboratorCount: doc.permissions.length + 1,
          commentCount: doc._count.comments,
          versionCount: doc._count.versions,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error("Error getting user documents:", error);
      throw error;
    }
  }

  /**
   * Create document version
   */
  async createDocumentVersion(documentId, versionData) {
    try {
      const version = await prisma.documentVersion.create({
        data: {
          documentId: documentId,
          content: versionData.content,
          version: versionData.version || 1,
          changeDescription: versionData.changeDescription,
          authorId: versionData.authorId,
          contentHash: this.generateContentHash(versionData.content),
        },
      });

      return version;
    } catch (error) {
      console.error("Error creating document version:", error);
      throw error;
    }
  }

  /**
   * Get document version history
   */
  async getDocumentVersions(documentId, userId) {
    try {
      const canView = await this.canUserView(documentId, userId);
      if (!canView) {
        throw new Error("You do not have permission to view this document");
      }

      const versions = await prisma.documentVersion.findMany({
        where: { documentId },
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { version: "desc" },
      });

      return versions.map((version) => ({
        ...version,
        createdAtLagos: format(
          toZonedTime(version.createdAt, this.lagosTimezone),
          "HH:mm dd/MM/yyyy"
        ),
      }));
    } catch (error) {
      console.error("Error getting document versions:", error);
      throw error;
    }
  }

  /**
   * Restore document to previous version
   */
  async restoreDocumentVersion(documentId, versionId, userId) {
    try {
      const canEdit = await this.canUserEdit(documentId, userId);
      if (!canEdit) {
        throw new Error("You do not have permission to edit this document");
      }

      const version = await prisma.documentVersion.findUnique({
        where: { id: versionId },
      });

      if (!version || version.documentId !== documentId) {
        throw new Error("Version not found");
      }

      // Update document with version content
      const document = await prisma.collaborativeDocument.update({
        where: { id: documentId },
        data: {
          content: version.content,
          lastEditedAt: new Date(),
          lastEditedBy: userId,
          version: { increment: 1 },
        },
      });

      // Create new version for the restoration
      await this.createDocumentVersion(documentId, {
        content: version.content,
        changeDescription: `Restored to version ${version.version}`,
        authorId: userId,
      });

      console.log(
        `🔄 Document restored to version ${version.version}: ${documentId}`
      );
      return document;
    } catch (error) {
      console.error("Error restoring document version:", error);
      throw error;
    }
  }

  /**
   * Track editing activity
   */
  async trackEditingActivity(documentId, userId, actionType) {
    try {
      await prisma.documentActivity.create({
        data: {
          documentId: documentId,
          userId: userId,
          actionType: actionType,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error("Error tracking editing activity:", error);
    }
  }

  /**
   * Check if user can view document
   */
  async canUserView(documentId, userId) {
    try {
      const document = await prisma.collaborativeDocument.findUnique({
        where: { id: documentId },
        include: {
          permissions: {
            where: { userId: userId },
          },
        },
      });

      if (!document) return false;
      if (document.ownerId === userId) return true;
      if (document.isPublic) return true;

      const permission = document.permissions[0];
      if (
        permission &&
        (!permission.expiresAt || permission.expiresAt > new Date())
      ) {
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking view permission:", error);
      return false;
    }
  }

  /**
   * Check if user can edit document
   */
  async canUserEdit(documentId, userId) {
    try {
      const document = await prisma.collaborativeDocument.findUnique({
        where: { id: documentId },
        include: {
          permissions: {
            where: { userId: userId },
          },
        },
      });

      if (!document) return false;
      if (document.ownerId === userId) return true;

      const permission = document.permissions[0];
      if (
        permission &&
        permission.canEdit &&
        (!permission.expiresAt || permission.expiresAt > new Date())
      ) {
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking edit permission:", error);
      return false;
    }
  }

  /**
   * Check if user can comment on document
   */
  async canUserComment(documentId, userId) {
    try {
      const document = await prisma.collaborativeDocument.findUnique({
        where: { id: documentId },
        include: {
          permissions: {
            where: { userId: userId },
          },
        },
      });

      if (!document) return false;
      if (document.ownerId === userId) return true;

      const permission = document.permissions[0];
      if (
        permission &&
        permission.canComment &&
        (!permission.expiresAt || permission.expiresAt > new Date())
      ) {
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking comment permission:", error);
      return false;
    }
  }

  /**
   * Check if user can share document
   */
  async canUserShare(documentId, userId) {
    try {
      const document = await prisma.collaborativeDocument.findUnique({
        where: { id: documentId },
        include: {
          permissions: {
            where: { userId: userId },
          },
        },
      });

      if (!document) return false;
      if (document.ownerId === userId) return true;

      const permission = document.permissions[0];
      if (
        permission &&
        permission.canShare &&
        (!permission.expiresAt || permission.expiresAt > new Date())
      ) {
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking share permission:", error);
      return false;
    }
  }

  /**
   * Generate content hash for version comparison
   */
  generateContentHash(content) {
    const crypto = require("crypto");
    return crypto.createHash("md5").update(content).digest("hex");
  }

  /**
   * Get collaborative document analytics
   */
  async getDocumentAnalytics(companyId, dateRange = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      // Check if tables exist by attempting basic counts with fallbacks
      let totalDocuments = 0;
      try {
        totalDocuments = await prisma.collaborativeDocument.count({
          where: {
            companyId: companyId,
            createdAt: { gte: startDate },
          },
        });
      } catch (error) {
        console.error('Error counting documents:', error);
      }

      let totalComments = 0;
      try {
        // Check if documentComment model exists in prisma client
        if (prisma.documentComment) {
          totalComments = await prisma.documentComment.count({
            where: {
              document: {
                companyId: companyId,
                createdAt: { gte: startDate },
              },
            },
          });
        }
      } catch (error) {
        console.error('Error counting comments:', error);
        // Fallback: try a simpler count
        try {
          if (prisma.documentComment) {
            totalComments = await prisma.documentComment.count({
              where: {
                createdAt: { gte: startDate },
              },
            });
          }
        } catch (fallbackError) {
          console.error('DocumentComment table may not exist:', fallbackError);
        }
      }

      let totalVersions = 0;
      try {
        totalVersions = await prisma.documentVersion.count({
          where: {
            document: {
              companyId: companyId,
              createdAt: { gte: startDate },
            },
          },
        });
      } catch (error) {
        console.error('Error counting versions:', error);
      }

      let totalCollaborators = 0;
      try {
        totalCollaborators = await prisma.documentPermission.count({
          where: {
            document: {
              companyId: companyId,
            },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        });
      } catch (error) {
        console.error('Error counting collaborators:', error);
      }

      let totalActivities = 0;
      try {
        // Check if documentActivity model exists in prisma client
        if (prisma.documentActivity) {
          totalActivities = await prisma.documentActivity.count({
            where: {
              document: {
                companyId: companyId,
              },
              timestamp: { gte: startDate },
            },
          });
        }
      } catch (error) {
        console.error('Error counting activities:', error);
      }

      return {
        totalDocuments,
        totalComments,
        totalVersions,
        totalCollaborators,
        totalActivities,
        averageCommentsPerDocument:
          totalDocuments > 0 ? (totalComments / totalDocuments).toFixed(1) : 0,
        averageVersionsPerDocument:
          totalDocuments > 0 ? (totalVersions / totalDocuments).toFixed(1) : 0,
        averageCollaboratorsPerDocument:
          totalDocuments > 0
            ? (totalCollaborators / totalDocuments).toFixed(1)
            : 0,
      };
    } catch (error) {
      console.error("Error getting document analytics:", error);
      throw error;
    }
  }

  /**
   * Clean up expired permissions
   */
  async cleanupExpiredPermissions() {
    try {
      const expiredPermissions = await prisma.documentPermission.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      console.log(
        `🧹 Cleaned up ${expiredPermissions.count} expired document permissions`
      );
      return expiredPermissions.count;
    } catch (error) {
      console.error("Error cleaning up expired permissions:", error);
      throw error;
    }
  }
}

module.exports = new CollaborativeDocumentService();
