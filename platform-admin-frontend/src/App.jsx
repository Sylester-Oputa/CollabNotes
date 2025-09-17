import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './components/dashboard/Dashboard';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Toaster position="top-right" />
          
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            
            {/* Protected routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            {/* Placeholder routes for future implementation */}
            <Route path="/revenue" element={
              <ProtectedRoute>
                <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                  <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900">Revenue Analytics</h1>
                    <p className="mt-4 text-gray-600">Coming soon...</p>
                  </div>
                </div>
              </ProtectedRoute>
            } />
            
            <Route path="/companies" element={
              <ProtectedRoute>
                <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                  <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900">Company Management</h1>
                    <p className="mt-4 text-gray-600">Coming soon...</p>
                  </div>
                </div>
              </ProtectedRoute>
            } />
            
            <Route path="/profile" element={
              <ProtectedRoute>
                <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                  <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
                    <p className="mt-4 text-gray-600">Coming soon...</p>
                  </div>
                </div>
              </ProtectedRoute>
            } />
            
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;