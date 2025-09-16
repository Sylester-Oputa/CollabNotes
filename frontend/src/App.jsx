import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Layout from './components/layout/Layout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import DepartmentSignup from './components/auth/DepartmentSignup';
import DepartmentHeadSignup from './components/auth/DepartmentHeadSignup';
import DepartmentManagement from './components/company/DepartmentManagement';
import DepartmentDashboard from './components/department/DepartmentDashboard';
import NotesManager from './components/department/NotesManager';
import NoteEditor from './components/department/NoteEditor';
import TasksBoard from './components/department/TasksBoard';
import DepartmentHeadManagement from './components/department/DepartmentHeadManagement';

// Create a simple placeholder for missing pages
const PlaceholderPage = ({ title }) => (
  <Layout>
    <div className="text-center py-12">
      <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
      <p className="mt-4 text-gray-600">This page is under development.</p>
    </div>
  </Layout>
);

const AppRoutes = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} 
      />
      <Route 
        path="/register" 
        element={isAuthenticated ? <Navigate to="/" replace /> : <Register />} 
      />
      <Route 
        path="/:companySlug/:departmentSlug/signup" 
        element={isAuthenticated ? <Navigate to="/" replace /> : <DepartmentSignup />} 
      />
      <Route 
        path="/:companySlug/:departmentSlug/signup-head" 
        element={isAuthenticated ? <Navigate to="/" replace /> : <DepartmentHeadSignup />} 
      />
      
      {/* Protected routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <Navigate to={user?.role === 'SUPER_ADMIN' ? '/company' : `/${user?.company?.slug}/${user?.department?.slug}`} replace />
        </ProtectedRoute>
      } />
      
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Navigate to={user?.role === 'SUPER_ADMIN' ? '/company' : `/${user?.company?.slug}/${user?.department?.slug}`} replace />
        </ProtectedRoute>
      } />
      
      <Route path="/company" element={
        <ProtectedRoute>
          <Layout>
            <DepartmentManagement />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/:companySlug/:departmentSlug" element={
        <ProtectedRoute>
          <Layout>
            <DepartmentDashboard />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/:companySlug/:departmentSlug/notes" element={
        <ProtectedRoute>
          <Layout>
            <NotesManager />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/:companySlug/:departmentSlug/notes/:noteId" element={
        <ProtectedRoute>
          <Layout>
            <NoteEditor />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/:companySlug/:departmentSlug/tasks" element={
        <ProtectedRoute>
          <Layout>
            <TasksBoard />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/:companySlug/:departmentSlug/manage" element={
        <ProtectedRoute>
          <Layout>
            <DepartmentHeadManagement />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/profile" element={
        <ProtectedRoute>
          <PlaceholderPage title="Profile Settings" />
        </ProtectedRoute>
      } />
      
      <Route path="/activity" element={
        <ProtectedRoute>
          <PlaceholderPage title="Activity Feed" />
        </ProtectedRoute>
      } />
      
      {/* 404 route */}
      <Route path="*" element={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900">404</h1>
            <p className="mt-4 text-gray-600">Page not found</p>
          </div>
        </div>
      } />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                theme: {
                  primary: '#4aed88',
                },
              },
              error: {
                duration: 5000,
                theme: {
                  primary: '#f56565',
                },
              },
            }}
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
