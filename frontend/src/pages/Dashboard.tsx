import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../context/AuthContext'
import { useWebSocket, ActiveWorkerStat } from '../context/WebSocketContext'
import { List, History, ChevronRight, CheckCircle, XCircle, Cpu, Pause, Play, XOctagon } from 'lucide-react'
import WorkerDetailsModal from '../components/WorkerDetailsModal'
import PendingTaskModal from '../components/PendingTaskModal'
import CompletedTaskModal from '../components/CompletedTaskModal'
import { formatTimeOnly, formatStatus, formatTime } from '../utils/utils'

const Dashboard: React.FC = () => {
  const { status, isConnected } = useWebSocket()
  const [loading, setLoading] = useState<boolean>(true)
  const [selectedWorkerName, setSelectedWorkerName] = useState<string | null>(null)
  const [selectedPendingTask, setSelectedPendingTask] = useState<any | null>(null)
  const [selectedHistoryTask, setSelectedHistoryTask] = useState<any | null>(null)

  const handlePause = async () => {
    try {
      await api.post('/workers/pause')
    } catch (err) {
      console.error('Failed to pause workers', err)
    }
  }

  const handleResume = async () => {
    try {
      await api.post('/workers/resume')
    } catch (err) {
      console.error('Failed to resume workers', err)
    }
  }

  const handleKill = async () => {
    if (!window.confirm('Are you sure you want to kill all active workers? This will stop current transcodes and they will need to be restarted.')) return
    try {
      await api.post('/workers/kill')
    } catch (err) {
      console.error('Failed to kill workers', err)
    }
  }

  useEffect(() => {
    if (status) {
      setLoading(false)
    }
  }, [status])

  const workerStatus = status?.workers || { active: 0, idle: 0, total_capacity: 0, active_stats: {}, paused_workers: {} }
  const pendingTasks = status?.pending || []
  const completedTasks = status?.history || []

  // Identify all workers that should be displayed
  // 1. All workers up to the current capacity
  // 2. Any worker that currently has active stats (even if outside capacity)
  // 3. Any worker that is currently paused (even if outside capacity)
  const allWorkerNames = new Set<string>()
  for (let i = 1; i <= workerStatus.total_capacity; i++) {
    allWorkerNames.add(`worker-${i}`)
  }
  if (workerStatus.active_stats) {
    Object.keys(workerStatus.active_stats).forEach(name => allWorkerNames.add(name))
  }
  if (workerStatus.paused_workers) {
    Object.keys(workerStatus.paused_workers).forEach(name => {
      if (workerStatus.paused_workers?.[name]) allWorkerNames.add(name)
    })
  }

  // Sort worker names numerically (worker-1, worker-2, ...)
  const sortedWorkerNames = Array.from(allWorkerNames).sort((a, b) => {
    const numA = parseInt(a.replace('worker-', ''))
    const numB = parseInt(b.replace('worker-', ''))
    return numA - numB
  })

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
                {workerStatus.is_paused && (
                  <span className="badge bg-warning-lt ms-2">Paused</span>
                )}
              </h3>
              <div className="card-actions btn-list">
                {workerStatus.is_paused ? (
                  <button className="btn btn-sm btn-outline-success" onClick={handleResume}>
                    <Play size={14} className="me-1" /> Resume
                  </button>
                ) : (
                  <button className="btn btn-sm btn-outline-warning" onClick={handlePause}>
                    <Pause size={14} className="me-1" /> Pause
                  </button>
                )}
                <button className="btn btn-sm btn-outline-danger" onClick={handleKill}>
                  <XOctagon size={14} className="me-1" /> Kill All
                </button>
                <span className={`badge ${isConnected ? 'bg-green-lt' : 'bg-red-lt'}`}>
                  {isConnected ? 'Live Updates' : 'Disconnected'}
                </span>
              </div>
            </div>
            <div className="card-body">
              <div className="row g-2">
                {sortedWorkerNames.map((workerName) => {
                  const stat = workerStatus.active_stats?.[workerName]
                  const isActive = !!stat
                  const isWorkerPaused = workerStatus.paused_workers?.[workerName] || stat?.is_paused || false
                  
                  let cardClass = "bg-light border-transparent"
                  let themeColor = "secondary"
                  
                  if (isWorkerPaused) {
                    cardClass = "bg-warning-lt border-warning"
                    themeColor = "warning"
                  } else if (isActive) {
                    cardClass = "bg-success-lt border-success"
                    themeColor = "success"
                  }

                  return (
                    <div key={workerName} className="col-6 col-sm-4 col-md-3 col-lg-2">
                      <div 
                        className={`p-2 border rounded text-center h-100 d-flex flex-column justify-content-center cursor-pointer ${cardClass}`}
                        onClick={() => setSelectedWorkerName(workerName)}
                        title="Click for details"
                      >
                        <div className="text-muted small mb-1">{workerName.replace('-', ' #')}</div>
                        {isActive ? (
                          <>
                            <div className={`small fw-bold text-truncate text-${themeColor} mb-1`} title={stat.abspath.split('/').pop()}>
                              {stat.abspath.split('/').pop()}
                            </div>
                            <div className="d-flex justify-content-between small text-muted mb-1" style={{ fontSize: '0.7rem' }}>
                              <span>{formatTime(stat.elapsed)}</span>
                              <span>{stat.eta > 0 ? `ETA ${formatTime(stat.eta)}` : 'ETC...'}</span>
                            </div>
                            <div className="progress progress-sm w-100 mt-auto">
                              <div 
                                className={`progress-bar bg-${themeColor}`} 
                                style={{ width: `${stat.percentage}%` }} 
                              ></div>
                            </div>
                          </>
                        ) : (
                          <div className={`fw-bold mt-auto text-${themeColor}`}>
                            {isWorkerPaused ? 'Paused' : 'Idle'}
                          </div>
                        )}
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
                <span>Total Capacity: <strong>{workerStatus.total_capacity}</strong></span>
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
                Pending Queue (Next 10)
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
                    <th>Library & File</th>
                    <th className="w-1">Status</th>
                    <th>Pipeline & Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && pendingTasks.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-4"><div className="spinner-border spinner-border-sm text-muted"></div></td></tr>
                  ) : pendingTasks.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-4 text-muted">No pending tasks.</td></tr>
                  ) : (
                    pendingTasks.map((task) => (
                      <tr key={task.id} className="cursor-pointer" onClick={() => setSelectedPendingTask(task)}>
                        <td className="small text-muted" title={task.abspath}>
                          <div className="fw-bold mb-1 text-primary">{task.library?.name || '-'}</div>
                          <code>{task.abspath}</code>
                        </td>
                        <td>
                          <span className={`badge ${task.status === 'pending' ? 'bg-blue-lt' : 'bg-warning-lt'}`}>
                            {formatStatus(task.status)}
                          </span>
                        </td>
                        <td className="small text-muted">
                          {task.library?.pipeline?.name ? (
                            <>
                              <div><strong>{task.library.pipeline.name}</strong></div>
                              <div>{task.profile?.name || '-'}</div>
                            </>
                          ) : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recently Completed Card */}
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
                      <tr key={task.id} className="cursor-pointer" onClick={() => setSelectedHistoryTask(task)}>
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
                           {formatTimeOnly(task.finish_time)}
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

      {selectedWorkerName && (
        <WorkerDetailsModal 
          workerName={selectedWorkerName}
          stat={workerStatus.active_stats?.[selectedWorkerName]} 
          onClose={() => setSelectedWorkerName(null)} 
        />
      )}

      {selectedPendingTask && (
        <PendingTaskModal
          task={selectedPendingTask}
          onClose={() => setSelectedPendingTask(null)}
        />
      )}

      {selectedHistoryTask && (
        <CompletedTaskModal
          task={selectedHistoryTask}
          onClose={() => setSelectedHistoryTask(null)}
        />
      )}
    </div>
  )
}

export default Dashboard