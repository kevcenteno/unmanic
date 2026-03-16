import React from 'react'
import { ActiveWorkerStat, useWebSocket } from '../context/WebSocketContext'
import { api } from '../context/AuthContext'
import { Clock, Cpu, HardDrive, FileText, Activity, Pause, Play, XOctagon } from 'lucide-react'
import { formatTime } from '../utils/utils'

interface WorkerDetailsModalProps {
  workerName: string
  stat?: ActiveWorkerStat
  onClose: () => void
}

const WorkerDetailsModal: React.FC<WorkerDetailsModalProps> = ({ workerName, stat, onClose }) => {
  const { status } = useWebSocket()
  const isPaused = status?.workers.paused_workers?.[workerName] || false

  const handlePause = async () => {
    try {
      await api.post(`/workers/${workerName}/pause`)
    } catch (err) {
      console.error('Failed to pause worker', err)
    }
  }

  const handleResume = async () => {
    try {
      await api.post(`/workers/${workerName}/resume`)
    } catch (err) {
      console.error('Failed to resume worker', err)
    }
  }

  const handleKill = async () => {
    if (!window.confirm(`Are you sure you want to kill ${workerName}? This will stop the current transcode.`)) return
    try {
      await api.post(`/workers/${workerName}/kill`)
      onClose()
    } catch (err) {
      console.error('Failed to kill worker', err)
    }
  }

  return (
    <>
      <div className="modal modal-blur fade show d-block" tabIndex={-1} role="dialog">
        <div className="modal-dialog modal-xl modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title d-flex align-items-center">
                {workerName} Details
                {isPaused && <span className="badge bg-warning-lt ms-2">Paused</span>}
              </h5>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>

            <div className="modal-body">
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label text-muted small mb-1">Processing File</label>
                  <div className="input-group">
                    <input type="text" className="form-control" value={stat?.abspath || 'No active task'} readOnly />
                  </div>
                </div>

                {stat ? (
                  <>
                    <div className="col-12 mb-3">
                      <div className="d-flex justify-content-between mb-1">
                        <span className="small text-muted">Transcode Progress</span>
                        <span className="small fw-bold">{stat.percentage.toFixed(1)}%</span>
                      </div>
                      <div className="progress progress-sm">
                        <div 
                          className="progress-bar bg-primary" 
                          style={{ width: `${stat.percentage}%` }} 
                          role="progressbar" 
                          aria-valuenow={stat.percentage} 
                          aria-valuemin={0} 
                          aria-valuemax={100}
                        ></div>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <div className="card bg-light border-0 h-100">
                        <div className="card-body p-3">
                          <div className="d-flex align-items-center mb-2">
                            <Activity size={16} className="text-muted me-2" />
                            <div className="text-muted small fw-bold">Resource Usage</div>
                          </div>
                          <div className="d-flex justify-content-between mb-1 small">
                            <span>CPU:</span>
                            <strong className={stat.cpu_usage > 80 ? 'text-danger' : ''}>{stat.cpu_usage.toFixed(1)}%</strong>
                          </div>
                          <div className="d-flex justify-content-between small">
                            <span>Memory:</span>
                            <strong>{stat.mem_usage.toFixed(1)} MB</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <div className="card bg-light border-0 h-100">
                        <div className="card-body p-3">
                          <div className="d-flex align-items-center mb-2">
                            <Clock size={16} className="text-muted me-2" />
                            <div className="text-muted small fw-bold">Timing</div>
                          </div>
                          <div className="d-flex justify-content-between mb-1 small">
                            <span>Elapsed:</span>
                            <strong>{formatTime(stat.elapsed)}</strong>
                          </div>
                          <div className="d-flex justify-content-between small">
                            <span>ETA:</span>
                            <strong>{stat.eta > 0 ? formatTime(stat.eta) : 'Estimating...'}</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="col-12 mt-3">
                      <label className="form-label text-muted small mb-1">Current FFmpeg Command</label>
                      <div className="bg-dark text-light p-2 rounded font-monospace small" style={{ wordBreak: 'break-all' }}>
                        <code>{stat.ffmpeg_command}</code>
                      </div>
                    </div>

                    <div className="col-12 mt-3">
                      <label className="form-label text-muted small mb-1 d-flex align-items-center">
                        <FileText size={14} className="me-1"/> Live Output (Latest Line)
                      </label>
                      <div className="bg-dark text-light p-3 rounded font-monospace small" style={{ minHeight: '60px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {stat.current_log || 'Waiting for output...'}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="col-12">
                    <div className="alert alert-info bg-info-lt border-0">
                      This worker is currently idle and waiting for new tasks.
                    </div>
                  </div>
                )}

              </div>
            </div>
            <div className="modal-footer">
              <div className="btn-list">
                {isPaused ? (
                  <button className="btn btn-outline-success" onClick={handleResume}>
                    <Play size={16} className="me-2" /> Resume Worker
                  </button>
                ) : (
                  <button className="btn btn-outline-warning" onClick={handlePause}>
                    <Pause size={16} className="me-2" /> Pause Worker
                  </button>
                )}
                {stat && (
                  <button className="btn btn-outline-danger" onClick={handleKill}>
                    <XOctagon size={16} className="me-2" /> Kill Current Task
                  </button>
                )}
              </div>
              <button className="btn btn-primary ms-auto" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}

export default WorkerDetailsModal