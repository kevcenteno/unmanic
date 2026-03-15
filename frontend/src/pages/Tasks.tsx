import React, { useEffect, useState } from 'react'
import { api } from '../context/AuthContext'

interface Task {
  ID: number
  Abspath: string
  Status: string
}

interface CompletedTask {
  ID: number
  TaskLabel: string
  TaskSuccess: boolean
}

const Tasks: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')

  // Pending
  const [pending, setPending] = useState<Task[]>([])
  const [pendingLoading, setPendingLoading] = useState<boolean>(true)
  const [pendingDeleting, setPendingDeleting] = useState<number | null>(null)

  // History
  const [history, setHistory] = useState<CompletedTask[]>([])
  const [historyLoading, setHistoryLoading] = useState<boolean>(true)
  const [clearingHistory, setClearingHistory] = useState<boolean>(false)

  const [error, setError] = useState<string | null>(null)

  const fetchPending = async () => {
    setPendingLoading(true)
    setError(null)
    try {
      const resp = await api.get<Task[]>('/tasks/pending')
      setPending(resp?.data ?? [])
    } catch (err) {
      console.error('Failed to fetch pending tasks', err)
      setError('Failed to load pending tasks')
      setPending([])
    } finally {
      setPendingLoading(false)
    }
  }

  const fetchHistory = async () => {
    setHistoryLoading(true)
    setError(null)
    try {
      const resp = await api.get<CompletedTask[]>('/tasks/history')
      setHistory(resp?.data ?? [])
    } catch (err) {
      console.error('Failed to fetch history', err)
      setError('Failed to load history')
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    // Load both so switching is instant
    fetchPending()
    fetchHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCancelPending = async (id: number) => {
    if (!window.confirm('Cancel this pending task?')) return
    setPendingDeleting(id)
    try {
      await api.delete(`/tasks/pending/${id}`)
      await fetchPending()
    } catch (err) {
      console.error('Failed to cancel pending task', err)
      setError('Failed to cancel pending task')
    } finally {
      setPendingDeleting(null)
    }
  }

  const handleClearHistory = async () => {
    if (!window.confirm('Clear task history? This cannot be undone.')) return
    setClearingHistory(true)
    try {
      await api.delete('/tasks/history')
      await fetchHistory()
    } catch (err) {
      console.error('Failed to clear history', err)
      setError('Failed to clear history')
    } finally {
      setClearingHistory(false)
    }
  }

  return (
    <div>
      <div className="page-header d-print-none">
        <div className="row align-items-center">
          <div className="col">
            <h2 className="page-title">Tasks</h2>
          </div>
        </div>
      </div>

      <div className="row row-cards">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Tasks</h3>
            </div>

            <div className="card-body">
              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}

              <ul className="nav nav-tabs" role="tablist">
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${activeTab === 'pending' ? 'active' : ''}`}
                    role="tab"
                    aria-selected={activeTab === 'pending'}
                    onClick={() => setActiveTab('pending')}
                    style={{ cursor: 'pointer' }}
                  >
                    Pending Tasks
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${activeTab === 'history' ? 'active' : ''}`}
                    role="tab"
                    aria-selected={activeTab === 'history'}
                    onClick={() => setActiveTab('history')}
                    style={{ cursor: 'pointer' }}
                  >
                    History
                  </button>
                </li>
              </ul>

              <div className="tab-content mt-3">
                {activeTab === 'pending' && (
                  <div className="tab-pane active">
                    {pendingLoading ? (
                      <div className="text-center py-4">Loading pending tasks...</div>
                    ) : pending.length === 0 ? (
                      <div className="text-center py-4 text-muted">No pending tasks.</div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-vcenter card-table">
                          <thead>
                            <tr>
                              <th>File</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pending.map((t) => (
                              <tr key={t.ID}>
                                <td className="text-muted" style={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {t.Abspath}
                                </td>
                                <td>{t.Status}</td>
                                <td>
                                  <div className="btn-list">
                                    <button
                                      className="btn btn-danger btn-sm"
                                      onClick={() => handleCancelPending(t.ID)}
                                      disabled={pendingDeleting !== null}
                                    >
                                      {pendingDeleting === t.ID ? 'Canceling...' : 'Cancel'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="tab-pane active">
                    <div className="d-flex justify-content-between mb-3">
                      <div />
                      <div>
                        <button className="btn btn-danger" onClick={handleClearHistory} disabled={clearingHistory}>
                          {clearingHistory ? 'Clearing...' : 'Clear History'}
                        </button>
                      </div>
                    </div>

                    {historyLoading ? (
                      <div className="text-center py-4">Loading history...</div>
                    ) : history.length === 0 ? (
                      <div className="text-center py-4 text-muted">No history available.</div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-vcenter card-table">
                          <thead>
                            <tr>
                              <th>Task</th>
                              <th>Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.map((h) => (
                              <tr key={h.ID}>
                                <td>{h.TaskLabel}</td>
                                <td>
                                  {h.TaskSuccess ? (
                                    <span className="badge bg-success">Success</span>
                                  ) : (
                                    <span className="badge bg-danger">Failure</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Tasks
