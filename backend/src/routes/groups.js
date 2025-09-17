const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const prisma = require('../utils/prisma');

const router = express.Router();

// Helper to handle validation errors
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// POST /api/groups/create - create a new message group
router.post(
  '/create',
  authenticateToken,
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Group name is required'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('memberIds').isArray().withMessage('Member IDs must be an array'),
  body('memberIds.*').isString().withMessage('Each member ID must be a string'),
  handleValidation,
  async (req, res) => {
    try {
      const { name, description, memberIds } = req.body;
      const creator = req.user;

      // Validate member IDs exist and are in same company
      const members = await prisma.user.findMany({
        where: {
          id: { in: memberIds },
          companyId: creator.companyId
        },
        select: { id: true, name: true }
      });

      if (members.length !== memberIds.length) {
        return res.status(400).json({ error: 'Some member IDs are invalid' });
      }

      // Create the group
      const group = await prisma.messageGroup.create({
        data: {
          name,
          description: description || '',
          companyId: creator.companyId,
          createdById: creator.id
        }
      });

      // Add all members (including creator)
      const allMemberIds = [...new Set([creator.id, ...memberIds])];
      const membershipData = allMemberIds.map(userId => ({
        groupId: group.id,
        userId,
        role: userId === creator.id ? 'ADMIN' : 'MEMBER'
      }));

      await prisma.groupMembership.createMany({
        data: membershipData
      });

      // Get complete group with members
      const completeGroup = await prisma.messageGroup.findUnique({
        where: { id: group.id },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true } }
            }
          },
          createdBy: { select: { id: true, name: true } }
        }
      });

      // Emit group creation to all members
      try {
        const io = req.app.get('io');
        if (io) {
          allMemberIds.forEach(memberId => {
            io.to(`user:${memberId}`).emit('group:created', { group: completeGroup });
          });
        }
      } catch (emitErr) {
        console.error('Socket emit failed for group creation', emitErr);
      }

      return res.status(201).json({ group: completeGroup });
    } catch (error) {
      console.error('Error creating group:', error);
      return res.status(500).json({ error: 'Failed to create group' });
    }
  }
);

// GET /api/groups - get user's groups
router.get(
  '/',
  authenticateToken,
  async (req, res) => {
    try {
      const me = req.user;

      const groups = await prisma.messageGroup.findMany({
        where: {
          companyId: me.companyId,
          members: {
            some: { userId: me.id }
          }
        },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true } }
            }
          },
          createdBy: { select: { id: true, name: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: { select: { id: true, name: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.json({ groups });
    } catch (error) {
      console.error('Error fetching groups:', error);
      return res.status(500).json({ error: 'Failed to fetch groups' });
    }
  }
);

// POST /api/groups/:id/members - add members to group
router.post(
  '/:id/members',
  authenticateToken,
  param('id').notEmpty(),
  body('memberIds').isArray().withMessage('Member IDs must be an array'),
  body('memberIds.*').isString().withMessage('Each member ID must be a string'),
  handleValidation,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { memberIds } = req.body;
      const me = req.user;

      // Check if user is admin of the group
      const membership = await prisma.groupMembership.findFirst({
        where: {
          groupId: id,
          userId: me.id,
          role: 'ADMIN'
        },
        include: {
          group: { select: { companyId: true } }
        }
      });

      if (!membership || membership.group.companyId !== me.companyId) {
        return res.status(403).json({ error: 'Not authorized to add members to this group' });
      }

      // Validate new member IDs
      const newMembers = await prisma.user.findMany({
        where: {
          id: { in: memberIds },
          companyId: me.companyId
        },
        select: { id: true, name: true }
      });

      if (newMembers.length !== memberIds.length) {
        return res.status(400).json({ error: 'Some member IDs are invalid' });
      }

      // Check which members are not already in the group
      const existingMemberIds = await prisma.groupMembership.findMany({
        where: {
          groupId: id,
          userId: { in: memberIds }
        },
        select: { userId: true }
      });

      const existingIds = existingMemberIds.map(m => m.userId);
      const newMemberIds = memberIds.filter(id => !existingIds.includes(id));

      if (newMemberIds.length === 0) {
        return res.status(400).json({ error: 'All specified users are already members' });
      }

      // Add new members
      const membershipData = newMemberIds.map(userId => ({
        groupId: id,
        userId,
        role: 'MEMBER'
      }));

      await prisma.groupMembership.createMany({
        data: membershipData
      });

      // Get updated group
      const updatedGroup = await prisma.messageGroup.findUnique({
        where: { id },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true } }
            }
          }
        }
      });

      // Emit member addition to all group members
      try {
        const io = req.app.get('io');
        if (io) {
          const allMemberIds = updatedGroup.members.map(m => m.userId);
          allMemberIds.forEach(memberId => {
            io.to(`user:${memberId}`).emit('group:membersAdded', {
              groupId: id,
              newMembers: newMembers.filter(m => newMemberIds.includes(m.id)),
              group: updatedGroup
            });
          });
        }
      } catch (emitErr) {
        console.error('Socket emit failed for member addition', emitErr);
      }

      return res.json({ group: updatedGroup });
    } catch (error) {
      console.error('Error adding group members:', error);
      return res.status(500).json({ error: 'Failed to add members' });
    }
  }
);

