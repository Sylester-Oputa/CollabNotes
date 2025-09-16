import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { ConfirmModal } from '../ui/Modal';
import { tasks as tasksAPI, departments as departmentsAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const TasksBoard = () => {
  const { companySlug, departmentSlug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [department, setDepartment] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    assignedToId: '',
    dueDate: ''
  });
  const [creating, setCreating] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, task: null });

  const taskStatuses = [
    { key: 'TODO', label: 'To Do', color: 'bg-gray-100', textColor: 'text-gray-800' },
    { key: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-100', textColor: 'text-blue-800' },
    { key: 'REVIEW', label: 'Review', color: 'bg-yellow-100', textColor: 'text-yellow-800' },
    { key: 'DONE', label: 'Done', color: 'bg-green-100', textColor: 'text-green-800' }
  ];

  const priorityColors = {
    LOW: 'bg-green-100 text-green-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    HIGH: 'bg-red-100 text-red-800'
  };

  useEffect(() => {
    if (companySlug && departmentSlug) {
      fetchDepartmentDetails();
      fetchTasks();
    }
  }, [companySlug, departmentSlug]);

  const fetchDepartmentDetails = async () => {
    try {
      const response = await departmentsAPI.getDepartmentBySlug(companySlug, departmentSlug);
      setDepartment(response.data.department);
    } catch (error) {
      console.error('Error fetching department:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await tasksAPI.getDepartmentTasksBySlug(companySlug, departmentSlug);
      setTasks(response.data?.tasks || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) {
      toast.error('Task title is required');
      return;
    }

    setCreating(true);
    try {
      const taskData = {
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        priority: newTask.priority,
        departmentId: department.id,
        ...(newTask.assignedToId && { assignedToId: newTask.assignedToId }),
        ...(newTask.dueDate && { dueDate: new Date(newTask.dueDate).toISOString() })
      };

      const response = await tasksAPI.createTask(taskData);
      setTasks(prev => [response.data, ...prev]);
      setNewTask({
        title: '',
        description: '',
        priority: 'MEDIUM',
        assignedToId: '',
        dueDate: ''
      });
      setShowCreateForm(false);
      toast.success('Task created successfully!');
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      const response = await tasksAPI.updateTask(taskId, { status: newStatus });
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      ));
      toast.success('Task status updated!');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task status');
    }
  };

  const handleDeleteTask = (taskId, taskTitle) => {
    setDeleteModal({ 
      isOpen: true, 
      task: { id: taskId, title: taskTitle } 
    });
  };

  const confirmDeleteTask = async () => {
    try {
      await tasksAPI.deleteTask(deleteModal.task.id);
      setTasks(prev => prev.filter(task => task.id !== deleteModal.task.id));
      toast.success('Task deleted successfully!');
      setDeleteModal({ isOpen: false, task: null });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  };

  const getTasksByStatus = (status) => {
    return Array.isArray(tasks) ? tasks.filter(task => task.status === status) : [];
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => navigate(`/${companySlug}/${departmentSlug}`)}
              variant="secondary"
              className="text-sm"
            >
              ← Back to Dashboard
            </Button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">Tasks Board</h1>
          <p className="text-gray-600">
            {department?.name} • Team task management
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="bg-green-600 hover:bg-green-700"
        >
          ➕ New Task
        </Button>
      </div>

      {/* Create Task Form */}
      {showCreateForm && (
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold">Create New Task</h3>
          </Card.Header>
          <Card.Content>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="taskTitle" className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <Input
                    id="taskTitle"
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter task title"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="taskPriority" className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    id="taskPriority"
                    value={newTask.priority}
                    onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="taskAssignee" className="block text-sm font-medium text-gray-700 mb-1">
                    Assign To
                  </label>
                  <select
                    id="taskAssignee"
                    value={newTask.assignedToId}
                    onChange={(e) => setNewTask(prev => ({ ...prev, assignedToId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {department?.users?.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.name} {member.role === 'HEAD_OF_DEPARTMENT' ? '(Head)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="taskDueDate" className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date
                  </label>
                  <Input
                    id="taskDueDate"
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="taskDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="taskDescription"
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the task details..."
                  className="w-full min-h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={creating}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {creating ? 'Creating...' : 'Create Task'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewTask({
                      title: '',
                      description: '',
                      priority: 'MEDIUM',
                      assignedToId: '',
                      dueDate: ''
                    });
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

      {/* Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {taskStatuses.map((status) => {
          const statusTasks = getTasksByStatus(status.key);
          return (
            <div key={status.key} className="space-y-4">
              <div className={`${status.color} ${status.textColor} px-4 py-2 rounded-lg`}>
                <h3 className="font-semibold text-center">
                  {status.label} ({statusTasks.length})
                </h3>
              </div>
              
              <div className="space-y-3 min-h-96">
                {statusTasks.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-500">
                    No tasks
                  </div>
                ) : (
                  statusTasks.map((task) => (
                    <Card key={task.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <Card.Content className="p-4">
                        <div className="space-y-2">
                          <h4 className="font-medium text-gray-900">{task.title}</h4>
                          
                          {task.description && (
                            <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${priorityColors[task.priority]}`}>
                              {task.priority}
                            </span>
                            
                            {task.assignedTo && (
                              <div className="flex items-center space-x-1">
                                <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                                  <span className="text-xs font-medium">
                                    {task.assignedTo.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-600 truncate max-w-20" title={task.assignedTo.name}>
                                  {task.assignedTo.name}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {task.dueDate && (
                            <div className="text-xs text-gray-500">
                              Due: {new Date(task.dueDate).toLocaleDateString()}
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between pt-2">
                            <div className="flex space-x-1">
                              {taskStatuses.map((newStatus) => (
                                newStatus.key !== task.status && (
                                  <Button
                                    key={newStatus.key}
                                    onClick={() => handleUpdateTaskStatus(task.id, newStatus.key)}
                                    className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-700"
                                    title={`Move to ${newStatus.label}`}
                                  >
                                    →{newStatus.label.charAt(0)}
                                  </Button>
                                )
                              ))}
                            </div>
                            
                            {(task.authorId === user?.id || canManage) && (
                              <Button
                                onClick={() => handleDeleteTask(task.id, task.title)}
                                className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700"
                                title="Delete task"
                              >
                                🗑️
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card.Content>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Statistics */}
      <Card>
        <Card.Header>
          <h3 className="text-lg font-semibold">Task Statistics</h3>
        </Card.Header>
        <Card.Content>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">{tasks.length}</p>
              <p className="text-sm text-gray-600">Total Tasks</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{getTasksByStatus('DONE').length}</p>
              <p className="text-sm text-gray-600">Completed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{getTasksByStatus('IN_PROGRESS').length}</p>
              <p className="text-sm text-gray-600">In Progress</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">
                {tasks.filter(task => task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE').length}
              </p>
              <p className="text-sm text-gray-600">Overdue</p>
            </div>
          </div>
        </Card.Content>
      </Card>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, task: null })}
        onConfirm={confirmDeleteTask}
        title="Delete Task"
        message={`Are you sure you want to delete "${deleteModal.task?.title}"?`}
        confirmText="Delete"
        confirmVariant="danger"
      />
    </div>
  );
};

export default TasksBoard;