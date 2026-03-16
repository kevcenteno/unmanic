import React, { useState } from 'react'
import { Info, Copy, Clock, HardDrive, FileText } from 'lucide-react'
import { formatBytes, formatDate, formatStatus } from '../utils/utils'

interface TaskDetailsModalProps {
  task: any
  onClose: () => void
}

const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({ task, onClose }) => {
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
        <div className="modal-dialog modal-xl modal-dialog-centered" role="document">
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
                            {task.status ? formatStatus(task.status) : (task.task_success ? 'Success' : 'Failed')}
                          </span>
                        </div>
                      </div>
                      <div className="datagrid-item">
                        <div className="datagrid-title">Worker</div>
                        <div className="datagrid-content">{task.processed_by_worker || 'N/A'}</div>
                      </div>
                      <div className="datagrid-item">
                        <div className="datagrid-title">Library</div>
                        <div className="datagrid-content">{task.library?.name || 'N/A'}</div>
                      </div>
                      <div className="datagrid-item">
                        <div className="datagrid-title">Pipeline</div>
                        <div className="datagrid-content">{task.library?.pipeline?.name || 'N/A'}</div>
                      </div>
                      <div className="datagrid-item">
                        <div className="datagrid-title">Profile</div>
                        <div className="datagrid-content">{task.profile?.name || 'N/A'}</div>
                      </div>
                    </div>
                  </div>

                  {task.ffmpeg_command && (
                    <div className="col-12 mt-3">
                      <label className="form-label small font-weight-bold">FFmpeg Command</label>
                      <div className="bg-dark text-light p-2 rounded font-monospace small" style={{ wordBreak: 'break-all' }}>
                        <code>{task.ffmpeg_command}</code>
                      </div>
                    </div>
                  )}
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

export default TaskDetailsModal