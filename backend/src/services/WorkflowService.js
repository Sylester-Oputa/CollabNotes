// Workflow Automation Service for CollabNotes Nigeria
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class WorkflowService {
  // ========== WORKFLOW TEMPLATE MANAGEMENT ==========

  async createWorkflowTemplate(data) {
    try {
      const { 
        name, 
        description, 
        category, 
        companyId, 
        createdBy, 
        steps = [], 
        triggers = [],
        metadata = {} 
      } = data;

      const template = await prisma.workflowTemplate.create({
        data: {
          name,
          description,
          category,
          companyId,
          createdBy,
          metadata,
          steps: {
            create: steps.map((step, index) => ({
              name: step.name,
              description: step.description,
              stepType: step.stepType,
              order: step.order || index + 1,
              configuration: step.configuration || {},
              conditions: step.conditions,
              isRequired: step.isRequired !== false,
              timeoutMinutes: step.timeoutMinutes
            }))
          },
          triggers: {
            create: triggers.map(trigger => ({
              name: trigger.name,
              triggerType: trigger.triggerType,
              configuration: trigger.configuration || {},
              isActive: trigger.isActive !== false
            }))
          }
        },
        include: {
          steps: {
            orderBy: { order: 'asc' }
          },
          triggers: true,
          creator: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      return {
        success: true,
        message: 'Workflow template created successfully',
        template
      };
    } catch (error) {
      console.error('Error creating workflow template:', error);
      return {
        success: false,
        error: 'Failed to create workflow template',
        details: error.message
      };
    }
  }

  async getWorkflowTemplates(companyId, options = {}) {
    try {
      const { 
        category, 
        isActive, 
        createdBy,
        limit = 20, 
        offset = 0,
        search 
      } = options;

      const where = { companyId };
      
      if (category) where.category = category;
      if (isActive !== undefined) where.isActive = isActive;
      if (createdBy) where.createdBy = createdBy;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [templates, total] = await Promise.all([
        prisma.workflowTemplate.findMany({
          where,
          include: {
            steps: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                name: true,
                stepType: true,
                order: true,
                isRequired: true
              }
            },
            triggers: {
              select: {
                id: true,
                name: true,
                triggerType: true,
                isActive: true
              }
            },
            creator: {
              select: { id: true, name: true, email: true }
            },
            instances: {
              select: { id: true, status: true },
              take: 1,
              orderBy: { startedAt: 'desc' }
            }
          },
          orderBy: { updatedAt: 'desc' },
          take: limit,
          skip: offset
        }),
        prisma.workflowTemplate.count({ where })
      ]);

      return {
        success: true,
        templates,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      };
    } catch (error) {
      console.error('Error fetching workflow templates:', error);
      return {
        success: false,
        error: 'Failed to fetch workflow templates'
      };
    }
  }

  async updateWorkflowTemplate(templateId, updates, userId) {
    try {
      // Check if user has permission to update this template
      const template = await prisma.workflowTemplate.findFirst({
        where: {
          id: templateId,
          OR: [
            { createdBy: userId },
            { company: { users: { some: { id: userId, role: { in: ['ADMIN', 'SUPER_ADMIN'] } } } } }
          ]
        }
      });

      if (!template) {
        return {
          success: false,
          error: 'Template not found or insufficient permissions'
        };
      }

      const updatedTemplate = await prisma.workflowTemplate.update({
        where: { id: templateId },
        data: {
          name: updates.name,
          description: updates.description,
          category: updates.category,
          isActive: updates.isActive,
          metadata: updates.metadata,
          version: { increment: 1 }
        },
        include: {
          steps: { orderBy: { order: 'asc' } },
          triggers: true,
          creator: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      return {
        success: true,
        message: 'Workflow template updated successfully',
        template: updatedTemplate
      };
    } catch (error) {
      console.error('Error updating workflow template:', error);
      return {
        success: false,
        error: 'Failed to update workflow template'
      };
    }
  }

  // ========== WORKFLOW EXECUTION ==========

  async startWorkflowInstance(templateId, contextData = {}, triggeredBy = null) {
    try {
      const template = await prisma.workflowTemplate.findUnique({
        where: { id: templateId },
        include: {
          steps: {
            orderBy: { order: 'asc' },
            include: {
              dependencies: {
                include: { requiredStep: true }
              }
            }
          },
          triggers: true
        }
      });

      if (!template || !template.isActive) {
        return {
          success: false,
          error: 'Workflow template not found or inactive'
        };
      }

      const instance = await prisma.workflowInstance.create({
        data: {
          templateId,
          triggeredBy,
          contextData,
          status: 'RUNNING'
        },
        include: {
          template: {
            select: { name: true, category: true }
          }
        }
      });

      // Start executing the first step(s) that have no dependencies
      const firstSteps = template.steps.filter(step => 
        step.dependencies.length === 0
      );

      for (const step of firstSteps) {
        await this.executeWorkflowStep(instance.id, step.id);
      }

      return {
        success: true,
        message: 'Workflow instance started successfully',
        instance
      };
    } catch (error) {
      console.error('Error starting workflow instance:', error);
      return {
        success: false,
        error: 'Failed to start workflow instance'
      };
    }
  }

  async executeWorkflowStep(instanceId, stepId, assignedTo = null) {
    try {
      const step = await prisma.workflowStep.findUnique({
        where: { id: stepId },
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
        }
      });

      if (!step) {
        throw new Error('Workflow step not found');
      }

      // Check if all dependencies are satisfied
      for (const dependency of step.dependencies) {
        const requiredExecution = dependency.requiredStep.executions.find(
          exec => exec.instanceId === instanceId
        );
        
        if (!requiredExecution || requiredExecution.status !== 'COMPLETED') {
          throw new Error(`Dependency not satisfied: ${dependency.requiredStep.name}`);
        }
      }

      const execution = await prisma.workflowExecution.create({
        data: {
          instanceId,
          stepId,
          assignedTo,
          status: 'RUNNING'
        }
      });

      // Execute step based on its type
      await this.processStepExecution(execution.id, step);

      return {
        success: true,
        execution
      };
    } catch (error) {
      console.error('Error executing workflow step:', error);
      
      // Mark execution as failed
      await prisma.workflowExecution.updateMany({
        where: { instanceId, stepId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          errorMessage: error.message
        }
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  async processStepExecution(executionId, step) {
    try {
      const execution = await prisma.workflowExecution.findUnique({
        where: { id: executionId },
        include: {
          instance: {
            include: { template: true }
          }
        }
      });

      switch (step.stepType) {
        case 'TASK_CREATION':
          await this.handleTaskCreation(execution, step);
          break;
        case 'APPROVAL':
          await this.handleApprovalRequest(execution, step);
          break;
        case 'NOTIFICATION':
          await this.handleNotification(execution, step);
          break;
        case 'ASSIGNMENT':
          await this.handleAssignment(execution, step);
          break;
        case 'CONDITION':
          await this.handleCondition(execution, step);
          break;
        case 'DELAY':
          await this.handleDelay(execution, step);
          break;
        case 'EMAIL':
          await this.handleEmailStep(execution, step);
          break;
        case 'DATA_UPDATE':
          await this.handleDataUpdate(execution, step);
          break;
        default:
          throw new Error(`Unknown step type: ${step.stepType}`);
      }

      // Mark execution as completed if no errors
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

      // Check if workflow instance should be completed
      await this.checkWorkflowCompletion(execution.instanceId);

    } catch (error) {
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          errorMessage: error.message
        }
      });
      throw error;
    }
  }

  // ========== STEP HANDLERS ==========

  async handleTaskCreation(execution, step) {
    const config = step.configuration;
    const contextData = execution.instance.contextData || {};

    const taskData = {
      title: this.replaceVariables(config.title, contextData),
      description: this.replaceVariables(config.description || '', contextData),
      departmentId: config.departmentId || contextData.departmentId,
      priority: config.priority || 'MEDIUM',
      dueDate: config.dueDate ? new Date(config.dueDate) : null,
      assigneeId: config.assigneeId || execution.assignedTo,
      createdBy: execution.instance.triggeredBy
    };

    const task = await prisma.task.create({
      data: taskData
    });

    await prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        output: { taskId: task.id, taskTitle: task.title }
      }
    });

    return task;
  }

  async handleApprovalRequest(execution, step) {
    const config = step.configuration;
    const contextData = execution.instance.contextData || {};

    const approval = await prisma.approvalRequest.create({
      data: {
        executionId: execution.id,
        requestedBy: execution.instance.triggeredBy,
        approverIds: config.approverIds || [],
        title: this.replaceVariables(config.title, contextData),
        description: this.replaceVariables(config.description || '', contextData),
        priority: config.priority || 'MEDIUM',
        dueDate: config.dueDate ? new Date(config.dueDate) : null
      }
    });

    // Workflow execution will remain running until approval is completed
    await prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: 'RUNNING',
        output: { approvalId: approval.id }
      }
    });

    return approval;
  }

  async handleNotification(execution, step) {
    const config = step.configuration;
    const contextData = execution.instance.contextData || {};

    // Create notification for specified users
    const userIds = config.userIds || [execution.instance.triggeredBy];
    
    for (const userId of userIds) {
      await prisma.notification.create({
        data: {
          userId,
          title: this.replaceVariables(config.title, contextData),
          message: this.replaceVariables(config.message, contextData),
          type: config.type || 'WORKFLOW',
          isRead: false
        }
      });
    }

    return { notificationsSent: userIds.length };
  }

  async handleAssignment(execution, step) {
    const config = step.configuration;
    const contextData = execution.instance.contextData || {};

    // Auto-assign based on rules
    const assignee = await this.findBestAssignee(config, contextData);

    if (assignee && contextData.taskId) {
      await prisma.task.update({
        where: { id: contextData.taskId },
        data: { assigneeId: assignee.id }
      });
    }

    return { assigneeId: assignee?.id };
  }

  async handleCondition(execution, step) {
    const config = step.configuration;
    const contextData = execution.instance.contextData || {};

    // Evaluate condition
    const result = this.evaluateCondition(config.condition, contextData);

    if (!result) {
      throw new Error('Condition not met');
    }

    return { conditionResult: result };
  }

  async handleDelay(execution, step) {
    const config = step.configuration;
    const delayMinutes = config.delayMinutes || 0;

    if (delayMinutes > 0) {
      // Schedule the step to complete after delay
      setTimeout(async () => {
        await prisma.workflowExecution.update({
          where: { id: execution.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date()
          }
        });
        
        await this.checkWorkflowCompletion(execution.instanceId);
      }, delayMinutes * 60 * 1000);

      return { delayMinutes };
    }

    return { delayMinutes: 0 };
  }

  async handleEmailStep(execution, step) {
    const config = step.configuration;
    const contextData = execution.instance.contextData || {};

    // This would integrate with the email service
    const emailData = {
      to: config.to || contextData.email,
      subject: this.replaceVariables(config.subject, contextData),
      body: this.replaceVariables(config.body, contextData)
    };

    // TODO: Integrate with EmailService
    console.log('Email step executed:', emailData);

    return emailData;
  }

  async handleDataUpdate(execution, step) {
    const config = step.configuration;
    const contextData = execution.instance.contextData || {};

    // Update data based on configuration
    // This is a flexible handler that can update various models
    const updateResult = await this.performDataUpdate(config, contextData);

    return updateResult;
  }

  // ========== HELPER METHODS ==========

  replaceVariables(template, contextData) {
    if (!template || typeof template !== 'string') return template;
    
    return template.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return contextData[variable] || match;
    });
  }

  evaluateCondition(condition, contextData) {
    // Simple condition evaluation
    // In a real implementation, this would be more sophisticated
    try {
      return eval(this.replaceVariables(condition, contextData));
    } catch (error) {
      console.error('Error evaluating condition:', error);
      return false;
    }
  }

  async findBestAssignee(config, contextData) {
    // Find the best assignee based on assignment rules
    const rules = await prisma.assignmentRule.findMany({
      where: {
        companyId: contextData.companyId,
        isActive: true
      },
      orderBy: { priority: 'desc' }
    });

    for (const rule of rules) {
      const assignee = await this.applyAssignmentRule(rule, contextData);
      if (assignee) return assignee;
    }

    return null;
  }

  async applyAssignmentRule(rule, contextData) {
    const logic = rule.assignmentLogic;
    
    switch (logic.type) {
      case 'ROUND_ROBIN':
        return await this.roundRobinAssignment(logic, contextData);
      case 'SKILLS_BASED':
        return await this.skillsBasedAssignment(logic, contextData);
      case 'WORKLOAD_BASED':
        return await this.workloadBasedAssignment(logic, contextData);
      default:
        return null;
    }
  }

  async roundRobinAssignment(logic, contextData) {
    // Simple round-robin assignment implementation
    const users = await prisma.user.findMany({
      where: {
        companyId: contextData.companyId,
        departmentId: contextData.departmentId,
        role: 'USER'
      },
      orderBy: { id: 'asc' }
    });

    if (users.length === 0) return null;

    // Get last assigned user and pick next one
    const lastAssignedIndex = logic.lastAssignedIndex || 0;
    const nextIndex = (lastAssignedIndex + 1) % users.length;

    // Update the rule with new index
    await prisma.assignmentRule.update({
      where: { id: logic.ruleId },
      data: {
        assignmentLogic: {
          ...logic,
          lastAssignedIndex: nextIndex
        }
      }
    });

    return users[nextIndex];
  }

  async skillsBasedAssignment(logic, contextData) {
    // Skills-based assignment would require a skills system
    // For now, return a user from the same department
    return await prisma.user.findFirst({
      where: {
        companyId: contextData.companyId,
        departmentId: contextData.departmentId,
        role: 'USER'
      }
    });
  }

  async workloadBasedAssignment(logic, contextData) {
    // Find user with least number of active tasks
    const users = await prisma.user.findMany({
      where: {
        companyId: contextData.companyId,
        departmentId: contextData.departmentId,
        role: 'USER'
      },
      include: {
        assignedTasks: {
          where: { status: { not: 'DONE' } }
        }
      }
    });

    if (users.length === 0) return null;

    return users.reduce((least, user) => 
      user.assignedTasks.length < least.assignedTasks.length ? user : least
    );
  }

  async performDataUpdate(config, contextData) {
    // Flexible data update based on configuration
    const { model, where, data } = config;

    switch (model) {
      case 'task':
        return await prisma.task.updateMany({
          where: this.buildWhereClause(where, contextData),
          data: this.buildUpdateData(data, contextData)
        });
      case 'user':
        return await prisma.user.updateMany({
          where: this.buildWhereClause(where, contextData),
          data: this.buildUpdateData(data, contextData)
        });
      default:
        throw new Error(`Unsupported model for data update: ${model}`);
    }
  }

  buildWhereClause(where, contextData) {
    const result = {};
    for (const [key, value] of Object.entries(where)) {
      result[key] = this.replaceVariables(value, contextData);
    }
    return result;
  }

  buildUpdateData(data, contextData) {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = this.replaceVariables(value, contextData);
    }
    return result;
  }

  async checkWorkflowCompletion(instanceId) {
    const instance = await prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: {
        template: {
          include: { steps: true }
        },
        executions: true
      }
    });

    if (!instance) return;

    const totalSteps = instance.template.steps.length;
    const completedSteps = instance.executions.filter(exec => 
      exec.status === 'COMPLETED'
    ).length;

    if (completedSteps === totalSteps) {
      await prisma.workflowInstance.update({
        where: { id: instanceId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });
    }
  }

  // ========== WORKFLOW MONITORING ==========

  async getWorkflowInstances(companyId, options = {}) {
    try {
      const { 
        status, 
        templateId,
        limit = 20, 
        offset = 0 
      } = options;

      const where = {
        template: { companyId }
      };
      
      if (status) where.status = status;
      if (templateId) where.templateId = templateId;

      const [instances, total] = await Promise.all([
        prisma.workflowInstance.findMany({
          where,
          include: {
            template: {
              select: { name: true, category: true }
            },
            initiator: {
              select: { name: true, email: true }
            },
            executions: {
              include: {
                step: {
                  select: { name: true, stepType: true }
                }
              }
            }
          },
          orderBy: { startedAt: 'desc' },
          take: limit,
          skip: offset
        }),
        prisma.workflowInstance.count({ where })
      ]);

      return {
        success: true,
        instances,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      };
    } catch (error) {
      console.error('Error fetching workflow instances:', error);
      return {
        success: false,
        error: 'Failed to fetch workflow instances'
      };
    }
  }
}

module.exports = WorkflowService;