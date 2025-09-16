import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { ConfirmModal } from '../ui/Modal';
import { notes as notesAPI, departments as departmentsAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const NotesManager = () => {
  const { companySlug, departmentSlug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [department, setDepartment] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '' });
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all'); // all, my-notes, recent
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, note: null });

  useEffect(() => {
    if (companySlug && departmentSlug) {
      fetchDepartmentDetails();
      fetchNotes();
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

  const fetchNotes = async () => {
    try {
      const response = await notesAPI.getDepartmentNotesBySlug(companySlug, departmentSlug);
      setNotes(response.data?.notes || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast.error('Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!newNote.title.trim()) {
      toast.error('Note title is required');
      return;
    }

    setCreating(true);
    try {
      const response = await notesAPI.createNote({
        title: newNote.title.trim(),
        content: newNote.content.trim(),
        departmentId: department.id
      });

      setNotes(prev => [response.data, ...prev]);
      setNewNote({ title: '', content: '' });
      setShowCreateForm(false);
      toast.success('Note created successfully!');
    } catch (error) {
      console.error('Error creating note:', error);
      toast.error('Failed to create note');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteNote = (noteId, noteTitle) => {
    setDeleteModal({ 
      isOpen: true, 
      note: { id: noteId, title: noteTitle } 
    });
  };

  const confirmDeleteNote = async () => {
    const { note } = deleteModal;
    try {
      await notesAPI.deleteNote(note.id);
      setNotes(prev => prev.filter(n => n.id !== note.id));
      toast.success('Note deleted successfully!');
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    }
  };

  const filteredNotes = Array.isArray(notes) ? notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         note.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    switch (filterBy) {
      case 'my-notes':
        return matchesSearch && note.authorId === user?.id;
      case 'recent':
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        return matchesSearch && new Date(note.updatedAt) > threeDaysAgo;
      default:
        return matchesSearch;
    }
  }) : [];

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
          <h1 className="text-3xl font-bold text-gray-900 mt-2">Notes</h1>
          <p className="text-gray-600">
            {department?.name} • Collaborative team notes
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          📝 New Note
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <Card.Content className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Search notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setFilterBy('all')}
                variant={filterBy === 'all' ? 'primary' : 'secondary'}
                className="text-sm"
              >
                All Notes
              </Button>
              <Button
                onClick={() => setFilterBy('my-notes')}
                variant={filterBy === 'my-notes' ? 'primary' : 'secondary'}
                className="text-sm"
              >
                My Notes
              </Button>
              <Button
                onClick={() => setFilterBy('recent')}
                variant={filterBy === 'recent' ? 'primary' : 'secondary'}
                className="text-sm"
              >
                Recent
              </Button>
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Create Note Form */}
      {showCreateForm && (
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold">Create New Note</h3>
          </Card.Header>
          <Card.Content>
            <form onSubmit={handleCreateNote} className="space-y-4">
              <div>
                <label htmlFor="noteTitle" className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <Input
                  id="noteTitle"
                  type="text"
                  value={newNote.title}
                  onChange={(e) => setNewNote(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter note title"
                  required
                />
              </div>
              <div>
                <label htmlFor="noteContent" className="block text-sm font-medium text-gray-700 mb-1">
                  Content
                </label>
                <textarea
                  id="noteContent"
                  value={newNote.content}
                  onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Write your note content here..."
                  className="w-full min-h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={6}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={creating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {creating ? 'Creating...' : 'Create Note'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewNote({ title: '', content: '' });
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

      {/* Notes List */}
      {filteredNotes.length === 0 ? (
        <Card>
          <Card.Content className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📝</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {notes.length === 0 ? 'No notes yet' : 'No notes match your search'}
            </h3>
            <p className="text-gray-600 mb-6">
              {notes.length === 0 
                ? 'Create your first note to start collaborating with your team'
                : 'Try adjusting your search or filter criteria'
              }
            </p>
            {notes.length === 0 && (
              <Button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Create First Note
              </Button>
            )}
          </Card.Content>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredNotes.map((note) => (
            <Card key={note.id}>
              <Card.Content className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {note.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-3 line-clamp-3">
                      {note.content || 'No content'}
                    </p>
                    <div className="flex items-center text-xs text-gray-500 space-x-4">
                      <span>By: {note.author?.name || 'Unknown'}</span>
                      <span>Created: {new Date(note.createdAt).toLocaleDateString()}</span>
                      <span>Updated: {new Date(note.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      onClick={() => navigate(`/${companySlug}/${departmentSlug}/notes/${note.id}`)}
                      variant="secondary"
                      className="text-sm"
                    >
                      View
                    </Button>
                    {(note.authorId === user?.id || canManage) && (
                      <Button
                        onClick={() => handleDeleteNote(note.id, note.title)}
                        className="text-sm bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </Card.Content>
            </Card>
          ))}
        </div>
      )}

      {/* Stats */}
      <Card>
        <Card.Content className="p-4">
          <div className="flex justify-between text-sm text-gray-600">
            <span>
              Showing {filteredNotes.length} of {notes.length} notes
            </span>
            <span>
              Total size: {notes.reduce((acc, note) => acc + (note.content?.length || 0), 0).toLocaleString()} characters
            </span>
          </div>
        </Card.Content>
      </Card>

      {/* Delete Note Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, note: null })}
        onConfirm={confirmDeleteNote}
        title="Delete Note"
        message={`Are you sure you want to delete "${deleteModal.note?.title}"?`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

export default NotesManager;