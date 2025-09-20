// Workflow Automation Routes for CollabNotes Nigeria
const express = require('express');
const router = express.Router();
const { body, validationResult, query, param } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import services
const WorkflowService = require('../services/WorkflowService');
const ApprovalService = require('../services/ApprovalService');
const AssignmentService = require('../services/AssignmentService');

// Import middleware
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Initialize services
const workflowService = new WorkflowService();
const approvalService = new ApprovalService();
const assignmentService = new AssignmentService();

// Rate limiting for workflow operations
const workflowRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

const heavyOperationLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10 // limit each IP to 10 heavy operations per 5 minutes
});

// ========== WORKFLOW TEMPLATE ROUTES ==========

// Create workflow template
router.post('/templates', 
  authenticateToken,
  requireRole(['ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD']),
  workflowRateLimit,
  [
    body('name').notEmpty().trim().isLength({ min: 3, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('category').notEmpty().trim(),
    body('steps').isArray().withMessage('Steps must be an array'),
    body('triggers').optional().isArray()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const templateData = {
        ...req.body,
        companyId: req.user.companyId,
        createdBy: req.user.id
      };

      const result = await workflowService.createWorkflowTemplate(templateData);
      
      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error creating workflow template:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create workflow template' 
      });
    }
  }
);

// Get workflow templates
router.get('/templates',
  authenticateToken,
  workflowRateLimit,
  [
    query('category').optional().trim(),
    query('isActive').optional().isBoolean(),
    query('createdBy').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    query('search').optional().trim()
  ],
  async (req, res) => {
    try {
      const result = await workflowService.getWorkflowTemplates(
        req.user.companyId,
        req.query
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching workflow templates:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch workflow templates' 
      });
    }
  }
);

// Get specific workflow template
router.get('/templates/:templateId',
  authenticateToken,
  workflowRateLimit,
  param('templateId').isString(),
  async (req, res) => {
    try {
      const { templateId } = req.params;
      
      // Get template with full details
      const template = await prisma.workflowTemplate.findFirst({
        where: {
          id: templateId,
          companyId: req.user.companyId
        },
        include: {
          steps: {
            orderBy: { order: 'asc' },
            include: {
              dependencies: {
                include: {
                  requiredStep: {
                    select: { id: true, name: true, order: true }
                  }
                }
              }
            }
          },
          triggers: true,
          creator: {
            select: { id: true, name: true, email: true }
          },
          instances: {
            select: { id: true, status: true, startedAt: true },
            take: 10,
            orderBy: { startedAt: 'desc' }
          }
        }
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Workflow template not found'
        });
      }

      res.json({
        success: true,
        template
      });
    } catch (error) {
      console.error('Error fetching workflow template:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch workflow template' 
      });
    }
  }
);

// Update workflow template
router.put('/templates/:templateId',
  authenticateToken,
  requireRole(['ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD']),
  workflowRateLimit,
  [
    param('templateId').isString(),
    body('name').optional().trim().isLength({ min: 3, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('category').optional().trim(),
    body('isActive').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const result = await workflowService.updateWorkflowTemplate(
        req.params.templateId,
        req.body,
        req.user.id
      );
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error updating workflow template:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update workflow template' 
      });
    }
  }
);

// ========== WORKFLOW EXECUTION ROUTES ==========

// Start workflow instance
router.post('/instances',
  authenticateToken,
  workflowRateLimit,
  [
    body('templateId').notEmpty().isString(),
    body('contextData').optional().isObject(),
    body('triggeredBy').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { templateId, contextData = {} } = req.body;
      
      // Add user context
      const enrichedContext = {
        ...contextData,
        companyId: req.user.companyId,
        departmentId: req.user.departmentId,
        userId: req.user.id
      };

      const result = await workflowService.startWorkflowInstance(
        templateId,
        enrichedContext,
        req.user.id
      );
      
      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error starting workflow instance:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to start workflow instance' 
      });
    }
  }
);

// Get workflow instances
router.get('/instances',
  authenticateToken,
  workflowRateLimit,
  [
    query('status').optional().isIn(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED']),
    query('templateId').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  async (req, res) => {
    try {
      const result = await workflowService.getWorkflowInstances(
        req.user.companyId,
        req.query
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching workflow instances:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch workflow instances' 
      });
    }
  }
);

// ========== APPROVAL ROUTES ==========

// Get approval requests
router.get('/approvals',
  authenticateToken,
  workflowRateLimit,
  [
    query('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']),
    query('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    query('includeRequested').optional().isBoolean(),
    query('includeAssigned').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  async (req, res) => {
    try {
      const result = await approvalService.getApprovalRequests(
        req.user.id,
        req.query
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching approval requests:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch approval requests' 
      });
    }
  }
);

// Respond to approval request
router.post('/approvals/:approvalId/respond',
  authenticateToken,
  workflowRateLimit,
  [
    param('approvalId').isString(),
    body('decision').isIn(['APPROVED', 'REJECTED']),
    body('response').optional().trim().isLength({ max: 1000 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { approvalId } = req.params;
      const { decision, response } = req.body;

      const result = await approvalService.respondToApproval(
        approvalId,
        req.user.id,
        decision,
        response
      );
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error responding to approval:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to respond to approval' 
      });
    }
  }
);

