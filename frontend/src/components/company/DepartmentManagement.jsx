import { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { ConfirmModal } from '../ui/Modal';
import { departments as departmentsAPI } from '../../utils/api';

const DepartmentManagement = () => {
  const { user } = useAuth();
  const { companySlug: companySlugParam } = useParams();
  const location = useLocation();
  const companySlugFromPath = location?.pathname?.split('/')?.[1] || null;
  const companySlug = companySlugParam || user?.company?.slug || companySlugFromPath;
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState({});
  const [copiedLinkId, setCopiedLinkId] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, department: null });
  const [removeUserModal, setRemoveUserModal] = useState({ isOpen: false, user: null, departmentId: null });

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await departmentsAPI.getAll();
      setDepartments(response.data);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to load departments';
      setErrors({ general: errorMessage });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    if (!newDepartmentName.trim()) {
      setErrors({ name: 'Department name is required' });
      toast.error('Department name is required');
      return;
    }

    setCreating(true);
    setErrors({});

    try {
      const response = await departmentsAPI.create({
        name: newDepartmentName.trim()
      });

      setDepartments(prev => [...prev, response.data]);
      setNewDepartmentName('');
      setShowCreateForm(false);
      toast.success(`Department "${response.data.name}" created successfully!`);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to create department';
      setErrors({ general: errorMessage });
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const copySignupLink = (department, linkType = 'team') => {
    if (!companySlug) {
      toast.error('Company slug is not available yet. Please reload the page or try again.');
      return;
    }
    const signupLink = linkType === 'head' 
      ? `${window.location.origin}/${companySlug}/${department.slug}/signup-head`
      : `${window.location.origin}/${companySlug}/${department.slug}/signup`;
    navigator.clipboard.writeText(signupLink).then(() => {
      setCopiedLinkId(`${department.id}-${linkType}`);
      setTimeout(() => setCopiedLinkId(null), 2000);
      const linkTypeText = linkType === 'head' ? 'Head signup link' : 'Team signup link';
      toast.success(`${linkTypeText} copied to clipboard!`);
    }).catch(() => {
      toast.error('Failed to copy link to clipboard');
    });
  };

  const handleAssignHead = async (departmentId, userId) => {
    try {
      await departmentsAPI.assignHead(departmentId, { userId });
      toast.success('Head of department assigned successfully!');
      // Refresh departments to show updated roles
      fetchDepartments();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to assign head of department';
      toast.error(errorMessage);
    }
  };

  const handleRemoveHead = async (departmentId, userId) => {
    try {
      await departmentsAPI.removeHead(departmentId, { userId });
      toast.success('Head of department removed successfully!');
      // Refresh departments to show updated roles
      fetchDepartments();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to remove head of department';
      toast.error(errorMessage);
    }
  };

  const handleDeleteDepartment = (departmentId, departmentName) => {
    setDeleteModal({ 
      isOpen: true, 
      department: { id: departmentId, name: departmentName } 
    });
  };

  const confirmDeleteDepartment = async () => {
    const { department } = deleteModal;
    try {
      await departmentsAPI.delete(department.id);
      toast.success(`Department "${department.name}" deleted successfully!`);
      // Refresh departments list
      fetchDepartments();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to delete department';
      toast.error(errorMessage);
    }
  };

  const handleRemoveUser = (departmentId, userId, userName) => {
    setRemoveUserModal({ 
      isOpen: true, 
      user: { id: userId, name: userName }, 
      departmentId 
    });
  };

  const confirmRemoveUser = async () => {
    const { user, departmentId } = removeUserModal;
    try {
      await departmentsAPI.removeUser(departmentId, user.id);
      toast.success(`${user.name} has been removed from the department`);
      // Refresh departments list
      fetchDepartments();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to remove user';
      toast.error(errorMessage);
    }
  };

  const generateSignupLink = (department, linkType = 'team') => {
    if (!companySlug) return '';
    return linkType === 'head' 
      ? `${window.location.origin}/${companySlug}/${department.slug}/signup-head`
      : `${window.location.origin}/${companySlug}/${department.slug}/signup`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-gray-500">
        <span className="font-medium text-gray-900">{user?.company?.name}</span>
        <span className="mx-2">/</span>
        <span>Department Management</span>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Department Management</h2>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Create Department
        </Button>
      </div>

      {errors.general && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{errors.general}</p>
        </div>
      )}

      {/* Create Department Form */}
      {showCreateForm && (
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold">Create New Department</h3>
          </Card.Header>
          <Card.Content>
            <form onSubmit={handleCreateDepartment} className="space-y-4">
              <div>
                <label htmlFor="departmentName" className="block text-sm font-medium text-gray-700 mb-1">
                  Department Name
                </label>
                <Input
                  id="departmentName"
                  type="text"
                  value={newDepartmentName}
                  onChange={(e) => setNewDepartmentName(e.target.value)}
                  className={errors.name ? 'border-red-500' : ''}
                  placeholder="Enter department name"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={creating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {creating ? 'Creating...' : 'Create Department'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewDepartmentName('');
                    setErrors({});
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

      {/* Departments List */}
      <div className="grid gap-4">
        {departments.length === 0 ? (
          <Card>
            <Card.Content className="text-center py-8">
              <p className="text-gray-500">No departments created yet.</p>
              <p className="text-sm text-gray-400 mt-2">
                Create your first department to start managing employee signups.
              </p>
            </Card.Content>
          </Card>
        ) : (
          departments.map((department) => (
            <Card key={department.id}>
              <Card.Content className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {department.name}
                      </h3>
                      {companySlug && department.slug && (
                        <Link
                          to={`/${companySlug}/${department.slug}`}
                          className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded transition-colors"
                          title="View Department"
                        >
                          📋 View
                        </Link>
                      )}
                    </div>
                    {/* <p className="text-sm text-gray-500 mt-1">
                      Created: {new Date(department.createdAt).toLocaleDateString()}
                    </p> */}
                    <p className="text-sm text-gray-500">
                      Total Users: {department._count?.users || 0}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => copySignupLink(department, 'head')}
                      className={`text-sm ${
                        copiedLinkId === `${department.id}-head`
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-purple-600 hover:bg-purple-700'
                      }`}
                      disabled={!companySlug}
                    >
                      {copiedLinkId === `${department.id}-head` ? '✓ Copied!' : 'Copy Head Link'}
                    </Button>
                    <Button
                      onClick={() => copySignupLink(department, 'team')}
                      className={`text-sm ${
                        copiedLinkId === `${department.id}-team`
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                      disabled={!companySlug}
                    >
                      {copiedLinkId === `${department.id}-team` ? '✓ Copied!' : 'Copy Team Link'}
                    </Button>
                    <Button
                      onClick={() => handleDeleteDepartment(department.id, department.name)}
                      variant="danger"
                      className="text-sm"
                      disabled={department._count?.users > 0}
                    >
                      🗑️ Delete
                    </Button>
                  </div>
                </div>
                
                {/* Show department users in 4-column grid */}
                {department.users && department.users.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Department Members:</h4>
                    <div className="grid grid-cols-4 gap-3">
                      {department.users.map((user) => (
                        <div key={user.id} className="bg-gray-50 p-3 rounded-lg">
                          <div className="text-sm font-medium text-gray-900 truncate" title={user.name}>
                            {user.name}
                          </div>
                          <div className="text-xs text-blue-600 mt-1 truncate" title={user.departmentRole}>
                            {user.departmentRole || 'No role specified'}
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              user.role === 'HEAD_OF_DEPARTMENT' 
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {user.role === 'HEAD_OF_DEPARTMENT' ? '👑 Head' : 'Member'}
                            </span>
                            <div className="flex gap-1">
                              {user.role === 'HEAD_OF_DEPARTMENT' ? (
                                <Button
                                  onClick={() => handleRemoveHead(department.id, user.id)}
                                  className="text-xs bg-red-600 hover:bg-red-700 px-2 py-1"
                                  title="Remove as Head"
                                >
                                  Remove
                                </Button>
                              ) : (
                                <Button
                                  onClick={() => handleAssignHead(department.id, user.id)}
                                  className="text-xs bg-purple-600 hover:bg-purple-700 px-2 py-1"
                                  title="Make Head"
                                >
                                  Make Head
                                </Button>
                              )}
                              <Button
                                onClick={() => handleRemoveUser(department.id, user.id, user.name)}
                                className="text-xs bg-red-600 hover:bg-red-700 px-1 py-1"
                                title="Remove from department"
                              >
                                🗑️
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {department._count?.users === 0 && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center">
                    <p className="text-sm text-gray-500">No members yet</p>
                    <p className="text-xs text-gray-400 mt-1">Share the signup links above to add members</p>
                  </div>
                )}
              </Card.Content>
            </Card>
          ))
        )}
      </div>

      {/* Delete Department Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, department: null })}
        onConfirm={confirmDeleteDepartment}
        title="Delete Department"
        message={`Are you sure you want to delete the "${deleteModal.department?.name}" department? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      {/* Remove User Confirmation Modal */}
      <ConfirmModal
        isOpen={removeUserModal.isOpen}
        onClose={() => setRemoveUserModal({ isOpen: false, user: null, departmentId: null })}
        onConfirm={confirmRemoveUser}
        title="Remove User"
        message={`Are you sure you want to remove "${removeUserModal.user?.name}" from this department? This action cannot be undone.`}
        confirmText="Remove"
        variant="danger"
      />
    </div>
  );
};

export default DepartmentManagement;