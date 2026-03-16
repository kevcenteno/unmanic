import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../context/AuthContext'
import { useWebSocket } from '../context/WebSocketContext'
import { Search, Trash, ChevronLeft, ChevronRight, ArrowUpToLine, ArrowDownToLine, Trash2, ListPlus } from 'lucide-react'
import TaskDetailsModal from '../components/TaskDetailsModal'
import { formatBytes, formatDate, formatStatus } from '../utils/utils'

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
  library?: {
    name: string
    pipeline?: { name: string }
  }
  profile?: {
    name: string
  }
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
  ffmpeg_command: string
  log: string
  processed_by_worker: string
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
  const [selectedTask, setSelectedTask] = useState<any | null>(null)
  
  // Selection state
  const [selectedPendingIds, setSelectedPendingIds] = useState<Set<number>>(new Set())
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<number>>(new Set())

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
        const newPending = resp.data.results || []
        setPending(newPending)
        
        if (!isBackground) {
          setSelectedPendingIds(new Set())
        } else {
          setSelectedPendingIds(prev => {
            const newSet = new Set<number>()
            const validIds = new Set(newPending.map((t: Task) => t.id))
            prev.forEach(id => {
              if (validIds.has(id)) newSet.add(id)
            })
            return newSet
          })
        }
      } else {
        const newHistory = resp.data.results || []
        setHistory(newHistory)
        
        if (!isBackground) {
          setSelectedHistoryIds(new Set())
        } else {
          setSelectedHistoryIds(prev => {
            const newSet = new Set<number>()
            const validIds = new Set(newHistory.map((t: CompletedTask) => t.id))
            prev.forEach(id => {
              if (validIds.has(id)) newSet.add(id)
            })
            return newSet
          })
        }
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

  const handleSelectAllPending = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedPendingIds(new Set(pending.map(t => t.id)))
    } else {
      setSelectedPendingIds(new Set())
    }
  }

  const handleSelectRowPending = (e: React.MouseEvent | React.ChangeEvent, id: number) => {
    e.stopPropagation()
    const newSelected = new Set(selectedPendingIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedPendingIds(newSelected)
  }

  const handleSelectAllHistory = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedHistoryIds(new Set(history.map(t => t.id)))
    } else {
      setSelectedHistoryIds(new Set())
    }
  }

  const handleSelectRowHistory = (e: React.MouseEvent | React.ChangeEvent, id: number) => {
    e.stopPropagation()
    const newSelected = new Set(selectedHistoryIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedHistoryIds(newSelected)
  }

  const handleBulkActionPending = async (action: 'move_top' | 'move_bottom' | 'remove') => {
    if (selectedPendingIds.size === 0) return
    if (action === 'remove' && !window.confirm(`Are you sure you want to cancel and remove ${selectedPendingIds.size} tasks? They will not be rescanned.`)) {
      return
    }

    try {
      await api.post('/tasks/pending/bulk', {
        action,
        task_ids: Array.from(selectedPendingIds)
      })
      setSelectedPendingIds(new Set())
      fetchTasks()
    } catch (err) {
      console.error('Bulk action failed', err)
      setError(`Failed to perform ${action} on selected tasks`)
    }
  }

  const handleBulkActionHistory = async (action: 'requeue' | 'remove') => {
    if (selectedHistoryIds.size === 0) return
    if (action === 'remove' && !window.confirm(`Are you sure you want to permanently remove ${selectedHistoryIds.size} tasks from history?`)) {
      return
    }

    try {
      await api.post('/tasks/history/bulk', {
        action,
        task_ids: Array.from(selectedHistoryIds)
      })
      setSelectedHistoryIds(new Set())
      fetchTasks()
    } catch (err) {
      console.error('History bulk action failed', err)
      setError(`Failed to perform ${action} on selected history tasks`)
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
                <input type="text" className="form-control form-control-sm" value={pageSize} size={1} disabled readOnly />
              </div>
              entries
            </div>
            <div className="ms-auto d-flex">
              {activeTab === 'history' && (
                <select 
                  className="form-select form-select-sm me-2" 
                  style={{ width: '120px' }}
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(Page => 1); }}
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
                  onChange={(e) => { setSearch(e.target.value); setPage(Page => 1); }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="table-responsive">
          {activeTab === 'pending' && selectedPendingIds.size > 0 && (
            <div className="bg-blue-lt p-2 border-bottom d-flex align-items-center">
              <span className="me-3 small fw-bold text-primary">{selectedPendingIds.size} selected</span>
              <div className="btn-list">
                <button className="btn btn-sm btn-outline-primary" onClick={() => handleBulkActionPending('move_top')}>
                  <ArrowUpToLine size={14} className="me-1" /> Move Top
                </button>
                <button className="btn btn-sm btn-outline-primary" onClick={() => handleBulkActionPending('move_bottom')}>
                  <ArrowDownToLine size={14} className="me-1" /> Move Bottom
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => handleBulkActionPending('remove')}>
                  <Trash2 size={14} className="me-1" /> Remove
                </button>
              </div>
            </div>
          )}
          {activeTab === 'history' && selectedHistoryIds.size > 0 && (
            <div className="bg-blue-lt p-2 border-bottom d-flex align-items-center">
              <span className="me-3 small fw-bold text-primary">{selectedHistoryIds.size} selected</span>
              <div className="btn-list">
                <button className="btn btn-sm btn-outline-primary" onClick={() => handleBulkActionHistory('requeue')}>
                  <ListPlus size={14} className="me-1" /> Add to Pending Queue
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => handleBulkActionHistory('remove')}>
                  <Trash2 size={14} className="me-1" /> Remove from History
                </button>
              </div>
            </div>
          )}
          <table className="table table-vcenter card-table table-hover">
            <thead>
              {activeTab === 'pending' ? (
                <tr>
                  <th className="w-1">
                    <input 
                      type="checkbox" 
                      className="form-check-input m-0" 
                      onChange={handleSelectAllPending}
                      checked={pending.length > 0 && selectedPendingIds.size === pending.length}
                    />
                  </th>
                  <th>File Path</th>
                  <th>Library</th>
                  <th>Pipeline & Profile</th>
                  <th className="w-1">Size</th>
                  <th className="w-1">Priority</th>
                  <th className="w-1">Status</th>
                  <th className="w-1"></th>
                </tr>
              ) : (
                <tr>
                  <th className="w-1">
                    <input 
                      type="checkbox" 
                      className="form-check-input m-0" 
                      onChange={handleSelectAllHistory}
                      checked={history.length > 0 && selectedHistoryIds.size === history.length}
                    />
                  </th>
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
                  <td colSpan={8} className="text-center py-5">
                    <div className="spinner-border text-primary" role="status"></div>
                  </td>
                </tr>
              ) : activeTab === 'pending' ? (
                pending.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-4 text-muted">No pending tasks found.</td></tr>
                ) : (
                  pending.map((t) => (
                    <tr key={t.id} onClick={() => setSelectedTask(t)} className="cursor-pointer">
                      <td onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="form-check-input m-0"
                          checked={selectedPendingIds.has(t.id)}
                          onChange={(e) => handleSelectRowPending(e, t.id)}
                        />
                      </td>
                      <td className="text-muted small"><code>{t.abspath}</code></td>
                      <td className="text-muted small">{t.library?.name || '-'}</td>
                      <td className="text-muted small">
                        {t.library?.pipeline?.name ? (
                          <>
                            <div><strong>{t.library.pipeline.name}</strong></div>
                            <div>{t.profile?.name || '-'}</div>
                          </>
                        ) : '-'}
                      </td>
                      <td className="text-nowrap">{formatBytes(t.original_size)}</td>
                      <td>{t.priority}</td>
                      <td>
                        <span className={`badge ${t.status === 'pending' ? 'bg-blue-lt' : 'bg-warning-lt'}`}>
                          {formatStatus(t.status)}
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
                  <tr><td colSpan={7} className="text-center py-4 text-muted">No history found.</td></tr>
                ) : (
                  history.map((h) => {
                    const savings = h.original_size && h.new_size 
                      ? ((1 - (h.new_size / h.original_size)) * 100).toFixed(1)
                      : '0'
                    return (
                      <tr key={h.id} onClick={() => setSelectedTask(h)} className="cursor-pointer">
                        <td onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            className="form-check-input m-0"
                            checked={selectedHistoryIds.has(h.id)}
                            onChange={(e) => handleSelectRowHistory(e, h.id)}
                          />
                        </td>
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