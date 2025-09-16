import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { departments as departmentsAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const DepartmentDashboard = () => {
  const { companySlug, departmentSlug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [department, setDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalNotes: 0,
    totalTasks: 0,
    completedTasks: 0,
    recentActivity: []
  });

  useEffect(() => {
    if (companySlug && departmentSlug) {
      fetchDepartmentDetails();
    }
  }, [companySlug, departmentSlug]);

  const fetchDepartmentDetails = async () => {
    try {
      const response = await departmentsAPI.getDepartmentBySlug(companySlug, departmentSlug);
      setDepartment(response.data.department);
      
      // Mock stats for now - will be replaced with real data
      setStats({
        totalNotes: response.data.department._count?.notes || 0,
        totalTasks: response.data.department._count?.tasks || 0,
        completedTasks: Math.floor((response.data.department._count?.tasks || 0) * 0.7),
        recentActivity: []
      });
    } catch (error) {
      console.error('Error fetching department:', error);
      toast.error('Failed to load department details');
    } finally {
      setLoading(false);
    }
  };

  const isHead = user?.role === 'HEAD_OF_DEPARTMENT';
  const canManage = isHead || user?.role === 'SUPER_ADMIN';

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!department) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Department Not Found</h2>
        <p className="text-gray-600">The department you're looking for doesn't exist or you don't have access to it.</p>
        <Button onClick={() => navigate('/')} className="mt-4">
          Go Home
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{department.name}</h1>
            <p className="text-gray-600 mt-2">Welcome to your department dashboard</p>
            <div className="flex items-center space-x-4 mt-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                user?.role === 'HEAD_OF_DEPARTMENT' 
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {user?.role === 'HEAD_OF_DEPARTMENT' ? '👑 Department Head' : '📋 Team Member'}
              </span>
              {user?.departmentRole && (
                <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                  {user.departmentRole}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {department.users?.length || 0} members
            </span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <Card.Content className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  📝
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Notes</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalNotes}</p>
              </div>
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  ✅
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Tasks</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalTasks}</p>
              </div>
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  ⏱️
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Completed</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.completedTasks}</p>
              </div>
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  👥
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Team Members</p>
                <p className="text-2xl font-semibold text-gray-900">{department.users?.length || 0}</p>
              </div>
            </div>
          </Card.Content>
        </Card>
      </div>

      {/* Main Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <Card.Content className="p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📝</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Collaborative Notes</h3>
            <p className="text-gray-600 mb-6">
              Create, edit, and share notes with your team. Real-time collaboration and rich text editing.
            </p>
            <Button
              onClick={() => navigate(`/${companySlug}/${departmentSlug}/notes`)}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              View Notes
            </Button>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📋</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Task Management</h3>
            <p className="text-gray-600 mb-6">
              Organize tasks with Kanban boards. Assign, prioritize, and track progress with your team.
            </p>
            <Button
              onClick={() => navigate(`/${companySlug}/${departmentSlug}/tasks`)}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              View Tasks
            </Button>
          </Card.Content>
        </Card>

        {canManage && (
          <Card>
            <Card.Content className="p-8 text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">👥</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Team Management</h3>
              <p className="text-gray-600 mb-6">
                {isHead ? 'Request member removal and manage your team.' : 'Manage department members and approve requests.'}
              </p>
              <Button
                onClick={() => navigate(`/${companySlug}/${departmentSlug}/manage`)}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                Manage Team
              </Button>
            </Card.Content>
          </Card>
        )}
      </div>

      {/* Team Members */}
      {department.users && department.users.length > 0 && (
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold">Team Members</h3>
          </Card.Header>
          <Card.Content>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {department.users.map((member) => (
                <div key={member.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-700">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {member.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {member.role === 'HEAD_OF_DEPARTMENT' ? '👑 Head' : '👤 Member'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Recent Activity (placeholder) */}
      <Card>
        <Card.Header>
          <h3 className="text-lg font-semibold">Recent Activity</h3>
        </Card.Header>
        <Card.Content>
          <div className="text-center py-8 text-gray-500">
            <p>No recent activity</p>
            <p className="text-sm">Start creating notes and tasks to see activity here</p>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};

export default DepartmentDashboard;