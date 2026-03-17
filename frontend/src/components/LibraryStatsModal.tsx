import React, { useEffect, useState } from 'react'
import { api } from '../context/AuthContext'
import { formatBytes } from '../utils/utils'
import { HardDrive, BarChart2, X } from 'lucide-react'

interface ProfileStats {
  profile_id: number | null
  name: string
  files_processed: number
  original_size: number
  new_size: number
}

interface LibraryStats {
  library_id: number
  library_name: string
  files_processed: number
  original_size: number
  new_size: number
  profiles: ProfileStats[]
}

interface LibraryStatsModalProps {
  libraryId: number
  libraryName: string
  onClose: () => void
}

const calcSaved = (orig: number, newS: number) => {
  const saved = orig - newS
  const pct = orig > 0 ? (saved / orig) * 100 : 0
  return { saved, pct }
}

const LibraryStatsModal: React.FC<LibraryStatsModalProps> = ({ libraryId, libraryName, onClose }) => {
  const [stats, setStats] = useState<LibraryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true)
      setError(null)
      try {
        const resp = await api.get<LibraryStats>(`/libraries/${libraryId}/stats`)
        setStats(resp.data)
      } catch (err) {
        setError('Failed to load stats')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [libraryId])

  const overall = stats ? calcSaved(stats.original_size, stats.new_size) : null

  return (
    <>
      <div className="modal modal-blur fade show d-block" tabIndex={-1} role="dialog">
        <div className="modal-dialog modal-xl modal-dialog-centered" role="document">
          <div className="modal-content">

            {/* Header */}
            <div className="modal-header">
              <div className="d-flex align-items-center">
                <BarChart2 size={20} className="me-2 text-primary" />
                <div>
                  <h5 className="modal-title mb-0">Transcode Savings</h5>
                  <div className="text-muted small">{libraryName}</div>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>

            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              {loading && (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status" />
                  <div className="mt-2 text-muted">Loading stats...</div>
                </div>
              )}

              {error && (
                <div className="alert alert-danger">{error}</div>
              )}

              {!loading && !error && stats && (
                <>
                  {/* Summary cards */}
                  <div className="row g-3 mb-4">
                    <div className="col-6 col-md-3 d-flex">
                      <div className="card card-sm w-100">
                        <div className="card-body text-center">
                          <div className="text-muted small mb-1">Files Processed</div>
                          <div className="h3 mb-0">{stats.files_processed.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3 d-flex">
                      <div className="card card-sm w-100">
                        <div className="card-body text-center">
                          <div className="text-muted small mb-1">Original Size</div>
                          <div className="h3 mb-0">{formatBytes(stats.original_size)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3 d-flex">
                      <div className="card card-sm w-100">
                        <div className="card-body text-center">
                          <div className="text-muted small mb-1">New Size</div>
                          <div className="h3 mb-0">{formatBytes(stats.new_size)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3 d-flex">
                      <div className="card card-sm w-100">
                        <div className="card-body text-center">
                          <div className="text-muted small mb-1">Space Saved</div>
                          {overall && overall.saved > 0 ? (
                            <>
                              <div className="h3 mb-0 text-success">{formatBytes(overall.saved)}</div>
                              <div className="text-success small">{overall.pct.toFixed(1)}% reduction</div>
                            </>
                          ) : (
                            <div className="h3 mb-0 text-muted">—</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Profile breakdown table */}
                  {stats.profiles.length > 0 ? (
                    <>
                      <h5 className="mb-3 d-flex align-items-center">
                        <HardDrive size={16} className="me-2" />
                        Breakdown by Profile
                      </h5>
                      <div className="table-responsive">
                        <table className="table table-vcenter table-hover">
                          <thead>
                            <tr>
                              <th>Profile</th>
                              <th className="text-end">Files</th>
                              <th className="text-end">Original</th>
                              <th className="text-end">New Size</th>
                              <th className="text-end">Saved</th>
                              <th className="text-end">% Saved</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.profiles.map((p, idx) => {
                              const { saved, pct } = calcSaved(p.original_size, p.new_size)
                              return (
                                <tr key={p.profile_id ?? `unknown-${idx}`}>
                                  <td>
                                    <span className="badge bg-purple-lt">{p.name}</span>
                                  </td>
                                  <td className="text-end">{p.files_processed.toLocaleString()}</td>
                                  <td className="text-end text-muted">{formatBytes(p.original_size)}</td>
                                  <td className="text-end text-muted">{formatBytes(p.new_size)}</td>
                                  <td className="text-end">
                                    {saved > 0 ? (
                                      <span className="text-success fw-bold">{formatBytes(saved)}</span>
                                    ) : (
                                      <span className="text-muted">—</span>
                                    )}
                                  </td>
                                  <td className="text-end">
                                    {saved > 0 ? (
                                      <span className="text-success">{pct.toFixed(1)}%</span>
                                    ) : (
                                      <span className="text-muted">—</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-muted py-4">
                      No profile breakdown available.
                    </div>
                  )}
                </>
              )}

              {!loading && !error && stats && stats.files_processed === 0 && (
                <div className="empty py-4">
                  <div className="empty-title">No processed files yet</div>
                  <div className="empty-subtitle text-muted">
                    Stats will appear here once files have been successfully transcoded.
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary ms-auto" onClick={onClose}>
                <X size={16} className="me-1" /> Close
              </button>
            </div>

          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}

export default LibraryStatsModal
