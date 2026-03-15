import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { Plus, Trash, List, AlertTriangle, Workflow } from 'lucide-react';

interface Pipeline {
  id: number;
  name: string;
  library_id: number;
  profiles: any[];
}

const PipelineList: React.FC = () => {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchPipelines = async () => {
    setLoading(true);
    try {
      const resp = await api.get<Pipeline[]>('/pipelines');
      setPipelines(resp.data);
    } catch (err) {
      console.error('Failed to fetch pipelines', err);
      setError('Failed to load pipelines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipelines();
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this pipeline?')) return;
    try {
      await api.delete(`/pipelines/${id}`);
      fetchPipelines();
    } catch (err) {
      console.error('Failed to delete pipeline', err);
      alert('Failed to delete pipeline');
    }
  };

  return (
    <div className="container-xl">
      <div className="page-header mb-4">
        <div className="row align-items-center">
          <div className="col">
            <div className="page-pretitle">Administration</div>
            <h2 className="page-title">Processing Pipelines</h2>
          </div>
          <div className="col-auto">
            <Link to="/pipelines/new" className="btn btn-primary">
              <Plus size={18} className="me-2" /> New Pipeline
            </Link>
          </div>
        </div>
      </div>

      <div className="row row-cards">
        <div className="col-12">
          {loading ? (
            <div className="card">
              <div className="card-body text-center py-4">
                <div className="spinner-border text-primary" role="status"></div>
              </div>
            </div>
          ) : error ? (
            <div className="alert alert-danger" role="alert">
              <div className="d-flex"><AlertTriangle className="me-2" /><div>{error}</div></div>
            </div>
          ) : pipelines.length === 0 ? (
            <div className="card card-md">
              <div className="card-body text-center py-5">
                <div className="empty-img mb-3">
                  <Workflow size={64} className="text-muted opacity-25" />
                </div>
                <p className="empty-title">No pipelines configured</p>
                <p className="empty-subtitle text-muted">
                  Pipelines define how files are processed based on their metadata.
                </p>
                <div className="empty-action">
                  <Link to="/pipelines/new" className="btn btn-primary">
                    <Plus size={18} className="me-2" /> Create your first pipeline
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="table-responsive">
                <table className="table table-vcenter card-table table-hover">
                  <thead>
                    <tr>
                      <th>Pipeline Name</th>
                      <th>Profiles</th>
                      <th className="w-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelines.map((p) => (
                      <tr key={p.id}>
                        <td className="p-0">
                          <Link to={`/pipelines/${p.id}`} className="d-block p-3 text-reset text-decoration-none font-weight-medium hover-primary">
                            {p.name}
                          </Link>
                        </td>
                        <td className="p-0">
                          <Link to={`/pipelines/${p.id}`} className="d-block p-3 text-reset text-decoration-none hover-primary">
                            <span className="badge bg-blue-lt">{p.profiles?.length || 0} Profiles</span>
                          </Link>
                        </td>
                        <td>
                          <div className="btn-list flex-nowrap">
                            <button className="btn btn-icon btn-ghost-danger btn-sm" onClick={() => handleDelete(p.id)} title="Delete Pipeline">
                              <Trash size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PipelineList;
