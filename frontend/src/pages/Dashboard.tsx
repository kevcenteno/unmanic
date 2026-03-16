import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWebSocket } from '../context/WebSocketContext'
import { List, History, ChevronRight, CheckCircle, XCircle, Cpu } from 'lucide-react'

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'N/A'
  const date = new Date(dateStr)
  if (date.getFullYear() <= 1) return 'N/A'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const Dashboard: React.FC = () => {
  const { status, isConnected } = useWebSocket()
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    if (status) {
      setLoading(false)
    }
  }, [status])

  const workerStatus = status?.workers || { active: 0, idle: 0 }
  const pendingTasks = status?.pending || []
  const completedTasks = status?.history || []

  const totalThreads = Number(workerStatus.active) + Number(workerStatus.idle)

  return (
    <div className="container-xl">
      <div className="row row-deck row-cards">
        {/* Worker Threads Card - Full Width */}
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title d-flex align-items-center">
                <Cpu size={18} className="me-2 text-info" />
                Worker Threads
              </h3>
              <div className="card-actions">
                <span className={`badge ${isConnected ? 'bg-green-lt' : 'bg-red-lt'}`}>
                  {isConnected ? 'Live Updates' : 'Disconnected'}
                </span>
              </div>
            </div>
            <div className="card-body">
              <div className="row g-2">
                {Array.from({ length: Math.max(1, totalThreads) }).map((_, idx) => {
                  const isActive = idx < workerStatus.active
                  return (
                    <div key={idx} className="col-6 col-sm-4 col-md-3 col-lg-2">
                      <div className={`p-2 border rounded text-center ${isActive ? 'bg-success-lt border-success' : 'bg-light border-transparent'}`}>
                        <div className="text-muted small mb-1">Worker #{idx + 1}</div>
                        <div className={`fw-bold ${isActive ? 'text-success' : 'text-secondary'}`}>
                          {isActive ? 'Active' : 'Idle'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="card-footer py-2 bg-light">
              <div className="d-flex justify-content-between small text-muted">
                <span>Active: <strong>{workerStatus.active}</strong></span>
                <span>Idle: <strong>{workerStatus.idle}</strong></span>
                <span>Total Capacity: <strong>{totalThreads}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Tasks Card */}
        <div className="col-lg-6">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title d-flex align-items-center">
                <List size={18} className="me-2 text-primary" />
                Pending Queue (Top 10)
              </h3>
              <div className="card-actions">
                <Link to="/tasks?tab=pending" className="btn btn-sm btn-ghost-primary">
                  See all <ChevronRight size={14} className="ms-1" />
                </Link>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-vcenter card-table table-hover">
                <thead>
                  <tr>
                    <th>File</th>
                    <th className="w-1">Priority</th>
                    <th className="w-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && pendingTasks.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-4"><div className="spinner-border spinner-border-sm text-muted"></div></td></tr>
                  ) : pendingTasks.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-4 text-muted">No pending tasks.</td></tr>
                  ) : (
                    pendingTasks.map((task) => (
                      <tr key={task.id}>
                        <td className="small text-muted" title={task.abspath}>
                          <code>{task.abspath}</code>
                        </td>
                        <td className="text-muted">{task.priority}</td>
                        <td>
                          <span className={`badge ${task.status === 'pending' ? 'bg-blue-lt' : 'bg-warning-lt'}`}>
                            {task.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Completed Tasks Card */}
        <div className="col-lg-6">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title d-flex align-items-center">
                <History size={18} className="me-2 text-success" />
                Recently Completed
              </h3>
              <div className="card-actions">
                <Link to="/tasks?tab=history" className="btn btn-sm btn-ghost-success">
                  See all <ChevronRight size={14} className="ms-1" />
                </Link>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-vcenter card-table table-hover">
                <thead>
                  <tr>
                    <th>Task Path</th>
                    <th className="w-1 text-center">Status</th>
                    <th className="w-1 text-nowrap">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && completedTasks.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-4"><div className="spinner-border spinner-border-sm text-muted"></div></td></tr>
                  ) : completedTasks.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-4 text-muted">No completed tasks.</td></tr>
                  ) : (
                    completedTasks.map((task) => (
                      <tr key={task.id}>
                        <td className="small text-muted" title={task.abspath}>
                          <code>{task.abspath}</code>
                        </td>
                        <td className="text-center">
                          {task.task_success ? (
                            <CheckCircle size={16} className="text-success" />
                          ) : (
                            <XCircle size={16} className="text-danger" />
                          )}
                        </td>
                        <td className="text-nowrap text-muted">
                           {formatDate(task.finish_time)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
