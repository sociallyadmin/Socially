import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FiTrash2, FiUserPlus, FiShield, FiEdit2 } from 'react-icons/fi';

export default function AdminPanel({ user, apiBase }) {
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [messages, setMessages] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [tempBanModal, setTempBanModal] = useState({ show: false, userId: null });
  const [customBanDays, setCustomBanDays] = useState('');
  const [roleDropdown, setRoleDropdown] = useState(null);
  const [createUserModal, setCreateUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '' });
  const [resetPasswordModal, setResetPasswordModal] = useState({ show: false, userId: null, username: '' });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editGroupModal, setEditGroupModal] = useState({ show: false, groupId: null });
  const [editGroupData, setEditGroupData] = useState({ name: '', description: '', postingPermissions: 'everyone' });
  const [registrationCap, setRegistrationCap] = useState(null);
  const [registrationCapModal, setRegistrationCapModal] = useState(false);
  const [newCapValue, setNewCapValue] = useState('');
  const [removeCapConfirmModal, setRemoveCapConfirmModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, reportsRes, messagesRes, groupsRes] = await Promise.all([
        axios.get(`${apiBase}/admin/users`),
        axios.get(`${apiBase}/reports`),
        axios.get(`${apiBase}/contact`),
        axios.get(`${apiBase}/admin/groups`)
      ]);
      setUsers(usersRes.data);
      setReports(reportsRes.data);
      setMessages(messagesRes.data);
      setGroups(groupsRes.data);

      // Fetch registration cap if user is owner
      if (user?.role === 'owner') {
        try {
          const capRes = await axios.get(`${apiBase}/admin/registration-cap`);
          setRegistrationCap(capRes.data);
        } catch (err) {
          console.error('Failed to fetch registration cap');
        }
      }
    } catch (err) {
      console.error('Failed to fetch admin data');
    } finally {
      setLoading(false);
    }
  }, [apiBase, user?.role]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBanUser = async (userId, type, days = null) => {
    try {
      await axios.post(`${apiBase}/admin/ban`, {
        userId,
        type,
        days: type === 'temporary' ? days : null
      });
      alert(`User ${type === 'temporary' ? 'temporarily' : 'permanently'} banned`);
      setTempBanModal({ show: false, userId: null });
      fetchData();
    } catch (err) {
      console.error('Failed to ban user');
      alert('Failed to ban user');
    }
  };

  const handleTempBan = (days) => {
    if (tempBanModal.userId) {
      handleBanUser(tempBanModal.userId, 'temporary', days);
    }
  };

  // handleUnbanUser removed (not used)

  const handleAssignRole = async (userId, newRole) => {
    try {
      await axios.post(`${apiBase}/admin/role`, {
        userId,
        newRole
      });
      alert(`Role assigned: ${newRole}`);
      setRoleDropdown(null);
      fetchData();
    } catch (err) {
      console.error('Failed to assign role');
      alert('Failed to assign role');
    }
  };

  const handleRoleSelection = (role) => {
    if (roleDropdown && role) {
      handleAssignRole(roleDropdown, role);
    }
  };

  const handleRemoveRole = async (userId) => {
    try {
      await axios.delete(`${apiBase}/admin/role/${userId}`);
      alert('Role removed');
      fetchData();
    } catch (err) {
      console.error('Failed to remove role');
    }
  };

  const handleReportAction = async (reportId, action) => {
    try {
      await axios.put(`${apiBase}/reports/${reportId}`, {
        status: 'resolved',
        action
      });
      alert('Report updated');
      fetchData();
    } catch (err) {
      console.error('Failed to update report');
    }
  };

  const handleMessageStatus = async (messageId, status) => {
    try {
      await axios.put(`${apiBase}/contact/${messageId}`, {
        status
      });
      fetchData();
    } catch (err) {
      console.error('Failed to update message');
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (window.confirm(`Are you sure you want to delete ${username}? This cannot be undone.`)) {
      try {
        await axios.delete(`${apiBase}/admin/user/${userId}`);
        alert('User deleted successfully');
        fetchData();
      } catch (err) {
        console.error('Failed to delete user');
        alert('Failed to delete user');
      }
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.email || !newUser.password) {
      alert('Please fill in all fields');
      return;
    }
    try {
      await axios.post(`${apiBase}/admin/user`, newUser);
      alert('User created successfully');
      setNewUser({ username: '', email: '', password: '' });
      setCreateUserModal(false);
      fetchData();
    } catch (err) {
      console.error('Failed to create user');
      alert(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      alert('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      await axios.post(`${apiBase}/users/${resetPasswordModal.userId}/change-password`, {
        newPassword
      });
      alert(`Password reset for ${resetPasswordModal.username}`);
      setResetPasswordModal({ show: false, userId: null, username: '' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Failed to reset password');
      alert(err.response?.data?.error || 'Failed to reset password');
    }
  };

  const handleEditGroupOpen = (group) => {
    setEditGroupData({
      name: group.name,
      description: group.description,
      postingPermissions: group.postingPermissions || 'everyone'
    });
    setEditGroupModal({ show: true, groupId: group.id });
  };

  const handleUpdateGroup = async () => {
    if (!editGroupData.name.trim()) {
      alert('Group name is required');
      return;
    }

    try {
      await axios.put(`${apiBase}/admin/groups/${editGroupModal.groupId}`, editGroupData);
      alert('Group updated successfully');
      setEditGroupModal({ show: false, groupId: null });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update group');
    }
  };

  const handleSetRegistrationCap = async () => {
    const capNum = parseInt(newCapValue);
    if (!newCapValue || capNum < 1) {
      alert('Please enter a valid number greater than 0');
      return;
    }

    try {
      await axios.post(`${apiBase}/admin/registration-cap/set`, { cap: capNum });
      alert('Registration cap set successfully');
      setRegistrationCapModal(false);
      setNewCapValue('');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to set registration cap');
    }
  };

  const handleRemoveRegistrationCap = async () => {
    try {
      await axios.post(`${apiBase}/admin/registration-cap/remove`);
      alert('Registration cap removed successfully');
      setRemoveCapConfirmModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove registration cap');
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <h1 style={{ color: 'var(--primary)', marginBottom: '2rem' }}>🔧 Admin Panel</h1>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2rem', justifyContent: 'space-between' }}>
        <div className="post-tabs">
          <button
            className={`post-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button
            className={`post-tab ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            Reports
          </button>
          <button
            className={`post-tab ${activeTab === 'messages' ? 'active' : ''}`}
            onClick={() => setActiveTab('messages')}
          >
            Contact Messages
          </button>
          <button
            className={`post-tab ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            Groups
          </button>
          {user?.role === 'owner' && (
            <button
              className={`post-tab ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Settings
            </button>
          )}
        </div>
        {user?.role === 'owner' && activeTab === 'users' && (
          <button
            className="btn btn-primary"
            onClick={() => setCreateUserModal(true)}
          >
            <FiUserPlus /> Create User
          </button>
        )}
      </div>

      {activeTab === 'users' && (
        <div className="admin-panel">
          <div className="admin-card" style={{ gridColumn: '1 / -1' }}>
            <h3>👥 Users Management</h3>
            <ul className="admin-list">
              {users.map(u => (
                <li key={u.id} className="admin-list-item">
                  <div className="admin-list-item-info">
                    <div className="admin-list-item-name">{u.username}</div>
                    <div className="admin-list-item-email">{u.email}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.25rem' }}>
                      Role: {u.role}
                    </div>
                  </div>
                  <div className="admin-list-item-actions">
                    {u.role !== 'owner' && (
                      <>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => setRoleDropdown(roleDropdown === u.id ? null : u.id)}
                          >
                            <FiShield /> Role
                          </button>
                          {roleDropdown === u.id && (
                            <div className="admin-dropdown">
                              <div onClick={() => handleRoleSelection('moderator')}>Moderator</div>
                              <div onClick={() => handleRoleSelection('admin')}>Admin</div>
                              <div onClick={() => handleRoleSelection('co-owner')}>Co-owner</div>
                              <div onClick={() => handleRoleSelection('secondary-owner')}>Secondary-owner</div>
                            </div>
                          )}
                        </div>
                        {user?.role === 'owner' && (
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--accent)', color: 'white' }}
                            onClick={() => setResetPasswordModal({ show: true, userId: u.id, username: u.username })}
                          >
                            Reset Password
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-warning"
                          style={{ background: 'var(--warning)', color: 'white' }}
                          onClick={() => setTempBanModal({ show: true, userId: u.id })}
                        >
                          Ban (Temp)
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => {
                            if (window.confirm('Permanently ban this user?')) {
                              handleBanUser(u.id, 'permanent');
                            }
                          }}
                        >
                          Ban (Perm)
                        </button>
                      </>
                    )}
                    {u.role !== 'user' && (
                      <button
                        className="btn btn-sm"
                        style={{ background: 'var(--text-light)', color: 'white' }}
                        onClick={() => handleRemoveRole(u.id)}
                      >
                        Remove Role
                      </button>
                    )}
                    {user?.role === 'owner' && user?.id !== u.id && (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteUser(u.id, u.username)}
                      >
                        <FiTrash2 /> Delete
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tempBanModal.show && (
        <div className="admin-modal-overlay" onClick={() => setTempBanModal({ show: false, userId: null })}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Select Ban Duration</h3>
            <div className="admin-modal-buttons">
              <button
                className="btn btn-sm"
                style={{ background: 'var(--primary)', color: 'white' }}
                onClick={() => handleTempBan(3)}
              >
                3 Days
              </button>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--primary)', color: 'white' }}
                onClick={() => handleTempBan(7)}
              >
                7 Days
              </button>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--primary)', color: 'white' }}
                onClick={() => handleTempBan(14)}
              >
                14 Days
              </button>
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="number"
                placeholder="Custom days"
                value={customBanDays}
                onChange={(e) => setCustomBanDays(e.target.value)}
                min="1"
                style={{ padding: '0.5rem', flex: 1 }}
              />
              <button
                className="btn btn-sm"
                style={{ background: 'var(--accent)', color: 'white' }}
                onClick={() => {
                  const days = parseInt(customBanDays);
                  if (days && days > 0) {
                    handleTempBan(days);
                    setCustomBanDays('');
                  }
                }}
              >
                Apply
              </button>
            </div>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setTempBanModal({ show: false, userId: null })}
              style={{ marginTop: '1rem', width: '100%' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="admin-panel">
          <div className="admin-card" style={{ gridColumn: '1 / -1' }}>
            <h3>🚩 Reports</h3>
            <ul className="admin-list">
              {reports.map(report => (
                <li key={report.id} className="admin-list-item">
                  <div className="admin-list-item-info">
                    <div className="admin-list-item-name">Report: {report.reason}</div>
                    <div className="admin-list-item-email">Target: {report.targetType}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                      {report.description}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.25rem' }}>
                      Status: {report.status}
                    </div>
                  </div>
                  <div className="admin-list-item-actions">
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleReportAction(report.id, 'approved')}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleReportAction(report.id, 'rejected')}
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="admin-panel">
          <div className="admin-card" style={{ gridColumn: '1 / -1' }}>
            <h3>📧 Contact Messages</h3>
            <ul className="admin-list">
              {messages.map(msg => (
                <li key={msg.id} className="admin-list-item">
                  <div className="admin-list-item-info">
                    <div className="admin-list-item-name">{msg.subject}</div>
                    <div className="admin-list-item-email">From: {msg.email}</div>
                    <div style={{ fontSize: '0.85rem', margin: '0.5rem 0', color: 'var(--text-dark)' }}>
                      {msg.message}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                      Status: {msg.status}
                    </div>
                  </div>
                  <div className="admin-list-item-actions">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleMessageStatus(msg.id, 'read')}
                    >
                      Mark Read
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="admin-panel">
          <div className="admin-card" style={{ gridColumn: '1 / -1' }}>
            <h3>👥 Groups Management</h3>
            <ul className="admin-list">
              {groups.map(g => (
                <li key={g.id} className="admin-list-item">
                  <div className="admin-list-item-info">
                    <div className="admin-list-item-name">{g.name}</div>
                    <div className="admin-list-item-email">{g.description || 'No description'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                      Owner: {g.members.find(m => m.role === 'owner')?.username} | Members: {g.members.length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.25rem' }}>
                      Posting: {g.postingPermissions || 'everyone'}
                    </div>
                  </div>
                  <div className="admin-list-item-actions">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleEditGroupOpen(g)}
                    >
                      <FiEdit2 /> Edit
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {createUserModal && user?.role === 'owner' && (
        <div className="admin-modal-overlay" onClick={() => setCreateUserModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create New User</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <input
                type="text"
                placeholder="Username"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}
              />
              <input
                type="email"
                placeholder="Email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}
              />
              <input
                type="password"
                placeholder="Password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                className="btn btn-primary"
                onClick={handleCreateUser}
                style={{ flex: 1 }}
              >
                Create User
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setCreateUserModal(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {resetPasswordModal.show && (
        <div className="admin-modal-overlay" onClick={() => setResetPasswordModal({ show: false, userId: null, username: '' })}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reset Password for {resetPasswordModal.username}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}
              />
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                className="btn btn-primary"
                onClick={handleResetPassword}
                style={{ flex: 1 }}
              >
                Reset Password
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setResetPasswordModal({ show: false, userId: null, username: '' })}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && user?.role === 'owner' && (
        <div className="admin-panel">
          <div className="admin-card" style={{ gridColumn: '1 / -1' }}>
            <h3>⚙️ Admin Settings</h3>
            <div style={{ marginTop: '2rem' }}>
              <h4 style={{ marginBottom: '1rem' }}>📝 Registration Cap Management</h4>
              {registrationCap?.cap ? (
                <div style={{ background: 'var(--bg-light)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Current Cap:</strong> {registrationCap.currentCount}/{registrationCap.cap}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => setRegistrationCapModal(true)}
                    >
                      Change Cap
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => setRemoveCapConfirmModal(true)}
                      style={{ background: 'var(--warning)', color: 'white' }}
                    >
                      Remove Cap
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ background: 'var(--bg-light)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                  <div style={{ marginBottom: '1rem', color: 'var(--text-light)' }}>
                    No registration cap is currently set. All users can register.
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => setRegistrationCapModal(true)}
                  >
                    Set Registration Cap
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {registrationCapModal && (
        <div className="admin-modal-overlay" onClick={() => setRegistrationCapModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{registrationCap?.cap ? 'Change' : 'Set'} Registration Cap</h3>
            <p style={{ color: 'var(--text-light)', marginTop: '0.5rem', marginBottom: '1rem' }}>
              {registrationCap?.cap ? `Current cap: ${registrationCap.currentCount}/${registrationCap.cap}` : 'Set the maximum number of users that can register for your platform during beta.'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Maximum Users</label>
                <input
                  type="number"
                  placeholder="e.g., 100"
                  value={newCapValue}
                  onChange={(e) => setNewCapValue(e.target.value)}
                  min="1"
                  style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', width: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                className="btn btn-primary"
                onClick={handleSetRegistrationCap}
                style={{ flex: 1 }}
              >
                {registrationCap?.cap ? 'Update' : 'Set'} Cap
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setRegistrationCapModal(false);
                  setNewCapValue('');
                }}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {removeCapConfirmModal && (
        <div className="admin-modal-overlay" onClick={() => setRemoveCapConfirmModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Remove Registration Cap?</h3>
            <p style={{ color: 'var(--text-light)', marginTop: '1rem', marginBottom: '1.5rem' }}>
              Are you sure you want to remove the registration cap? Users will be able to register without limit.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn btn-danger"
                onClick={handleRemoveRegistrationCap}
                style={{ background: 'var(--warning)', color: 'white', flex: 1 }}
              >
                Yes, Remove Cap
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setRemoveCapConfirmModal(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {editGroupModal.show && (
        <div className="admin-modal-overlay" onClick={() => setEditGroupModal({ show: false, groupId: null })}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Group</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Group Name</label>
                <input
                  type="text"
                  value={editGroupData.name}
                  onChange={(e) => setEditGroupData({ ...editGroupData, name: e.target.value })}
                  style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Description</label>
                <textarea
                  value={editGroupData.description}
                  onChange={(e) => setEditGroupData({ ...editGroupData, description: e.target.value })}
                  style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', width: '100%', minHeight: '80px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Posting Permissions</label>
                <select
                  value={editGroupData.postingPermissions}
                  onChange={(e) => setEditGroupData({ ...editGroupData, postingPermissions: e.target.value })}
                  style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', width: '100%' }}
                >
                  <option value="everyone">Everyone</option>
                  <option value="moderator">Moderator+</option>
                  <option value="admin">Admin+</option>
                  <option value="owner">Owner Only</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                className="btn btn-primary"
                onClick={handleUpdateGroup}
                style={{ flex: 1 }}
              >
                Update Group
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setEditGroupModal({ show: false, groupId: null })}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