// Bulk approve/reject
router.post('/approvals/bulk/:action',
  authenticateToken,
  workflowRateLimit,
  [
    param('action').isIn(['approve', 'reject']),
    body('approvalIds').isArray().withMessage('Approval IDs must be an array'),
    body('response').optional().trim().isLength({ max: 1000 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { action } = req.params;
      const { approvalIds, response } = req.body;

      let result;
      if (action === 'approve') {
        result = await approvalService.bulkApprove(approvalIds, req.user.id, response);
      } else {
        result = await approvalService.bulkReject(approvalIds, req.user.id, response);
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error in bulk approval operation:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to perform bulk operation' 
      });
    }
  }
);

// Delegate approval
router.post('/approvals/:approvalId/delegate',
  authenticateToken,
  workflowRateLimit,
  [
    param('approvalId').isString(),
    body('toUserId').notEmpty().isString(),
    body('reason').optional().trim().isLength({ max: 500 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { approvalId } = req.params;
      const { toUserId, reason } = req.body;

      const result = await approvalService.delegateApproval(
        approvalId,
        req.user.id,
        toUserId,
        reason
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error delegating approval:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to delegate approval' 
      });
    }
  }
);

// Get approval metrics
router.get('/approvals/metrics',
  authenticateToken,
  requireRole(['ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD']),
  workflowRateLimit,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('userId').optional().isString()
  ],
  async (req, res) => {
    try {
      const options = { ...req.query };
      if (options.startDate) options.startDate = new Date(options.startDate);
      if (options.endDate) options.endDate = new Date(options.endDate);

      const result = await approvalService.getApprovalMetrics(
        req.user.companyId,
        options
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching approval metrics:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch approval metrics' 
      });
    }
  }
);

// ========== ASSIGNMENT RULES ROUTES ==========

// Create assignment rule
router.post('/assignment-rules',
  authenticateToken,
  requireRole(['ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD']),
  workflowRateLimit,
  [
    body('name').notEmpty().trim().isLength({ min: 3, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('conditions').isObject(),
    body('assignmentLogic').isObject(),
    body('priority').optional().isInt({ min: 1, max: 1000 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const ruleData = {
        ...req.body,
        companyId: req.user.companyId,
        createdBy: req.user.id
      };

      const result = await assignmentService.createAssignmentRule(ruleData);
      
      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error creating assignment rule:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create assignment rule' 
      });
    }
  }
);

// Get assignment rules
router.get('/assignment-rules',
  authenticateToken,
  workflowRateLimit,
  [
    query('isActive').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  async (req, res) => {
    try {
      const result = await assignmentService.getAssignmentRules(
        req.user.companyId,
        req.query
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching assignment rules:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch assignment rules' 
      });
    }
  }
);

// Update assignment rule
router.put('/assignment-rules/:ruleId',
  authenticateToken,
  requireRole(['ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD']),
  workflowRateLimit,
  [
    param('ruleId').isString(),
    body('name').optional().trim().isLength({ min: 3, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('conditions').optional().isObject(),
    body('assignmentLogic').optional().isObject(),
    body('priority').optional().isInt({ min: 1, max: 1000 }),
    body('isActive').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const result = await assignmentService.updateAssignmentRule(
        req.params.ruleId,
        req.body,
        req.user.id
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error updating assignment rule:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update assignment rule' 
      });
    }
  }
);

// Delete assignment rule
router.delete('/assignment-rules/:ruleId',
  authenticateToken,
  requireRole(['ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD']),
  workflowRateLimit,
  param('ruleId').isString(),
  async (req, res) => {
    try {
      const result = await assignmentService.deleteAssignmentRule(
        req.params.ruleId,
        req.user.id
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error deleting assignment rule:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to delete assignment rule' 
      });
    }
  }
);