// DELETE /api/groups/:id/members/:userId - remove member from group
router.delete(
  '/:id/members/:userId',
  authenticateToken,
  param('id').notEmpty(),
  param('userId').notEmpty(),
  handleValidation,
  async (req, res) => {
    try {
      const { id, userId } = req.params;
      const me = req.user;

      // Check if user is admin or removing themselves
      const myMembership = await prisma.groupMembership.findFirst({
        where: {
          groupId: id,
          userId: me.id
        },
        include: {
          group: { select: { companyId: true } }
        }
      });

      if (!myMembership || myMembership.group.companyId !== me.companyId) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      if (myMembership.role !== 'ADMIN' && userId !== me.id) {
        return res.status(403).json({ error: 'Only admins can remove other members' });
      }

      // Check if target user is in the group
      const targetMembership = await prisma.groupMembership.findFirst({
        where: {
          groupId: id,
          userId
        }
      });

      if (!targetMembership) {
        return res.status(404).json({ error: 'User is not a member of this group' });
      }

      // Remove membership
      await prisma.groupMembership.delete({
        where: { id: targetMembership.id }
      });

      // Get remaining members
      const remainingMembers = await prisma.groupMembership.findMany({
        where: { groupId: id },
        include: {
          user: { select: { id: true, name: true } }
        }
      });

      // Emit member removal
      try {
        const io = req.app.get('io');
        if (io) {
          // Notify remaining members
          remainingMembers.forEach(member => {
            io.to(`user:${member.userId}`).emit('group:memberRemoved', {
              groupId: id,
              removedUserId: userId
            });
          });

          // Notify removed user
          io.to(`user:${userId}`).emit('group:removedFromGroup', {
            groupId: id
          });
        }
      } catch (emitErr) {
        console.error('Socket emit failed for member removal', emitErr);
      }

      return res.json({ success: true });
    } catch (error) {
      console.error('Error removing group member:', error);
      return res.status(500).json({ error: 'Failed to remove member' });
    }
  }
);

// PATCH /api/groups/:id - update group details
router.patch(
  '/:id',
  authenticateToken,
  param('id').notEmpty(),
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  handleValidation,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      const me = req.user;

      // Check if user is admin of the group
      const membership = await prisma.groupMembership.findFirst({
        where: {
          groupId: id,
          userId: me.id,
          role: 'ADMIN'
        },
        include: {
          group: { select: { companyId: true } }
        }
      });

      if (!membership || membership.group.companyId !== me.companyId) {
        return res.status(403).json({ error: 'Not authorized to update this group' });
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const updatedGroup = await prisma.messageGroup.update({
        where: { id },
        data: updateData,
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true } }
            }
          },
          createdBy: { select: { id: true, name: true } }
        }
      });

      // Emit group update to all members
      try {
        const io = req.app.get('io');
        if (io) {
          updatedGroup.members.forEach(member => {
            io.to(`user:${member.userId}`).emit('group:updated', {
              group: updatedGroup
            });
          });
        }
      } catch (emitErr) {
        console.error('Socket emit failed for group update', emitErr);
      }

      return res.json({ group: updatedGroup });
    } catch (error) {
      console.error('Error updating group:', error);
      return res.status(500).json({ error: 'Failed to update group' });
    }
  }
);

module.exports = router;