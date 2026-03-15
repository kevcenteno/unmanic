import React, { useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, AuthContext } from './context/AuthContext'
import { WebSocketProvider } from './context/WebSocketContext'

import AdminLayout from './layouts/AdminLayout'
import Login from './pages/Login'
import Welcome from './pages/Welcome'
import Dashboard from './pages/Dashboard'
import Libraries from './pages/Libraries'
import PipelineList from './pages/PipelineList'
import Pipelines from './pages/Pipelines'
import Tasks from './pages/Tasks'
import Settings from './pages/Settings'

// ProtectedRoute checks authentication and either redirects to /login or
// renders nested routes via Outlet
const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isInitialized } = useContext(AuthContext)

  if (isInitialized === false) {
    return <Navigate to="/welcome" />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }

  return <Outlet />
}

const AppRoutes: React.FC = () => {
  const { isInitialized } = useContext(AuthContext)

  if (isInitialized === null) {
    return (
      <div className="page page-center">
        <div className="container container-tight py-4">
          <div className="text-center">
            <div className="spinner-border text-primary" role="status"></div>
            <div className="mt-2 text-muted">Loading MuxMill...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isInitialized === false ? <Navigate to="/welcome" /> : <Login />} />
        <Route path="/welcome" element={isInitialized === true ? <Navigate to="/login" /> : <Welcome />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/libraries" element={<Libraries />} />
            <Route path="/pipelines" element={<PipelineList />} />
            <Route path="/pipelines/new" element={<Pipelines />} />
            <Route path="/pipelines/:id" element={<Pipelines />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <AppRoutes />
      </WebSocketProvider>
    </AuthProvider>
  )
}

export default App
