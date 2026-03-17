import React, { useState } from 'react'
import { Info, FileText, Copy, Clock, HardDrive } from 'lucide-react'
import { formatBytes, formatDate } from '../utils/utils'

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

interface CompletedTaskModalProps {
  task: CompletedTask
  onClose: () => void
}

const formatDuration = (seconds: number): string => {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h}h ${m}m ${s}s`
  }
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}m ${s}s`
  }
  return `${seconds}s`
}

const CompletedTaskModal: React.FC<CompletedTaskModalProps> = ({ task, onClose }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'log'>('details')

  const handleCopyPath = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(task.abspath)
    } catch (err) {
      // ignore clipboard failures silently
    }
  }

  const durationSeconds = (() => {
    try {
      if (task.start_time && task.finish_time) {
        const s = new Date(task.start_time).getTime()
        const f = new Date(task.finish_time).getTime()
        if (!Number.isNaN(s) && !Number.isNaN(f) && f >= s) {
          return Math.round((f - s) / 1000)
        }
      }
    } catch (e) {
      // ignore parse errors
    }
    return undefined
  })()

  const savingsPercent = (() => {
    if (task.new_size > 0 && task.original_size > 0) {
      return (1 - task.new_size / task.original_size) * 100
    }
    return undefined
  })()

  return (
    <>
      <div className="modal modal-blur fade show d-block" tabIndex={-1} role="dialog">
        <div className="modal-dialog modal-xl modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title d-flex align-items-center">
                  {task.task_label}
                  {task.task_success ? (
                    <span className="badge bg-success ms-2">Success</span>
                  ) : (
                    <span className="badge bg-danger ms-2">Failed</span>
                  )}
                </h5>
                <div className="text-muted small text-truncate" style={{ maxWidth: '600px' }} title={task.abspath}>
                  {task.abspath}
                </div>
              </div>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>

            <div className="card-header border-0 pb-0">
              <ul className="nav nav-tabs card-header-tabs">
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === 'details' ? 'active' : ''}`}
                    onClick={() => setActiveTab('details')}
                    type="button"
                  >
                    <Info size={16} className="me-2" /> Details
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === 'log' ? 'active' : ''}`}
                    onClick={() => setActiveTab('log')}
                    type="button"
                  >
                    <FileText size={16} className="me-2" /> Processing Log
                  </button>
                </li>
              </ul>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {activeTab === 'details' && (
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label small fw-bold">File Path</label>
                    <div className="input-group">
                      <input readOnly className="form-control" value={task.abspath} />
                      <button className="btn btn-outline-secondary" type="button" onClick={handleCopyPath} title="Copy path">
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-body">
                        <div className="d-flex align-items-center mb-2">
                          <Clock size={16} className="me-2" />
                          <div className="small fw-bold">Timing</div>
                        </div>
                        <div className="small text-muted">
                          <div className="mb-1">
                            <span className="fw-bold">Started: </span>
                            <span>{formatDate(task.start_time)}</span>
                          </div>
                          <div className="mb-1">
                            <span className="fw-bold">Finished: </span>
                            <span>{formatDate(task.finish_time)}</span>
                          </div>
                          {typeof durationSeconds === 'number' && (
                            <div>
                              <span className="fw-bold">Duration: </span>
                              <span>{formatDuration(durationSeconds)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-body">
                        <div className="d-flex align-items-center mb-2">
                          <HardDrive size={16} className="me-2" />
                          <div className="small fw-bold">Storage</div>
                        </div>
                        <div className="small text-muted">
                          <div className="mb-1">
                            <span className="fw-bold">Original: </span>
                            <span>{formatBytes(task.original_size)}</span>
                          </div>
                          <div className="mb-1">
                            <span className="fw-bold">New Size: </span>
                            <span>{task.new_size > 0 ? formatBytes(task.new_size) : '—'}</span>
                          </div>
                          {typeof savingsPercent === 'number' && (
                            <div>
                              <span className="fw-bold">Savings: </span>
                              {savingsPercent > 0 ? (
                                <span className="text-success">-{savingsPercent.toFixed(1)}%</span>
                              ) : (
                                <span className="text-warning">+{Math.abs(savingsPercent).toFixed(1)}%</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-bold">Worker</label>
                    <div className="small text-muted">{task.processed_by_worker || '—'}</div>
                  </div>

                  {task.ffmpeg_command && task.ffmpeg_command.trim() !== '' && (
                    <div className="col-12">
                      <label className="form-label small fw-bold">FFmpeg Command</label>
                      <div className="bg-dark text-light p-2 rounded font-monospace small" style={{ wordBreak: 'break-all', position: 'relative' }}>
                        <button
                          className="btn btn-sm btn-ghost-light position-absolute top-0 end-0 m-1"
                          onClick={() => navigator.clipboard.writeText(task.ffmpeg_command)}
                          title="Copy command"
                        >
                          <Copy size={14} />
                        </button>
                        <code>{task.ffmpeg_command}</code>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'log' && (
                <div>
                  <div className="bg-dark text-light p-3 rounded font-monospace small" style={{ whiteSpace: 'pre-wrap', minHeight: '300px', maxHeight: '55vh', overflowY: 'auto' }}>
                    {task.log && task.log.trim() !== '' ? task.log : 'No log data available for this task.'}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary ms-auto" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}

export default CompletedTaskModal
