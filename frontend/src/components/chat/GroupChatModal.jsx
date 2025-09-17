import React, { useState } from 'react';
import { useChatUsers } from '../../context/ChatUsersContext';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';

const GroupChatModal = ({ isOpen, onClose, onGroupCreated }) => {
  const { user } = useAuth();
  const users = useChatUsers();
  const [step, setStep] = useState(1); // 1: Create Group, 2: Add Members
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const availableUsers = users.filter(u => u.id !== user.id);

  const handleClose = () => {
    setStep(1);
    setGroupName('');
    setGroupDescription('');
    setSelectedMembers([]);
    setError('');
    setLoading(false);
    onClose();
  };

  const toggleMember = (userId) => {
    setSelectedMembers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleNext = () => {
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleCreateGroup = async () => {
    if (selectedMembers.length === 0) {
      setError('Please select at least one member');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
      const response = await fetch(`${apiUrl}/groups/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDescription.trim(),
          memberIds: selectedMembers
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create group');
      }

      const data = await response.json();
      onGroupCreated(data.group);
      handleClose();
    } catch (error) {
      console.error('Error creating group:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {step === 1 ? 'Create Group Chat' : 'Add Members'}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {step === 1 ? (
            /* Step 1: Group Details */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Group Name *
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="What's this group about?"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                  {error}
                </div>
              )}
            </div>
          ) : (
            /* Step 2: Select Members */
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                Select people to add to "{groupName}"
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableUsers.map(member => (
                  <label
                    key={member.id}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(member.id)}
                      onChange={() => toggleMember(member.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{member.name}</div>
                        <div className="text-sm text-gray-500">{member.email}</div>
                      </div>
                    </div>
                  </label>
                ))}

                {availableUsers.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p>No team members available</p>
                  </div>
                )}
              </div>

              {selectedMembers.length > 0 && (
                <div className="text-sm text-gray-600">
                  {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
                </div>
              )}

              {error && (
                <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="flex space-x-2">
            {step === 2 && (
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                disabled={loading}
              >
                Back
              </Button>
            )}
          </div>

          <div className="flex space-x-2">
            <Button
              onClick={handleClose}
              variant="outline"
              disabled={loading}
            >
              Cancel
            </Button>
            
            {step === 1 ? (
              <Button
                onClick={handleNext}
                disabled={!groupName.trim() || loading}
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleCreateGroup}
                disabled={selectedMembers.length === 0 || loading}
                loading={loading}
              >
                Create Group
              </Button>
            )}
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 pb-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
            <div className={`flex-1 h-1 ${step >= 2 ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
            <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupChatModal;