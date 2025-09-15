import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Layout from './components/layout/Layout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';

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
      
      {/* Protected routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <Navigate to={user?.role === 'SUPER_ADMIN' ? '/company' : `/department/${user?.department?.id}`} replace />
        </ProtectedRoute>
      } />
      
      <Route path="/company" element={
        <ProtectedRoute>
          <PlaceholderPage title="Company Dashboard" />
        </ProtectedRoute>
      } />
      
      <Route path="/department/:id" element={
        <ProtectedRoute>
          <PlaceholderPage title="Department Dashboard" />
        </ProtectedRoute>
      } />
      
      <Route path="/department/:id/notes" element={
        <ProtectedRoute>
          <PlaceholderPage title="Notes" />
        </ProtectedRoute>
      } />
      
      <Route path="/department/:id/notes/:noteId" element={
        <ProtectedRoute>
          <PlaceholderPage title="Note Editor" />
        </ProtectedRoute>
      } />
      
      <Route path="/department/:id/tasks" element={
        <ProtectedRoute>
          <PlaceholderPage title="Tasks Board" />
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
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
