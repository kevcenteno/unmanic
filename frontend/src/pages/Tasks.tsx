import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../context/AuthContext'
import { useWebSocket } from '../context/WebSocketContext'
import { Search, Filter, Trash, RefreshCcw, ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react'

interface Task {
  id: number
  abspath: string
  status: string
  priority: number
}

interface CompletedTask {
  id: number
  task_label: string
  abspath: string
  task_success: boolean
  finish_time: string
}

interface PaginatedResponse<T> {
  recordsTotal: number
  recordsFiltered: number
  results: T[]
}

const Tasks: React.FC = () => {
  const { status, lastEvent } = useWebSocket()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as 'pending' | 'history') || 'pending'

  const [pending, setPending] = useState<Task[]>([])
  const [history, setHistory] = useState<CompletedTask[]>([])
  
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Pagination & Filtering state
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [totalRecords, setTotalRecords] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchTasks = useCallback(async () => {
    setLoading(true)
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
      fetchTasks()
    }
  }, [lastEvent?.type, fetchTasks])

  const handleTabChange = (tab: 'pending' | 'history') => {
    setSearchParams({ tab })
    setPage(1)
    setSearch('')
    setStatusFilter('')
  }

  const handleCancelPending = async (id: number) => {
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
                  <th className="w-1">Priority</th>
                  <th className="w-1">Status</th>
                  <th className="w-1"></th>
                </tr>
              ) : (
                <tr>
                  <th>Task Label</th>
                  <th className="w-1 text-center">Result</th>
                  <th className="w-1 text-nowrap">Finished At</th>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-5">
                    <div className="spinner-border text-primary" role="status"></div>
                  </td>
                </tr>
              ) : activeTab === 'pending' ? (
                pending.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-4 text-muted">No pending tasks found.</td></tr>
                ) : (
                  pending.map((t) => (
                    <tr key={t.id}>
                      <td className="text-muted small"><code>{t.abspath}</code></td>
                      <td>{t.priority}</td>
                      <td>
                        <span className={`badge ${t.status === 'pending' ? 'bg-blue-lt' : 'bg-warning-lt'}`}>
                          {t.status}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-icon btn-ghost-danger btn-sm" onClick={() => handleCancelPending(t.id)}>
                          <Trash size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )
              ) : (
                history.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-4 text-muted">No history found.</td></tr>
                ) : (
                  history.map((h) => (
                    <tr key={h.id}>
                      <td>{h.task_label}</td>
                      <td className="text-center">
                        {h.task_success ? (
                          <span className="badge bg-success-lt text-success">Success</span>
                        ) : (
                          <span className="badge bg-danger-lt text-danger">Failure</span>
                        )}
                      </td>
                      <td className="text-nowrap text-muted">
                        {new Date(h.finish_time).toLocaleString()}
                      </td>
                    </tr>
                  ))
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
    </div>
  )
}

export default Tasks
