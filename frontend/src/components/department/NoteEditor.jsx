import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { notes as notesAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const NoteEditor = () => {
  const { id: departmentId, noteId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedNote, setEditedNote] = useState({ title: '', content: '' });
  const [lastSaved, setLastSaved] = useState(null);

  useEffect(() => {
    if (noteId) {
      fetchNote();
    }
  }, [noteId]);

  const fetchNote = async () => {
    try {
      const response = await notesAPI.getNote(noteId);
      setNote(response.data);
      setEditedNote({
        title: response.data.title,
        content: response.data.content || ''
      });
    } catch (error) {
      console.error('Error fetching note:', error);
      toast.error('Failed to load note');
      navigate(`/department/${departmentId}/notes`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editedNote.title.trim()) {
      toast.error('Note title is required');
      return;
    }

    setSaving(true);
    try {
      const response = await notesAPI.updateNote(noteId, {
        title: editedNote.title.trim(),
        content: editedNote.content.trim()
      });

      setNote(response.data);
      setIsEditing(false);
      setLastSaved(new Date());
      toast.success('Note saved successfully!');
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedNote({
      title: note.title,
      content: note.content || ''
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${note.title}"?`)) {
      return;
    }

    try {
      await notesAPI.deleteNote(noteId);
      toast.success('Note deleted successfully!');
      navigate(`/department/${departmentId}/notes`);
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    }
  };

  const canEdit = note && (note.authorId === user?.id || user?.role === 'HEAD_OF_DEPARTMENT' || user?.role === 'SUPER_ADMIN');
  const canDelete = canEdit;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Note Not Found</h2>
        <p className="text-gray-600">The note you're looking for doesn't exist or you don't have access to it.</p>
        <Button onClick={() => navigate(`/department/${departmentId}/notes`)} className="mt-4">
          Back to Notes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <Button
              onClick={() => navigate(`/department/${departmentId}/notes`)}
              variant="secondary"
              className="text-sm"
            >
              ← Back to Notes
            </Button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isEditing ? 'Editing Note' : note.title}
          </h1>
          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
            <span>By: {note.author?.name || 'Unknown'}</span>
            <span>Created: {new Date(note.createdAt).toLocaleString()}</span>
            <span>Updated: {new Date(note.updatedAt).toLocaleString()}</span>
            {lastSaved && (
              <span className="text-green-600">
                Last saved: {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {canEdit && !isEditing && (
            <Button
              onClick={() => setIsEditing(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              ✏️ Edit
            </Button>
          )}
          {canDelete && !isEditing && (
            <Button
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              🗑️ Delete
            </Button>
          )}
        </div>
      </div>

      {/* Note Content */}
      <Card>
        <Card.Content className="p-6">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="editTitle" className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <Input
                  id="editTitle"
                  type="text"
                  value={editedNote.title}
                  onChange={(e) => setEditedNote(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter note title"
                  className="text-xl font-semibold"
                />
              </div>
              <div>
                <label htmlFor="editContent" className="block text-sm font-medium text-gray-700 mb-1">
                  Content
                </label>
                <textarea
                  id="editContent"
                  value={editedNote.content}
                  onChange={(e) => setEditedNote(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Write your note content here..."
                  className="w-full min-h-96 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={20}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {saving ? 'Saving...' : '💾 Save Changes'}
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="secondary"
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="prose max-w-none">
                {note.content ? (
                  <div className="whitespace-pre-wrap text-gray-900 leading-relaxed">
                    {note.content}
                  </div>
                ) : (
                  <div className="text-gray-500 italic text-center py-8">
                    This note has no content yet.
                    {canEdit && (
                      <div className="mt-2">
                        <Button
                          onClick={() => setIsEditing(true)}
                          className="text-sm bg-blue-600 hover:bg-blue-700"
                        >
                          Add Content
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Note Info */}
      <Card>
        <Card.Header>
          <h3 className="text-lg font-semibold">Note Information</h3>
        </Card.Header>
        <Card.Content>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Author:</span>
              <p className="text-gray-900">{note.author?.name || 'Unknown'}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Department:</span>
              <p className="text-gray-900">{note.department?.name || 'Unknown'}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Word Count:</span>
              <p className="text-gray-900">
                {note.content ? note.content.split(/\s+/).filter(word => word.length > 0).length : 0} words
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Character Count:</span>
              <p className="text-gray-900">{note.content?.length || 0} characters</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Created:</span>
              <p className="text-gray-900">{new Date(note.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Last Modified:</span>
              <p className="text-gray-900">{new Date(note.updatedAt).toLocaleString()}</p>
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Collaboration Info (placeholder for future real-time features) */}
      <Card>
        <Card.Header>
          <h3 className="text-lg font-semibold">Collaboration</h3>
        </Card.Header>
        <Card.Content>
          <div className="text-center py-6 text-gray-500">
            <p>Real-time collaboration features coming soon!</p>
            <p className="text-sm mt-1">Multiple users will be able to edit notes simultaneously</p>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};

export default NoteEditor;