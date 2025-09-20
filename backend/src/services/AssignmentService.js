// Assignment Automation Service for CollabNotes Nigeria
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class AssignmentService {
  // ========== ASSIGNMENT RULE MANAGEMENT ==========

  async createAssignmentRule(data) {
    try {
      const {
        companyId,
        name,
        description,
        conditions,
        assignmentLogic,
        priority = 100,
        createdBy
      } = data;

      const rule = await prisma.assignmentRule.create({
        data: {
          companyId,
          name,
          description,
          conditions,
          assignmentLogic,
          priority,
          createdBy
        },
        include: {
          creator: {
            select: { id: true, name: true, email: true }
          },
          company: {
            select: { id: true, name: true }
          }
        }
      });

      return {
        success: true,
        message: 'Assignment rule created successfully',
        rule
      };
    } catch (error) {
      console.error('Error creating assignment rule:', error);
      return {
        success: false,
        error: 'Failed to create assignment rule',
        details: error.message
      };
    }
  }

  async getAssignmentRules(companyId, options = {}) {
    try {
      const {
        isActive,
        limit = 20,
        offset = 0
      } = options;

      const where = { companyId };
      if (isActive !== undefined) where.isActive = isActive;

      const [rules, total] = await Promise.all([
        prisma.assignmentRule.findMany({
          where,
          include: {
            creator: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'desc' }
          ],
          take: limit,
          skip: offset
        }),
        prisma.assignmentRule.count({ where })
      ]);

      return {
        success: true,
        rules,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      };
    } catch (error) {
      console.error('Error fetching assignment rules:', error);
      return {
        success: false,
        error: 'Failed to fetch assignment rules'
      };
    }
  }

  async updateAssignmentRule(ruleId, updates, userId) {
    try {
      // Check if user has permission to update this rule
      const rule = await prisma.assignmentRule.findFirst({
        where: {
          id: ruleId,
          OR: [
            { createdBy: userId },
            { company: { users: { some: { id: userId, role: { in: ['ADMIN', 'SUPER_ADMIN'] } } } } }
          ]
        }
      });

      if (!rule) {
        return {
          success: false,
          error: 'Assignment rule not found or insufficient permissions'
        };
      }

      const updatedRule = await prisma.assignmentRule.update({
        where: { id: ruleId },
        data: {
          name: updates.name,
          description: updates.description,
          conditions: updates.conditions,
          assignmentLogic: updates.assignmentLogic,
          priority: updates.priority,
          isActive: updates.isActive
        },
        include: {
          creator: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      return {
        success: true,
        message: 'Assignment rule updated successfully',
        rule: updatedRule
      };
    } catch (error) {
      console.error('Error updating assignment rule:', error);
      return {
        success: false,
        error: 'Failed to update assignment rule'
      };
    }
  }

  async deleteAssignmentRule(ruleId, userId) {
    try {
      // Check if user has permission to delete this rule
      const rule = await prisma.assignmentRule.findFirst({
        where: {
          id: ruleId,
          OR: [
            { createdBy: userId },
            { company: { users: { some: { id: userId, role: { in: ['ADMIN', 'SUPER_ADMIN'] } } } } }
          ]
        }
      });

      if (!rule) {
        return {
          success: false,
          error: 'Assignment rule not found or insufficient permissions'
        };
      }

      await prisma.assignmentRule.delete({
        where: { id: ruleId }
      });

      return {
        success: true,
        message: 'Assignment rule deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting assignment rule:', error);
      return {
        success: false,
        error: 'Failed to delete assignment rule'
      };
    }
  }

  // ========== AUTO-ASSIGNMENT LOGIC ==========

  async autoAssignTask(taskData) {
    try {
      const {
        companyId,
        departmentId,
        title,
        description,
        priority,
        category,
        skills = [],
        createdBy
      } = taskData;

      // Find applicable assignment rules
      const rules = await prisma.assignmentRule.findMany({
        where: {
          companyId,
          isActive: true
        },
        orderBy: { priority: 'desc' }
      });

      let bestAssignee = null;

      // Apply assignment rules in priority order
      for (const rule of rules) {
        if (this.evaluateConditions(rule.conditions, taskData)) {
          bestAssignee = await this.applyAssignmentLogic(rule, taskData);
          if (bestAssignee) break;
        }
      }

      // If no rule applies, use default assignment
      if (!bestAssignee) {
        bestAssignee = await this.defaultAssignment(taskData);
      }

      return {
        success: true,
        assignee: bestAssignee,
        assignmentMethod: bestAssignee ? 'auto-assigned' : 'unassigned'
      };
    } catch (error) {
      console.error('Error in auto-assignment:', error);
      return {
        success: false,
        error: 'Failed to auto-assign task'
      };
    }
  }

  evaluateConditions(conditions, taskData) {
    try {
      // Simple condition evaluation
      for (const [key, condition] of Object.entries(conditions)) {
        if (!this.evaluateCondition(key, condition, taskData)) {
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('Error evaluating conditions:', error);
      return false;
    }
  }

  evaluateCondition(key, condition, taskData) {
    const value = taskData[key];
    
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return typeof value === 'string' && value.toLowerCase().includes(condition.value.toLowerCase());
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'greater_than':
        return Number(value) > Number(condition.value);
      case 'less_than':
        return Number(value) < Number(condition.value);
      case 'not_empty':
        return value && value.length > 0;
      default:
        return false;
    }
  }

  async applyAssignmentLogic(rule, taskData) {
    const logic = rule.assignmentLogic;

    switch (logic.type) {
      case 'ROUND_ROBIN':
        return await this.roundRobinAssignment(rule, taskData);
      case 'SKILLS_BASED':
        return await this.skillsBasedAssignment(rule, taskData);
      case 'WORKLOAD_BASED':
        return await this.workloadBasedAssignment(rule, taskData);
      case 'AVAILABILITY_BASED':
        return await this.availabilityBasedAssignment(rule, taskData);
      case 'EXPERIENCE_BASED':
        return await this.experienceBasedAssignment(rule, taskData);
      case 'RANDOM':
        return await this.randomAssignment(rule, taskData);
      case 'CUSTOM':
        return await this.customAssignment(rule, taskData);
      default:
        return null;
    }
  }

  async roundRobinAssignment(rule, taskData) {
    try {
      const logic = rule.assignmentLogic;
      
      // Get eligible users
      const users = await this.getEligibleUsers(rule, taskData);
      if (users.length === 0) return null;

      // Get the last assigned index from the rule's metadata
      let lastIndex = logic.lastAssignedIndex || 0;
      
      // Calculate next index
      const nextIndex = (lastIndex + 1) % users.length;
      
      // Update the rule with the new index
      await prisma.assignmentRule.update({
        where: { id: rule.id },
        data: {
          assignmentLogic: {
            ...logic,
            lastAssignedIndex: nextIndex
          }
        }
      });

      return users[nextIndex];
    } catch (error) {
      console.error('Error in round-robin assignment:', error);
      return null;
    }
  }

  async skillsBasedAssignment(rule, taskData) {
    try {
      const requiredSkills = taskData.skills || rule.assignmentLogic.requiredSkills || [];
      
      if (requiredSkills.length === 0) {
        return await this.defaultAssignment(taskData);
      }

      // For now, we'll simulate skills matching
      // In a full implementation, you'd have a skills table
      const users = await this.getEligibleUsers(rule, taskData);
      
      // Simulate skill matching by checking user's departmentRole
      const skilledUsers = users.filter(user => {
        const userRole = user.departmentRole?.toLowerCase() || '';
        return requiredSkills.some(skill => 
          userRole.includes(skill.toLowerCase())
        );
      });

      if (skilledUsers.length > 0) {
        // Return user with the least current workload among skilled users
        return await this.selectByWorkload(skilledUsers);
      }

      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Error in skills-based assignment:', error);
      return null;
    }
  }

  async workloadBasedAssignment(rule, taskData) {
    try {
      const users = await this.getEligibleUsers(rule, taskData);
      return await this.selectByWorkload(users);
    } catch (error) {
      console.error('Error in workload-based assignment:', error);
      return null;
    }
  }

  async availabilityBasedAssignment(rule, taskData) {
    try {
      const users = await this.getEligibleUsers(rule, taskData);
      
      // Check user availability (last seen, active status, etc.)
      const recentlyActiveUsers = users.filter(user => {
        if (!user.lastSeen) return false;
        
        const hoursSinceLastSeen = (Date.now() - new Date(user.lastSeen).getTime()) / (1000 * 60 * 60);
        return hoursSinceLastSeen < 24; // Active within last 24 hours
      });

      if (recentlyActiveUsers.length > 0) {
        return await this.selectByWorkload(recentlyActiveUsers);
      }

      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Error in availability-based assignment:', error);
      return null;
    }
  }

  async experienceBasedAssignment(rule, taskData) {
    try {
      const users = await this.getEligibleUsers(rule, taskData);
      
      // Get users with completed task history
      const usersWithExperience = await Promise.all(
        users.map(async (user) => {
          const completedTasks = await prisma.task.count({
            where: {
              assigneeId: user.id,
              status: 'DONE'
            }
          });
          
          return {
            ...user,
            experienceScore: completedTasks
          };
        })
      );

      // Sort by experience and return the most experienced available user
      const sortedUsers = usersWithExperience.sort((a, b) => b.experienceScore - a.experienceScore);
      
      return sortedUsers.length > 0 ? sortedUsers[0] : null;
    } catch (error) {
      console.error('Error in experience-based assignment:', error);
      return null;
    }
  }

  async randomAssignment(rule, taskData) {
    try {
      const users = await this.getEligibleUsers(rule, taskData);
      
      if (users.length === 0) return null;
      
      const randomIndex = Math.floor(Math.random() * users.length);
      return users[randomIndex];
    } catch (error) {
      console.error('Error in random assignment:', error);
      return null;
    }
  }

  async customAssignment(rule, taskData) {
    try {
      // Custom assignment logic based on rule configuration
      const logic = rule.assignmentLogic;
      
      if (logic.customFunction) {
        // In a real implementation, you might eval custom functions
        // For security, this should be sandboxed
        return await this.executeCustomFunction(logic.customFunction, rule, taskData);
      }
      
      return await this.defaultAssignment(taskData);
    } catch (error) {
      console.error('Error in custom assignment:', error);
      return null;
    }
  }

  async executeCustomFunction(functionCode, rule, taskData) {
    // For security, this is a placeholder
    // In production, use a sandboxed environment
    try {
      console.log('Custom assignment function would execute here:', functionCode);
      return await this.defaultAssignment(taskData);
    } catch (error) {
      console.error('Error executing custom function:', error);
      return null;
    }
  }

  // ========== HELPER METHODS ==========

  async getEligibleUsers(rule, taskData) {
    try {
      const { companyId, departmentId } = taskData;
      const logic = rule.assignmentLogic;

      let where = {
        companyId,
        role: { not: 'SUPER_ADMIN' } // Exclude platform admins
      };

      // Add department filter if specified
      if (departmentId && !logic.crossDepartment) {
        where.departmentId = departmentId;
      }

      // Add role filter if specified
      if (logic.allowedRoles && logic.allowedRoles.length > 0) {
        where.role = { in: logic.allowedRoles };
      }

      // Add exclude filter
      if (logic.excludeUsers && logic.excludeUsers.length > 0) {
        where.id = { notIn: logic.excludeUsers };
      }

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          departmentRole: true,
          lastSeen: true,
          assignedTasks: {
            where: { status: { not: 'DONE' } },
            select: { id: true }
          }
        }
      });

      return users;
    } catch (error) {
      console.error('Error getting eligible users:', error);
      return [];
    }
  }

  async selectByWorkload(users) {
    if (users.length === 0) return null;

    // Sort by current workload (number of active tasks)
    const sortedUsers = users.sort((a, b) => 
      a.assignedTasks.length - b.assignedTasks.length
    );

    return sortedUsers[0];
  }

  async defaultAssignment(taskData) {
    try {
      const { companyId, departmentId } = taskData;

      // Simple default: assign to least busy user in department
      const users = await prisma.user.findMany({
        where: {
          companyId,
          departmentId,
          role: 'USER'
        },
        include: {
          assignedTasks: {
            where: { status: { not: 'DONE' } }
          }
        }
      });

      return this.selectByWorkload(users);
    } catch (error) {
      console.error('Error in default assignment:', error);
      return null;
    }
  }

  // ========== ASSIGNMENT ANALYTICS ==========

  async getAssignmentMetrics(companyId, options = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        departmentId
      } = options;

      let taskWhere = {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      };

      if (departmentId) {
        taskWhere.departmentId = departmentId;
      } else {
        taskWhere.creator = {
          companyId
        };
      }

      const [
        totalTasks,
        assignedTasks,
        unassignedTasks,
        autoAssignedTasks,
        manualAssignedTasks,
        tasksByDepartment,
        averageAssignmentTime
      ] = await Promise.all([
        // Total tasks created
        prisma.task.count({ where: taskWhere }),
        
        // Assigned tasks
        prisma.task.count({
          where: { ...taskWhere, assigneeId: { not: null } }
        }),
        
        // Unassigned tasks
        prisma.task.count({
          where: { ...taskWhere, assigneeId: null }
        }),
        
        // Auto-assigned tasks (would need a field to track this)
        prisma.task.count({
          where: { ...taskWhere, assigneeId: { not: null } }
        }) / 2, // Placeholder
        
        // Manual assigned tasks
        prisma.task.count({
          where: { ...taskWhere, assigneeId: { not: null } }
        }) / 2, // Placeholder
        
        // Tasks by department
        prisma.task.groupBy({
          by: ['departmentId'],
          where: taskWhere,
          _count: true
        }),
        
        // Average assignment time (placeholder)
        0
      ]);

      return {
        success: true,
        metrics: {
          totalTasks,
          assignedTasks,
          unassignedTasks,
          autoAssignedTasks: Math.floor(autoAssignedTasks),
          manualAssignedTasks: Math.floor(manualAssignedTasks),
          assignmentRate: totalTasks > 0 ? (assignedTasks / totalTasks * 100).toFixed(1) : 0,
          tasksByDepartment: tasksByDepartment.reduce((acc, item) => {
            acc[item.departmentId] = item._count;
            return acc;
          }, {}),
          averageAssignmentTimeMinutes: averageAssignmentTime
        }
      };
    } catch (error) {
      console.error('Error fetching assignment metrics:', error);
      return {
        success: false,
        error: 'Failed to fetch assignment metrics'
      };
    }
  }

  // ========== ASSIGNMENT RULE TEMPLATES ==========

  getAssignmentRuleTemplates() {
    return {
      success: true,
      templates: [
        {
          name: 'Nigerian Business Hours Round Robin',
          description: 'Assigns tasks during Lagos business hours using round-robin',
          category: 'time_based',
          conditions: {
            createdAt: {
              operator: 'business_hours',
              value: 'Africa/Lagos'
            }
          },
          assignmentLogic: {
            type: 'ROUND_ROBIN',
            allowedRoles: ['USER', 'DEPT_HEAD'],
            businessHours: {
              timezone: 'Africa/Lagos',
              start: '08:00',
              end: '17:00',
              workdays: [1, 2, 3, 4, 5] // Monday to Friday
            }
          }
        },
        {
          name: 'Urgent Task Priority Assignment',
          description: 'Assigns urgent tasks to most experienced available users',
          category: 'priority_based',
          conditions: {
            priority: {
              operator: 'in',
              value: ['HIGH', 'URGENT']
            }
          },
          assignmentLogic: {
            type: 'EXPERIENCE_BASED',
            allowedRoles: ['USER', 'DEPT_HEAD'],
            crossDepartment: true
          }
        },
        {
          name: 'Skills-Based Developer Assignment',
          description: 'Assigns development tasks based on technical skills',
          category: 'skills_based',
          conditions: {
            category: {
              operator: 'contains',
              value: 'development'
            }
          },
          assignmentLogic: {
            type: 'SKILLS_BASED',
            requiredSkills: ['javascript', 'react', 'node.js', 'python'],
            allowedRoles: ['USER']
          }
        },
        {
          name: 'Workload Balancing',
          description: 'Distributes tasks evenly across team members',
          category: 'workload_based',
          conditions: {},
          assignmentLogic: {
            type: 'WORKLOAD_BASED',
            allowedRoles: ['USER'],
            maxTasksPerUser: 5
          }
        },
        {
          name: 'Department Head Approval Tasks',
          description: 'Assigns approval tasks to department heads',
          category: 'approval_based',
          conditions: {
            title: {
              operator: 'contains',
              value: 'approval'
            }
          },
          assignmentLogic: {
            type: 'RANDOM',
            allowedRoles: ['DEPT_HEAD', 'ADMIN']
          }
        }
      ]
    };
  }

  async createRuleFromTemplate(templateName, companyId, createdBy, customizations = {}) {
    try {
      const templates = this.getAssignmentRuleTemplates();
      const template = templates.templates.find(t => t.name === templateName);
      
      if (!template) {
        return {
          success: false,
          error: 'Template not found'
        };
      }

      const ruleData = {
        companyId,
        createdBy,
        name: customizations.name || template.name,
        description: customizations.description || template.description,
        conditions: { ...template.conditions, ...customizations.conditions },
        assignmentLogic: { ...template.assignmentLogic, ...customizations.assignmentLogic },
        priority: customizations.priority || 100
      };

      return await this.createAssignmentRule(ruleData);
    } catch (error) {
      console.error('Error creating rule from template:', error);
      return {
        success: false,
        error: 'Failed to create rule from template'
      };
    }
  }
}

module.exports = AssignmentService;