// Get assignment rule templates
router.get('/assignment-rules/templates',
  authenticateToken,
  workflowRateLimit,
  async (req, res) => {
    try {
      const result = assignmentService.getAssignmentRuleTemplates();
      res.json(result);
    } catch (error) {
      console.error('Error fetching assignment rule templates:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch assignment rule templates' 
      });
    }
  }
);

// Create rule from template
router.post('/assignment-rules/from-template',
  authenticateToken,
  requireRole(['ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD']),
  workflowRateLimit,
  [
    body('templateName').notEmpty().isString(),
    body('customizations').optional().isObject()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { templateName, customizations = {} } = req.body;

      const result = await assignmentService.createRuleFromTemplate(
        templateName,
        req.user.companyId,
        req.user.id,
        customizations
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error creating rule from template:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create rule from template' 
      });
    }
  }
);

// Auto-assign task
router.post('/auto-assign',
  authenticateToken,
  workflowRateLimit,
  [
    body('title').notEmpty().trim(),
    body('description').optional().trim(),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    body('category').optional().trim(),
    body('skills').optional().isArray()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const taskData = {
        ...req.body,
        companyId: req.user.companyId,
        departmentId: req.user.departmentId,
        createdBy: req.user.id
      };

      const result = await assignmentService.autoAssignTask(taskData);
      
      res.json(result);
    } catch (error) {
      console.error('Error in auto-assignment:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to auto-assign task' 
      });
    }
  }
);

// Get assignment metrics
router.get('/assignment-rules/metrics',
  authenticateToken,
  requireRole(['ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD']),
  workflowRateLimit,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('departmentId').optional().isString()
  ],
  async (req, res) => {
    try {
      const options = { ...req.query };
      if (options.startDate) options.startDate = new Date(options.startDate);
      if (options.endDate) options.endDate = new Date(options.endDate);

      const result = await assignmentService.getAssignmentMetrics(
        req.user.companyId,
        options
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching assignment metrics:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch assignment metrics' 
      });
    }
  }
);

// ========== WORKFLOW TEMPLATE LIBRARY ==========

// Get public workflow templates from library
router.get('/library',
  authenticateToken,
  workflowRateLimit,
  [
    query('category').optional().trim(),
    query('industry').optional().trim(),
    query('search').optional().trim(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  async (req, res) => {
    try {
      const {
        category,
        industry = 'general', // Default to general templates
        search,
        limit = 20,
        offset = 0
      } = req.query;

      let where = { isPublic: true };
      
      if (category) where.category = category;
      if (industry && industry !== 'general') where.industry = industry;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { tags: { hasSome: [search] } }
        ];
      }

      const [templates, total] = await Promise.all([
        prisma.workflowTemplateLibrary.findMany({
          where,
          include: {
            creator: {
              select: { name: true }
            }
          },
          orderBy: [
            { popularity: 'desc' },
            { createdAt: 'desc' }
          ],
          take: parseInt(limit),
          skip: parseInt(offset)
        }),
        prisma.workflowTemplateLibrary.count({ where })
      ]);

      res.json({
        success: true,
        templates,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < total
        }
      });
    } catch (error) {
      console.error('Error fetching template library:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch template library' 
      });
    }
  }
);

// Create workflow from library template
router.post('/library/:templateId/use',
  authenticateToken,
  requireRole(['ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD']),
  heavyOperationLimit,
  [
    param('templateId').isString(),
    body('name').optional().trim().isLength({ min: 3, max: 100 }),
    body('customizations').optional().isObject()
  ],
  async (req, res) => {
    try {
      const { templateId } = req.params;
      const { name, customizations = {} } = req.body;

      // Get library template
      const libraryTemplate = await prisma.workflowTemplateLibrary.findUnique({
        where: { id: templateId }
      });

      if (!libraryTemplate) {
        return res.status(404).json({
          success: false,
          error: 'Library template not found'
        });
      }

      // Create workflow template from library template
      const templateData = {
        name: name || libraryTemplate.name,
        description: libraryTemplate.description,
        category: libraryTemplate.category,
        companyId: req.user.companyId,
        createdBy: req.user.id,
        steps: libraryTemplate.template.steps || [],
        triggers: libraryTemplate.template.triggers || [],
        metadata: {
          ...libraryTemplate.template.metadata,
          sourceLibraryId: templateId,
          ...customizations
        }
      };

      const result = await workflowService.createWorkflowTemplate(templateData);

      if (result.success) {
        // Increment popularity counter
        await prisma.workflowTemplateLibrary.update({
          where: { id: templateId },
          data: { popularity: { increment: 1 } }
        });
      }

      res.json(result);
    } catch (error) {
      console.error('Error creating workflow from library template:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create workflow from library template' 
      });
    }
  }
);

module.exports = router;