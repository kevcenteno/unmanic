import React, {useState} from 'react'
import {Activity, ListOrdered, Copy} from 'lucide-react'
import {formatBytes, formatDate, formatStatus} from '../utils/utils'

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

interface PendingTaskModalProps {
  task: Task
  onClose: () => void
}

export default function PendingTaskModal({task, onClose}: PendingTaskModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(task.abspath)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      // ignore copy errors
    }
  }

  const badgeClass = task.status === 'pending'
    ? 'badge bg-blue-lt text-primary'
    : task.status === 'processing'
      ? 'badge bg-warning-lt text-warning'
      : 'badge bg-secondary-lt'

  return (
    <>
      <div className="modal modal-blur fade show d-block" tabIndex={-1} role="dialog">
        <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title">Pending Task</h5>
                <div
                  className="text-muted mt-1"
                  style={{maxWidth: '40vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}
                  title={task.abspath}
                >
                  {task.abspath}
                </div>
              </div>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>

            <div className="modal-body" style={{maxHeight: '70vh', overflowY: 'auto'}}>
              {/* Section 1: File Path */}
              <div className="mb-4">
                <label className="form-label">File Path</label>
                <div className="input-group">
                  <input type="text" className="form-control" readOnly value={task.abspath} />
                  <button type="button" className="btn btn-outline-secondary" onClick={handleCopy} title="Copy path">
                    <Copy size={16} />
                    <span className="visually-hidden">Copy</span>
                  </button>
                </div>
                {copied && <div className="form-text">Copied to clipboard</div>}
              </div>

              {/* Section 2: Status & Priority row */}
              <div className="row">
                <div className="col-md-6">
                  <div className="card mb-3">
                    <div className="card-body d-flex align-items-start">
                      <div className="me-3">
                        <Activity size={16} />
                      </div>
                      <div className="w-100">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="text-muted">Queue Status</div>
                            <div className="mt-1">
                              <span className={badgeClass}>{formatStatus(task.status)}</span>
                            </div>
                          </div>
                        </div>
                        {task.processed_by_worker && (
                          <div className="text-muted mt-2">Worker: {task.processed_by_worker}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="card mb-3">
                    <div className="card-body d-flex align-items-start">
                      <div className="me-3">
                        <ListOrdered size={16} />
                      </div>
                      <div>
                        <div className="text-muted">Queue Priority</div>
                        <div className="h3 mt-1">{task.priority}</div>
                        <div className="text-muted small">Higher number = processed sooner</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Processing Configuration datagrid */}
              <div className="card">
                <div className="card-body">
                  <h6 className="card-title">Processing Configuration</h6>
                  <div className="datagrid">
                    <div className="datagrid-item">
                      <div className="datagrid-title">Library</div>
                      <div className="datagrid-value">{task.library?.name || '—'}</div>
                    </div>
                    <div className="datagrid-item">
                      <div className="datagrid-title">Pipeline</div>
                      <div className="datagrid-value">{task.library?.pipeline?.name || '—'}</div>
                    </div>
                    <div className="datagrid-item">
                      <div className="datagrid-title">Profile</div>
                      <div className="datagrid-value">{task.profile?.name || '—'}</div>
                    </div>
                    <div className="datagrid-item">
                      <div className="datagrid-title">Original Size</div>
                      <div className="datagrid-value">{formatBytes(task.original_size)}</div>
                    </div>
                    <div className="datagrid-item">
                      <div className="datagrid-title">Added</div>
                      <div className="datagrid-value">{formatDate(task.start_time)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <div className="ms-auto">
                <button type="button" className="btn btn-primary ms-auto" onClick={onClose}>Close</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}
