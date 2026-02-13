import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ridersAPI } from '../services/api';
import Navbar from '../components/Navbar';

const emptyForm = {
  name: '',
  phone: '',
  barangay: '',
  city: '',
  province: '',
  active: true,
};

const AdminRiders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [riders, setRiders] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRiders = async () => {
    try {
      setIsLoading(true);
      const res = await ridersAPI.getAdminRiders();
      setRiders(res.data?.riders || []);
    } catch (err) {
      setError('Failed to load riders.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.is_admin) {
      loadRiders();
    } else {
      navigate('/');
    }
  }, [user, navigate]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      if (editingId) {
        await ridersAPI.updateAdminRider(editingId, form);
      } else {
        await ridersAPI.createAdminRider(form);
      }
      await loadRiders();
      resetForm();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save rider.');
    }
  };

  const handleEdit = (rider) => {
    setForm({
      name: rider.name || '',
      phone: rider.phone || '',
      barangay: rider.barangay || '',
      city: rider.city || '',
      province: rider.province || '',
      active: rider.active !== false,
    });
    setEditingId(rider.id);
  };

  const handleDelete = async (riderId) => {
    if (!window.confirm('Delete this rider?')) return;
    try {
      await ridersAPI.deleteAdminRider(riderId);
      await loadRiders();
    } catch (err) {
      setError('Failed to delete rider.');
    }
  };

  return (
    <div className="admin-riders-page">
      <Navbar />
      <section className="admin-riders-content">
        <div className="container">
          <div className="admin-riders-header">
            <h2>Rider Management</h2>
            <p>Manage delivery riders and their service areas.</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="admin-riders-grid">
            <form className="rider-form" onSubmit={handleSubmit}>
              <h3>{editingId ? 'Edit Rider' : 'Add Rider'}</h3>
              <div className="form-row">
                <label>Name</label>
                <input value={form.name} onChange={(e) => handleChange('name', e.target.value)} required />
              </div>
              <div className="form-row">
                <label>Phone</label>
                <input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} required />
              </div>
              <div className="form-row">
                <label>Barangay</label>
                <input value={form.barangay} onChange={(e) => handleChange('barangay', e.target.value)} required />
              </div>
              <div className="form-row">
                <label>City / Municipality</label>
                <input value={form.city} onChange={(e) => handleChange('city', e.target.value)} required />
              </div>
              <div className="form-row">
                <label>Province</label>
                <input value={form.province} onChange={(e) => handleChange('province', e.target.value)} required />
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => handleChange('active', e.target.checked)}
                />
                Active Rider
              </label>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">{editingId ? 'Save Changes' : 'Add Rider'}</button>
                {editingId && (
                  <button type="button" className="btn btn-outline" onClick={resetForm}>Cancel</button>
                )}
              </div>
            </form>

            <div className="rider-list">
              <h3>Active Riders</h3>
              {isLoading ? (
                <div className="loading-spinner"><i className="fas fa-spinner fa-spin"></i> Loading riders...</div>
              ) : riders.length === 0 ? (
                <div className="empty-state">No riders added yet.</div>
              ) : (
                <div className="rider-cards">
                  {riders.map((rider) => (
                    <div key={rider.id} className="rider-card">
                      <div>
                        <h4>{rider.name}</h4>
                        <p>{rider.phone}</p>
                        <p>{[rider.barangay, rider.city, rider.province].filter(Boolean).join(', ')}</p>
                        <span className={`status-pill ${rider.active ? 'active' : 'inactive'}`}>
                          {rider.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="rider-actions">
                        <button className="btn btn-outline" onClick={() => handleEdit(rider)}>Edit</button>
                        <button className="btn btn-danger" onClick={() => handleDelete(rider.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <style>{`
        .admin-riders-page {
          min-height: 100vh;
          background: #f4f6f9;
        }
        .admin-riders-content {
          padding: 30px 20px;
        }
        .admin-riders-header h2 {
          margin-bottom: 6px;
        }
        .admin-riders-header p {
          color: #6b7280;
          margin-bottom: 20px;
        }
        .admin-riders-grid {
          display: grid;
          grid-template-columns: minmax(260px, 340px) 1fr;
          gap: 20px;
          align-items: start;
        }
        .rider-form {
          background: #fff;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 6px 18px rgba(16,24,40,0.08);
        }
        .rider-form h3 {
          margin-top: 0;
          margin-bottom: 16px;
        }
        .form-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 12px;
          text-align: left;
        }
        .form-row input {
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
        }
        .checkbox-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 10px 0 18px;
          font-size: 0.9rem;
          color: #374151;
        }
        .form-actions {
          display: flex;
          gap: 10px;
        }
        .rider-list {
          background: #fff;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 6px 18px rgba(16,24,40,0.08);
        }
        .rider-cards {
          display: grid;
          gap: 14px;
        }
        .rider-card {
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 14px;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          text-align: left;
        }
        .rider-card h4 {
          margin: 0 0 6px;
        }
        .rider-card p {
          margin: 0 0 4px;
          color: #4b5563;
          font-size: 0.85rem;
        }
        .status-pill {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .status-pill.active {
          background: #ecfdf3;
          color: #2c7a2c;
        }
        .status-pill.inactive {
          background: #fef2f2;
          color: #b91c1c;
        }
        .rider-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .btn.btn-danger {
          background: #dc2626;
          color: #fff;
          border: none;
        }
        .empty-state {
          color: #6b7280;
          padding: 12px 0;
        }
        @media (max-width: 900px) {
          .admin-riders-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminRiders;
