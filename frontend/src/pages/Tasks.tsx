import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../context/AuthContext'
import { useWebSocket } from '../context/WebSocketContext'
import { Search, Filter, Trash, RefreshCcw, ChevronLeft, ChevronRight, CheckCircle, XCircle, Info, Copy, Clock, HardDrive, FileText } from 'lucide-react'

interface Task {
  id: number
  abspath: string
  status: string
  priority: number
  original_size: number
  log?: string
  start_time?: string
  finish_time?: string
  processed_by_worker?: string
}

interface CompletedTask {
  id: number
  task_label: string
  abspath: string
  task_success: boolean
  finish_time: string
  start_time: string
  original_size: number
  new_size: number
  log: string
  processed_by_worker: string
}

interface PaginatedResponse<T> {
  recordsTotal: number
  recordsFiltered: number
  results: T[]
}

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 MB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

const formatDate = (dateStr?: string, fallback: string = 'N/A') => {
  if (!dateStr) return fallback
  const date = new Date(dateStr)
  // Check if date is Go's zero value (0001-01-01...)
  if (date.getFullYear() <= 1) return fallback
  return date.toLocaleString()
}

const TaskDetailsModal: React.FC<{ task: any; onClose: () => void }> = ({ task, onClose }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'log'>('info')
  
  const copyPath = () => {
    navigator.clipboard.writeText(task.abspath)
  }

  const savings = task.original_size && task.new_size 
    ? ((1 - (task.new_size / task.original_size)) * 100).toFixed(1)
    : null

  return (
    <>
      <div className="modal modal-blur fade show d-block" tabIndex={-1} role="dialog">
        <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title text-truncate" title={task.abspath}>
                Task Details
              </h5>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>
            
            <div className="card-header border-0">
              <ul className="nav nav-tabs card-header-tabs">
                <li className="nav-item">
                  <button className={`nav-link ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>
                    <Info size={16} className="me-2" /> General
                  </button>
                </li>
                <li className="nav-item">
                  <button className={`nav-link ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>
                    <FileText size={16} className="me-2" /> Processing Log
                  </button>
                </li>
              </ul>
            </div>

            <div className="modal-body scrollable" style={{ maxHeight: '70vh' }}>
              {activeTab === 'info' ? (
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label">File Path</label>
                    <div className="input-group">
                      <input type="text" className="form-control" value={task.abspath} readOnly />
                      <button className="btn btn-outline-secondary btn-icon" onClick={copyPath} title="Copy Path">
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="card bg-light border-0">
                      <div className="card-body p-3">
                        <div className="d-flex align-items-center mb-2">
                          <Clock size={16} className="text-muted me-2" />
                          <div className="text-muted small">Timing</div>
                        </div>
                        <div className="small"><strong>Started:</strong> {formatDate(task.start_time)}</div>
                        <div className="small"><strong>Finished:</strong> {formatDate(task.finish_time, 'Pending')}</div>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="card bg-light border-0">
                      <div className="card-body p-3">
                        <div className="d-flex align-items-center mb-2">
                          <HardDrive size={16} className="text-muted me-2" />
                          <div className="text-muted small">Storage</div>
                        </div>
                        <div className="small"><strong>Original:</strong> {formatBytes(task.original_size)}</div>
                        {task.new_size > 0 && (
                          <>
                            <div className="small"><strong>New Size:</strong> {formatBytes(task.new_size)}</div>
                            <div className="small text-success"><strong>Savings:</strong> {savings}%</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="datagrid">
                      <div className="datagrid-item">
                        <div className="datagrid-title">Status</div>
                        <div className="datagrid-content">
                          <span className={`badge ${task.task_success !== undefined ? (task.task_success ? 'bg-success-lt' : 'bg-danger-lt') : 'bg-blue-lt'}`}>
                            {task.status || (task.task_success ? 'Success' : 'Failed')}
                          </span>
                        </div>
                      </div>
                      <div className="datagrid-item">
                        <div className="datagrid-title">Worker</div>
                        <div className="datagrid-content">{task.processed_by_worker || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-dark text-light p-3 rounded font-monospace small" style={{ whiteSpace: 'pre-wrap', minHeight: '200px' }}>
                  {task.log || 'No log data available for this task.'}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary ms-auto" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}

const Tasks: React.FC = () => {
  const { status, lastEvent } = useWebSocket()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as 'pending' | 'history') || 'pending'

  const [pending, setPending] = useState<Task[]>([])
  const [history, setHistory] = useState<CompletedTask[]>([])
  
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<any | null>(null)

  // Pagination & Filtering state
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [totalRecords, setTotalRecords] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchTasks = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true)
    }
    setError(null)
    const start = (page - 1) * pageSize
    const endpoint = activeTab === 'pending' ? '/tasks/pending' : '/tasks/history'
    
    let url = `${endpoint}?start=${start}&length=${pageSize}&search=${search}`
    if (activeTab === 'history' && statusFilter) {
      url += `&status=${statusFilter}`
    }

    try {
      const resp = await api.get<PaginatedResponse<any>>(url)
      if (activeTab === 'pending') {
        setPending(resp.data.results || [])
      } else {
        setHistory(resp.data.results || [])
      }
      setTotalRecords(resp.data.recordsFiltered)
    } catch (err) {
      console.error('Failed to fetch tasks', err)
      setError(`Failed to load ${activeTab} tasks`)
    } finally {
      setLoading(false)
    }
  }, [activeTab, page, pageSize, search, statusFilter])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // Refresh data when WebSocket receives a relevant update
  useEffect(() => {
    if (lastEvent?.type === 'TASKS_UPDATE' || lastEvent?.type === 'FULL_STATUS') {
      fetchTasks(true)
    }
  }, [lastEvent?.type, fetchTasks])

  const handleTabChange = (tab: 'pending' | 'history') => {
    setSearchParams({ tab })
    setPage(1)
    setSearch('')
    setStatusFilter('')
  }

  const handleCancelPending = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!window.confirm('Cancel this pending task?')) return
    try {
      await api.delete(`/tasks/pending/${id}`)
      fetchTasks()
    } catch (err) {
      console.error('Failed to cancel pending task', err)
      setError('Failed to cancel pending task')
    }
  }

  const handleClearHistory = async () => {
    if (!window.confirm('Clear task history? This cannot be undone.')) return
    try {
      await api.delete('/tasks/history')
      fetchTasks()
    } catch (err) {
      console.error('Failed to clear history', err)
      setError('Failed to clear history')
    }
  }

  const totalPages = Math.ceil(totalRecords / pageSize)

  return (
    <div className="container-xl">
      <div className="page-header d-print-none mb-4">
        <div className="row align-items-center">
          <div className="col">
            <h2 className="page-title">Task Management</h2>
          </div>
          {activeTab === 'history' && (
            <div className="col-auto ms-auto">
              <button className="btn btn-outline-danger" onClick={handleClearHistory}>
                <Trash size={16} className="me-2" /> Clear History
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header border-0">
          <ul className="nav nav-tabs card-header-tabs" role="tablist">
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'pending' ? 'active' : ''}`}
                onClick={() => handleTabChange('pending')}
              >
                Pending Queue
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => handleTabChange('history')}
              >
                Task History
              </button>
            </li>
          </ul>
        </div>

        <div className="card-body border-bottom py-3">
          <div className="d-flex">
            <div className="text-muted">
              Show
              <div className="mx-2 d-inline-block">
                <input type="text" className="form-control form-control-sm" value={pageSize} size={1} disabled />
              </div>
              entries
            </div>
            <div className="ms-auto d-flex">
              {activeTab === 'history' && (
                <select 
                  className="form-select form-select-sm me-2" 
                  style={{ width: '120px' }}
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                >
                  <option value="">All Status</option>
                  <option value="success">Success</option>
                  <option value="fail">Failure</option>
                </select>
              )}
              <div className="input-icon">
                <span className="input-icon-addon">
                  <Search size={16} />
                </span>
                <input 
                  type="text" 
                  className="form-control form-control-sm" 
                  placeholder="Search..." 
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-vcenter card-table table-hover">
            <thead>
              {activeTab === 'pending' ? (
                <tr>
                  <th>File Path</th>
                  <th className="w-1">Size</th>
                  <th className="w-1">Priority</th>
                  <th className="w-1">Status</th>
                  <th className="w-1"></th>
                </tr>
              ) : (
                <tr>
                  <th>Task Label</th>
                  <th className="w-1 text-nowrap">Original Size</th>
                  <th className="w-1 text-nowrap">New Size</th>
                  <th className="w-1 text-nowrap">Savings</th>
                  <th className="w-1 text-center">Result</th>
                  <th className="w-1 text-nowrap">Finished At</th>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-5">
                    <div className="spinner-border text-primary" role="status"></div>
                  </td>
                </tr>
              ) : activeTab === 'pending' ? (
                pending.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-4 text-muted">No pending tasks found.</td></tr>
                ) : (
                  pending.map((t) => (
                    <tr key={t.id} onClick={() => setSelectedTask(t)} className="cursor-pointer">
                      <td className="text-muted small"><code>{t.abspath}</code></td>
                      <td className="text-nowrap">{formatBytes(t.original_size)}</td>
                      <td>{t.priority}</td>
                      <td>
                        <span className={`badge ${t.status === 'pending' ? 'bg-blue-lt' : 'bg-warning-lt'}`}>
                          {t.status}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-icon btn-ghost-danger btn-sm" onClick={(e) => handleCancelPending(e, t.id)}>
                          <Trash size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )
              ) : (
                history.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-4 text-muted">No history found.</td></tr>
                ) : (
                  history.map((h) => {
                    const savings = h.original_size && h.new_size 
                      ? ((1 - (h.new_size / h.original_size)) * 100).toFixed(1)
                      : '0'
                    return (
                      <tr key={h.id} onClick={() => setSelectedTask(h)} className="cursor-pointer">
                        <td className="text-truncate" style={{ maxWidth: '300px' }}>{h.task_label}</td>
                        <td className="text-nowrap">{formatBytes(h.original_size)}</td>
                        <td className="text-nowrap">{formatBytes(h.new_size)}</td>
                        <td className="text-nowrap">
                          <span className={`badge ${parseFloat(savings) > 0 ? 'bg-green-lt text-success' : 'bg-orange-lt text-warning'}`}>
                            {parseFloat(savings) > 0 ? `-${savings}%` : `${savings}%`}
                          </span>
                        </td>
                        <td className="text-center">
                          {h.task_success ? (
                            <span className="badge bg-success-lt text-success">Success</span>
                          ) : (
                            <span className="badge bg-danger-lt text-danger">Failure</span>
                          )}
                        </td>
                        <td className="text-nowrap text-muted">
                          {formatDate(h.finish_time)}
                        </td>
                      </tr>
                    )
                  })
                )
              )}
            </tbody>
          </table>
        </div>

        <div className="card-footer d-flex align-items-center">
          <p className="m-0 text-muted">
            Showing <span>{(page - 1) * pageSize + 1}</span> to <span>{Math.min(page * pageSize, totalRecords)}</span> of <span>{totalRecords}</span> entries
          </p>
          <ul className="pagination m-0 ms-auto">
            <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => setPage(p => Math.max(1, p - 1))}>
                <ChevronLeft size={16} /> prev
              </button>
            </li>
            <li className={`page-item ${page === totalPages || totalPages === 0 ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                next <ChevronRight size={16} />
              </button>
            </li>
          </ul>
        </div>
      </div>

      {selectedTask && (
        <TaskDetailsModal 
          task={selectedTask} 
          onClose={() => setSelectedTask(null)} 
        />
      )}
    </div>
  )
}

export default Tasks
