import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, ShieldAlert, CheckCircle, XCircle, Key, Battery, Save } from 'lucide-react';
import { usersApi, devicesApi } from '../api/endpoints';

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', full_name: '', password: '', role: 'user' });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getUsers
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: devicesApi.getDevices
  });

  const createMutation = useMutation({
    mutationFn: usersApi.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsCreating(false);
      setNewUser({ email: '', full_name: '', password: '', role: 'user' });
    }
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, isActive }) => usersApi.setActive(userId, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
  });

  const assignDeviceMutation = useMutation({
    mutationFn: ({ userId, deviceId }) => usersApi.assignDevice(userId, deviceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
  });

  const unassignDeviceMutation = useMutation({
    mutationFn: ({ userId, deviceId }) => usersApi.unassignDevice(userId, deviceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
  });

  const handleCreateUser = (e) => {
    e.preventDefault();
    createMutation.mutate(newUser);
  };

  return (
    <div className="animate-in">
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={24} color="var(--accent-primary)" />
            User Management
          </h2>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Manage portal access, roles, and device assignments
          </div>
        </div>
        <button className="btn-primary" onClick={() => setIsCreating(!isCreating)}>
          <UserPlus size={16} />
          {isCreating ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {isCreating && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--accent-primary)' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Create New User</h3>
          <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Email</label>
              <input required type="email" className="form-input" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="email@example.com" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Full Name</label>
              <input required type="text" className="form-input" value={newUser.full_name} onChange={e => setNewUser({...newUser, full_name: e.target.value})} placeholder="John Doe" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Password</label>
              <input required type="password" className="form-input" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="Initial Password" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Role</label>
              <select className="form-input" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                <option value="user">User (Device Scoped)</option>
                <option value="admin">Admin (Fleet Scoped)</option>
              </select>
            </div>
            <button type="submit" className="btn-primary" disabled={createMutation.isLoading}>
              <Save size={16} />
              {createMutation.isLoading ? 'Saving...' : 'Create'}
            </button>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading users...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--bg-secondary)' }}>
                <tr>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>User</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Role</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assigned Devices</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--border-light)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 600 }}>{user.full_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{user.email}</div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`badge badge-${user.role === 'admin' ? 'warning' : 'info'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`badge badge-${user.is_active ? 'success' : 'danger'}`}>
                        {user.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {user.role === 'admin' ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>All Devices (Admin)</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                          {user.devices?.map(d => (
                            <span key={d.id} className="badge badge-neutral" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Battery size={10} /> {d.serial_number}
                              <button 
                                onClick={() => unassignDeviceMutation.mutate({ userId: user.id, deviceId: d.id })}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: '0.25rem', color: 'var(--text-muted)' }}
                                title="Remove Assignment"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                          <select 
                            className="form-input" 
                            style={{ padding: '0.1rem 0.5rem', fontSize: '0.75rem', width: 'auto', background: 'transparent' }}
                            value=""
                            onChange={(e) => e.target.value && assignDeviceMutation.mutate({ userId: user.id, deviceId: e.target.value })}
                          >
                            <option value="">+ Assign...</option>
                            {devices.filter(d => !user.devices?.find(ud => ud.id === d.id)).map(d => (
                              <option key={d.id} value={d.id}>{d.serial_number}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <button 
                        className={`btn-${user.is_active ? 'danger' : 'success'}`}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={() => statusMutation.mutate({ userId: user.id, isActive: !user.is_active })}
                      >
                        {user.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
