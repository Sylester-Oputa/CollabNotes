// Approval Management Service for CollabNotes Nigeria Workflows
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class ApprovalService {
  // ========== APPROVAL REQUEST MANAGEMENT ==========

  async createApprovalRequest(data) {
    try {
      const {
        executionId,
        requestedBy,
        approverIds,
        title,
        description,
        priority = 'MEDIUM',
        dueDate,
        attachments,
        metadata = {}
      } = data;

      const approval = await prisma.approvalRequest.create({
        data: {
          executionId,
          requestedBy,
          approverIds,
          title,
          description,
          priority,
          dueDate: dueDate ? new Date(dueDate) : null,
          attachments,
          metadata
        },
        include: {
          requester: {
            select: { id: true, name: true, email: true }
          },
          execution: {
            include: {
              instance: {
                include: {
                  template: {
                    select: { name: true, category: true }
                  }
                }
              }
            }
          }
        }
      });

      // Send notifications to approvers
      await this.notifyApprovers(approval);

      return {
        success: true,
        message: 'Approval request created successfully',
        approval
      };
    } catch (error) {
      console.error('Error creating approval request:', error);
      return {
        success: false,
        error: 'Failed to create approval request',
        details: error.message
      };
    }
  }

  async getApprovalRequests(userId, options = {}) {
    try {
      const {
        status,
        priority,
        requestedBy,
        limit = 20,
        offset = 0,
        includeRequested = true, // Include requests made by user
        includeAssigned = true   // Include requests assigned to user
      } = options;

      let where = {};
      
      if (includeRequested && includeAssigned) {
        where.OR = [
          { requestedBy: userId },
          { approverIds: { has: userId } }
        ];
      } else if (includeRequested) {
        where.requestedBy = userId;
      } else if (includeAssigned) {
        where.approverIds = { has: userId };
      }

      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (requestedBy && !includeRequested) where.requestedBy = requestedBy;

      const [approvals, total] = await Promise.all([
        prisma.approvalRequest.findMany({
          where,
          include: {
            requester: {
              select: { id: true, name: true, email: true }
            },
            responder: {
              select: { id: true, name: true, email: true }
            },
            execution: {
              include: {
                instance: {
                  include: {
                    template: {
                      select: { name: true, category: true }
                    }
                  }
                }
              }
            }
          },
          orderBy: [
            { priority: 'desc' },
            { requestedAt: 'desc' }
          ],
          take: limit,
          skip: offset
        }),
        prisma.approvalRequest.count({ where })
      ]);

      // Add user's ability to approve to each request
      const approvalsWithPermissions = approvals.map(approval => ({
        ...approval,
        canApprove: approval.approverIds.includes(userId) && 
                   approval.status === 'PENDING',
        isRequester: approval.requestedBy === userId
      }));

      return {
        success: true,
        approvals: approvalsWithPermissions,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      };
    } catch (error) {
      console.error('Error fetching approval requests:', error);
      return {
        success: false,
        error: 'Failed to fetch approval requests'
      };
    }
  }

  async respondToApproval(approvalId, userId, decision, response = null) {
    try {
      // Check if user can approve this request
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: approvalId },
        include: {
          execution: {
            include: {
              instance: true
            }
          }
        }
      });

      if (!approval) {
        return {
          success: false,
          error: 'Approval request not found'
        };
      }

      if (!approval.approverIds.includes(userId)) {
        return {
          success: false,
          error: 'You are not authorized to approve this request'
        };
      }

      if (approval.status !== 'PENDING') {
        return {
          success: false,
          error: 'This approval request has already been responded to'
        };
      }

      const validDecisions = ['APPROVED', 'REJECTED'];
      if (!validDecisions.includes(decision)) {
        return {
          success: false,
          error: 'Invalid decision. Must be APPROVED or REJECTED'
        };
      }

      // Update the approval request
      const updatedApproval = await prisma.approvalRequest.update({
        where: { id: approvalId },
        data: {
          status: decision,
          respondedBy: userId,
          respondedAt: new Date(),
          response
        },
        include: {
          requester: {
            select: { id: true, name: true, email: true }
          },
          responder: {
            select: { id: true, name: true, email: true }
          },
          execution: {
            include: {
              instance: {
                include: {
                  template: {
                    select: { name: true }
                  }
                }
              }
            }
          }
        }
      });

      // Update the workflow execution based on approval decision
      await this.handleApprovalDecision(updatedApproval);

      // Notify the requester
      await this.notifyRequester(updatedApproval);

      return {
        success: true,
        message: `Approval request ${decision.toLowerCase()} successfully`,
        approval: updatedApproval
      };
    } catch (error) {
      console.error('Error responding to approval:', error);
      return {
        success: false,
        error: 'Failed to respond to approval request',
        details: error.message
      };
    }
  }

  async handleApprovalDecision(approval) {
    try {
      const execution = approval.execution;

      if (approval.status === 'APPROVED') {
        // Mark the workflow execution as completed
        await prisma.workflowExecution.update({
          where: { id: execution.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            output: {
              ...execution.output,
              approvalResult: 'APPROVED',
              approvedBy: approval.respondedBy,
              approvedAt: approval.respondedAt
            }
          }
        });

        // Continue workflow to next steps
        await this.continueWorkflow(execution.instanceId);

      } else if (approval.status === 'REJECTED') {
        // Mark the workflow execution as failed
        await prisma.workflowExecution.update({
          where: { id: execution.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            errorMessage: `Approval rejected: ${approval.response || 'No reason provided'}`,
            output: {
              ...execution.output,
              approvalResult: 'REJECTED',
              rejectedBy: approval.respondedBy,
              rejectedAt: approval.respondedAt
            }
          }
        });

        // Mark the entire workflow instance as failed
        await prisma.workflowInstance.update({
          where: { id: execution.instanceId },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            errorMessage: `Workflow failed due to approval rejection: ${approval.title}`
          }
        });
      }
    } catch (error) {
      console.error('Error handling approval decision:', error);
      throw error;
    }
  }

  async continueWorkflow(instanceId) {
    try {
      // Get all workflow steps and their dependencies
      const instance = await prisma.workflowInstance.findUnique({
        where: { id: instanceId },
        include: {
          template: {
            include: {
              steps: {
                include: {
                  dependencies: {
                    include: {
                      requiredStep: {
                        include: {
                          executions: {
                            where: { instanceId }
                          }
                        }
                      }
                    }
                  }
                },
                orderBy: { order: 'asc' }
              }
            }
          },
          executions: true
        }
      });

      if (!instance) return;

      // Find steps that can now be executed (all dependencies satisfied)
      const readySteps = instance.template.steps.filter(step => {
        // Check if this step has already been executed
        const alreadyExecuted = instance.executions.some(exec => 
          exec.stepId === step.id
        );
        
        if (alreadyExecuted) return false;

        // Check if all dependencies are satisfied
        return step.dependencies.every(dependency => {
          const requiredExecution = dependency.requiredStep.executions.find(
            exec => exec.instanceId === instanceId
          );
          return requiredExecution && requiredExecution.status === 'COMPLETED';
        });
      });

      // Execute ready steps
      const WorkflowService = require('./WorkflowService');
      const workflowService = new WorkflowService();

      for (const step of readySteps) {
        await workflowService.executeWorkflowStep(instanceId, step.id);
      }

    } catch (error) {
      console.error('Error continuing workflow:', error);
      throw error;
    }
  }

  // ========== APPROVAL ANALYTICS ==========

  async getApprovalMetrics(companyId, options = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate = new Date(),
        userId
      } = options;

      let where = {
        execution: {
          instance: {
            template: {
              companyId
            }
          }
        },
        requestedAt: {
          gte: startDate,
          lte: endDate
        }
      };

      if (userId) {
        where.OR = [
          { requestedBy: userId },
          { approverIds: { has: userId } }
        ];
      }

      const [
        totalRequests,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        averageResponseTime,
        requestsByPriority
      ] = await Promise.all([
        // Total requests
        prisma.approvalRequest.count({ where }),
        
        // Pending requests
        prisma.approvalRequest.count({
          where: { ...where, status: 'PENDING' }
        }),
        
        // Approved requests
        prisma.approvalRequest.count({
          where: { ...where, status: 'APPROVED' }
        }),
        
        // Rejected requests
        prisma.approvalRequest.count({
          where: { ...where, status: 'REJECTED' }
        }),
        
        // Average response time (in hours)
        prisma.approvalRequest.aggregate({
          where: {
            ...where,
            status: { in: ['APPROVED', 'REJECTED'] },
            respondedAt: { not: null }
          },
          _avg: {
            // This would need a computed field in a real implementation
            // For now, we'll calculate it separately
          }
        }),
        
        // Requests by priority
        prisma.approvalRequest.groupBy({
          by: ['priority'],
          where,
          _count: true
        })
      ]);

      // Calculate actual average response time
      const respondedRequests = await prisma.approvalRequest.findMany({
        where: {
          ...where,
          status: { in: ['APPROVED', 'REJECTED'] },
          respondedAt: { not: null }
        },
        select: {
          requestedAt: true,
          respondedAt: true
        }
      });

      const avgResponseTimeHours = respondedRequests.length > 0
        ? respondedRequests.reduce((sum, req) => {
            const diffMs = new Date(req.respondedAt) - new Date(req.requestedAt);
            return sum + (diffMs / (1000 * 60 * 60)); // Convert to hours
          }, 0) / respondedRequests.length
        : 0;

      return {
        success: true,
        metrics: {
          totalRequests,
          pendingRequests,
          approvedRequests,
          rejectedRequests,
          approvalRate: totalRequests > 0 ? (approvedRequests / totalRequests * 100).toFixed(1) : 0,
          rejectionRate: totalRequests > 0 ? (rejectedRequests / totalRequests * 100).toFixed(1) : 0,
          averageResponseTimeHours: avgResponseTimeHours.toFixed(1),
          requestsByPriority: requestsByPriority.reduce((acc, item) => {
            acc[item.priority] = item._count;
            return acc;
          }, {})
        }
      };
    } catch (error) {
      console.error('Error fetching approval metrics:', error);
      return {
        success: false,
        error: 'Failed to fetch approval metrics'
      };
    }
  }

  // ========== NOTIFICATION HELPERS ==========

  async notifyApprovers(approval) {
    try {
      for (const approverId of approval.approverIds) {
        await prisma.notification.create({
          data: {
            userId: approverId,
            title: `New Approval Request: ${approval.title}`,
            message: `${approval.requester.name} has requested your approval for: ${approval.title}`,
            type: 'APPROVAL_REQUEST',
            metadata: {
              approvalId: approval.id,
              priority: approval.priority,
              dueDate: approval.dueDate
            }
          }
        });
      }
    } catch (error) {
      console.error('Error notifying approvers:', error);
    }
  }

  async notifyRequester(approval) {
    try {
      const status = approval.status === 'APPROVED' ? 'approved' : 'rejected';
      const responderName = approval.responder?.name || 'Someone';

      await prisma.notification.create({
        data: {
          userId: approval.requestedBy,
          title: `Approval Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          message: `${responderName} has ${status} your request: ${approval.title}`,
          type: 'APPROVAL_RESPONSE',
          metadata: {
            approvalId: approval.id,
            decision: approval.status,
            response: approval.response
          }
        }
      });
    } catch (error) {
      console.error('Error notifying requester:', error);
    }
  }

  // ========== BULK OPERATIONS ==========

  async bulkApprove(approvalIds, userId, response = null) {
    try {
      const results = [];

      for (const approvalId of approvalIds) {
        const result = await this.respondToApproval(approvalId, userId, 'APPROVED', response);
        results.push({ approvalId, ...result });
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      return {
        success: successCount > 0,
        message: `Bulk approval completed: ${successCount} approved, ${failureCount} failed`,
        results,
        summary: { successCount, failureCount }
      };
    } catch (error) {
      console.error('Error in bulk approve:', error);
      return {
        success: false,
        error: 'Failed to perform bulk approval'
      };
    }
  }

  async bulkReject(approvalIds, userId, response = null) {
    try {
      const results = [];

      for (const approvalId of approvalIds) {
        const result = await this.respondToApproval(approvalId, userId, 'REJECTED', response);
        results.push({ approvalId, ...result });
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      return {
        success: successCount > 0,
        message: `Bulk rejection completed: ${successCount} rejected, ${failureCount} failed`,
        results,
        summary: { successCount, failureCount }
      };
    } catch (error) {
      console.error('Error in bulk reject:', error);
      return {
        success: false,
        error: 'Failed to perform bulk rejection'
      };
    }
  }

  // ========== DELEGATION ==========

  async delegateApproval(approvalId, fromUserId, toUserId, reason = null) {
    try {
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: approvalId }
      });

      if (!approval) {
        return {
          success: false,
          error: 'Approval request not found'
        };
      }

      if (!approval.approverIds.includes(fromUserId)) {
        return {
          success: false,
          error: 'You are not authorized to delegate this approval'
        };
      }

      if (approval.status !== 'PENDING') {
        return {
          success: false,
          error: 'Cannot delegate a completed approval request'
        };
      }

      // Update approver list
      const updatedApproverIds = approval.approverIds.map(id => 
        id === fromUserId ? toUserId : id
      );

      const updatedApproval = await prisma.approvalRequest.update({
        where: { id: approvalId },
        data: {
          approverIds: updatedApproverIds,
          metadata: {
            ...approval.metadata,
            delegations: [
              ...(approval.metadata?.delegations || []),
              {
                from: fromUserId,
                to: toUserId,
                reason,
                delegatedAt: new Date()
              }
            ]
          }
        }
      });

      // Notify the new approver
      await prisma.notification.create({
        data: {
          userId: toUserId,
          title: `Approval Delegated: ${approval.title}`,
          message: `An approval request has been delegated to you: ${approval.title}`,
          type: 'APPROVAL_DELEGATION',
          metadata: {
            approvalId: approval.id,
            delegatedFrom: fromUserId,
            reason
          }
        }
      });

      return {
        success: true,
        message: 'Approval successfully delegated',
        approval: updatedApproval
      };
    } catch (error) {
      console.error('Error delegating approval:', error);
      return {
        success: false,
        error: 'Failed to delegate approval'
      };
    }
  }
}

module.exports = ApprovalService;