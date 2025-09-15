import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { departments as departmentsAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const DepartmentHeadManagement = () => {
  const { id: departmentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [department, setDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRemovalForm, setShowRemovalForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [removalReason, setRemovalReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (departmentId) {
      fetchDepartmentDetails();
    }
  }, [departmentId]);

  const fetchDepartmentDetails = async () => {
    try {
      const response = await departmentsAPI.getDepartment(departmentId);
      setDepartment(response.data.department);
    } catch (error) {
      console.error('Error fetching department:', error);
      toast.error('Failed to load department details');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRemoval = async (userId, userName) => {
    setSelectedUser({ id: userId, name: userName });
    setShowRemovalForm(true);
  };

  const handleSubmitRemovalRequest = async (e) => {
    e.preventDefault();
    if (!removalReason.trim() || removalReason.trim().length < 10) {
      toast.error('Please provide a detailed reason (at least 10 characters)');
      return;
    }

    setSubmitting(true);
    try {
      await departmentsAPI.requestUserRemoval(departmentId, selectedUser.id, {
        reason: removalReason.trim()
      });
      
      toast.success(`Removal request submitted for ${selectedUser.name}`);
      setShowRemovalForm(false);
      setSelectedUser(null);
      setRemovalReason('');
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to submit removal request';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDirectRemoval = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to remove "${userName}" from this department? This action cannot be undone.`)) {
      return;
    }

    try {
      await departmentsAPI.removeUser(departmentId, userId);
      toast.success(`${userName} has been removed from the department`);
      fetchDepartmentDetails(); // Refresh data
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to remove user';
      toast.error(errorMessage);
    }
  };

  const isHead = user?.role === 'HEAD_OF_DEPARTMENT';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!department || (!isHead && !isSuperAdmin)) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
        <p className="text-gray-600">You don't have permission to manage this department.</p>
        <Button onClick={() => navigate(`/department/${departmentId}`)} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => navigate(`/department/${departmentId}`)}
              variant="secondary"
              className="text-sm"
            >
              ← Back to Dashboard
            </Button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">
            {isSuperAdmin ? 'Department Management' : 'Team Management'}
          </h1>
          <p className="text-gray-600">
            {department.name} • Manage department members
          </p>
        </div>
      </div>

      {/* Removal Request Form */}
      {showRemovalForm && (
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold">Request Member Removal</h3>
          </Card.Header>
          <Card.Content>
            <form onSubmit={handleSubmitRemovalRequest} className="space-y-4">
              <div>
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Member to remove:</strong> {selectedUser?.name}
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  As a department head, removal of members requires super admin approval.
                </p>
              </div>
              
              <div>
                <label htmlFor="removalReason" className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Removal *
                </label>
                <textarea
                  id="removalReason"
                  value={removalReason}
                  onChange={(e) => setRemovalReason(e.target.value)}
                  placeholder="Please provide a detailed reason for removing this member (minimum 10 characters)..."
                  className="w-full min-h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  {removalReason.length}/500 characters
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={submitting || removalReason.trim().length < 10}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowRemovalForm(false);
                    setSelectedUser(null);
                    setRemovalReason('');
                  }}
                  variant="secondary"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card.Content>
        </Card>
      )}

      {/* Department Members */}
      <Card>
        <Card.Header>
          <h3 className="text-lg font-semibold">Department Members ({department.users?.length || 0})</h3>
        </Card.Header>
        <Card.Content>
          {department.users && department.users.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {department.users.map((member) => (
                <div key={member.id} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{member.name}</h4>
                      <p className="text-sm text-gray-600">{member.email}</p>
                      <p className="text-xs text-blue-600 mt-1">
                        {member.departmentRole || 'No role specified'}
                      </p>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium mt-2 ${
                        member.role === 'HEAD_OF_DEPARTMENT' 
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {member.role === 'HEAD_OF_DEPARTMENT' ? '👑 Department Head' : '👤 Member'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 ml-2">
                      {/* Super admin can remove anyone directly */}
                      {isSuperAdmin && member.id !== user.id && (
                        <Button
                          onClick={() => handleDirectRemoval(member.id, member.name)}
                          variant="danger"
                          className="text-xs px-2 py-1"
                          title="Remove member (Super Admin)"
                        >
                          Remove
                        </Button>
                      )}
                      
                      {/* Head of department can only request removal for non-heads */}
                      {isHead && member.id !== user.id && member.role !== 'HEAD_OF_DEPARTMENT' && (
                        <Button
                          onClick={() => handleRequestRemoval(member.id, member.name)}
                          className="text-xs px-2 py-1 bg-orange-600 hover:bg-orange-700"
                          title="Request removal (requires approval)"
                        >
                          Request Removal
                        </Button>
                      )}
                      
                      {/* Show info for heads who can't be removed */}
                      {isHead && member.role === 'HEAD_OF_DEPARTMENT' && member.id !== user.id && (
                        <span className="text-xs text-gray-500 italic">
                          Contact Super Admin
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-3 text-xs text-gray-500">
                    <p>Joined: {new Date(member.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No members in this department yet</p>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Help Section */}
      <Card>
        <Card.Header>
          <h3 className="text-lg font-semibold">Member Management Guide</h3>
        </Card.Header>
        <Card.Content>
          <div className="space-y-4 text-sm text-gray-600">
            {isSuperAdmin ? (
              <div>
                <h4 className="font-medium text-gray-900">As Super Admin, you can:</h4>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>Remove any member directly from any department</li>
                  <li>Approve or reject removal requests from department heads</li>
                  <li>Assign and remove department heads</li>
                  <li>Delete entire departments if they have no members</li>
                </ul>
              </div>
            ) : (
              <div>
                <h4 className="font-medium text-gray-900">As Department Head, you can:</h4>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>Request removal of team members (requires super admin approval)</li>
                  <li>View all department members and their roles</li>
                  <li>Contact super admin for department head changes</li>
                </ul>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-blue-800 text-sm">
                    <strong>Note:</strong> Removal requests must include a detailed reason and will be reviewed by the super admin before approval.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};

export default DepartmentHeadManagement;