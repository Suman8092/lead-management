import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { MdAdd, MdClose, MdEdit, MdPeople, MdTrendingUp, MdCheckCircle, MdWarning, MdEmail, MdPhone } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';

function AddMemberModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'member' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      toast.success('Team member added!');
      onSave();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add member'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal small">
        <div className="modal-header">
          <h2>Add Team Member</h2>
          <button onClick={onClose} className="modal-close"><MdClose /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label>Full Name *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Name" />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 6 chars" minLength={6} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" />
              </div>
              <div className="form-group full-width">
                <label>Role</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <span className="btn-spinner"></span> : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EarningsModal({ member, onClose, onSave }) {
  const [earnings, setEarnings] = useState({ total: member?.earnings?.total || 0, thisMonth: member?.earnings?.thisMonth || 0, thisWeek: member?.earnings?.thisWeek || 0 });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put(`/users/${member._id}/earnings`, { earnings });
      toast.success('Earnings updated');
      onSave();
    } catch { toast.error('Failed to update'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal small">
        <div className="modal-header">
          <h2>Update Earnings — {member?.name}</h2>
          <button onClick={onClose} className="modal-close"><MdClose /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Total Earnings (₹)</label>
              <input type="number" value={earnings.total} onChange={e => setEarnings({ ...earnings, total: e.target.value })} />
            </div>
            <div className="form-group">
              <label>This Month (₹)</label>
              <input type="number" value={earnings.thisMonth} onChange={e => setEarnings({ ...earnings, thisMonth: e.target.value })} />
            </div>
            <div className="form-group">
              <label>This Week (₹)</label>
              <input type="number" value={earnings.thisWeek} onChange={e => setEarnings({ ...earnings, thisWeek: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleSave} className="btn-primary" disabled={loading}>
            {loading ? <span className="btn-spinner"></span> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Team() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [earningsModal, setEarningsModal] = useState(null);

  const loadTeam = async () => {
    setLoading(true);
    try {
      const [mRes, pRes] = await Promise.all([
        api.get('/users'),
        api.get('/dashboard/team-performance')
      ]);
      setMembers(mRes.data.users || []);
      setPerformance(pRes.data.performance || []);
    } catch { toast.error('Failed to load team'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadTeam(); }, []);

  const getPerfData = (memberId) => performance.find(p => p._id === memberId);

  return (
    <div className="page team-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Team</h1>
          <p className="page-subtitle">{members.length} members</p>
        </div>
        {user?.role === 'admin' && (
          <button className="btn-primary" onClick={() => setShowAdd(true)}><MdAdd /> Add Member</button>
        )}
      </div>

      {loading ? (
        <div className="page-loader"><div className="loading-spinner"></div></div>
      ) : (
        <div className="team-grid">
          {members.map(member => {
            const perf = getPerfData(member._id);
            const convRate = perf ? perf.conversionRate : 0;
            return (
              <div key={member._id} className="team-card">
                <div className="tc-header">
                  <div className="tc-avatar">
                    {member.avatar ? <img src={member.avatar} alt={member.name} /> : <span>{member.name?.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="tc-info">
                    <div className="tc-name">{member.name}</div>
                    <div className="tc-role">{member.role}</div>
                    <div className="tc-email"><MdEmail /> {member.email}</div>
                    {member.phone && <div className="tc-phone"><MdPhone /> {member.phone}</div>}
                  </div>
                </div>

                <div className="tc-stats">
                  <div className="tc-stat">
                    <div className="tc-stat-value">{perf?.totalLeads || 0}</div>
                    <div className="tc-stat-label">Total Leads</div>
                  </div>
                  <div className="tc-stat green">
                    <div className="tc-stat-value">{perf?.converted || 0}</div>
                    <div className="tc-stat-label">Converted</div>
                  </div>
                  <div className="tc-stat blue">
                    <div className="tc-stat-value">{perf?.completedToday || 0}/{perf?.followupsToday || 0}</div>
                    <div className="tc-stat-label">Today Followups</div>
                  </div>
                  <div className="tc-stat red">
                    <div className="tc-stat-value">{perf?.missed || 0}</div>
                    <div className="tc-stat-label">Missed</div>
                  </div>
                </div>

                {/* Conversion Rate Bar */}
                <div className="tc-conversion">
                  <div className="tc-conv-header">
                    <span>Conversion Rate</span>
                    <strong>{convRate}%</strong>
                  </div>
                  <div className="tc-conv-bar">
                    <div className="tc-conv-fill" style={{ width: `${convRate}%` }}></div>
                  </div>
                </div>

                {/* Earnings */}
                <div className="tc-earnings">
                  <div className="tc-earning-item">
                    <span>Total</span>
                    <strong>₹{(member.earnings?.total || 0).toLocaleString()}</strong>
                  </div>
                  <div className="tc-earning-item">
                    <span>This Month</span>
                    <strong>₹{(member.earnings?.thisMonth || 0).toLocaleString()}</strong>
                  </div>
                  <div className="tc-earning-item">
                    <span>This Week</span>
                    <strong>₹{(member.earnings?.thisWeek || 0).toLocaleString()}</strong>
                  </div>
                </div>

                {user?.role !== 'member' && (
                  <div className="tc-footer">
                    <button className="btn-sm blue" onClick={() => setEarningsModal(member)}>
                      <MdEdit /> Update Earnings
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <AddMemberModal onClose={() => setShowAdd(false)} onSave={() => { setShowAdd(false); loadTeam(); }} />}
      {earningsModal && <EarningsModal member={earningsModal} onClose={() => setEarningsModal(null)} onSave={() => { setEarningsModal(null); loadTeam(); }} />}
    </div>
  );
}
