import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiArrowRight, FiTrash2, FiSearch } from 'react-icons/fi';

export default function Groups({ user, apiBase }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteSearchQuery, setDeleteSearchQuery] = useState('');
  const [deleteSearchResults, setDeleteSearchResults] = useState([]);
  const [deletingGroupId, setDeletingGroupId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async function fetchGroupsInside() {
      try {
        const response = await axios.get(`${apiBase}/groups`);
        setGroups(response.data);
      } catch (err) {
        console.error('Failed to fetch groups');
        setError('Failed to load groups');
      } finally {
        setLoading(false);
      }
    })();
  }, [apiBase]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }

    setCreating(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(`${apiBase}/groups`, {
        name: groupName,
        description: groupDescription
      });
      setGroups([...groups, response.data]);
      setGroupName('');
      setGroupDescription('');
      setShowCreateModal(false);
      setSuccess('Group created successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleSearchDeleteGroups = () => {
    const query = deleteSearchQuery.toLowerCase().trim();
    if (!query) {
      setDeleteSearchResults([]);
      return;
    }

    // Only show search results if user is a platform admin/owner
    if (!isUserPlatformAdmin()) {
      setDeleteSearchResults([]);
      return;
    }

    const results = groups.filter(g => 
      g.name.toLowerCase().includes(query)
    );
    setDeleteSearchResults(results);
  };

  const isUserPlatformAdmin = () => {
    // This is checked on frontend for UX only
    // Backend will enforce authorization on delete
    return !!user; // Backend will verify actual role
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      return;
    }

    setDeletingGroupId(groupId);
    setError('');

    try {
      await axios.delete(`${apiBase}/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setGroups(groups.filter(g => g.id !== groupId));
      setDeleteSearchResults(deleteSearchResults.filter(g => g.id !== groupId));
      setSuccess('Group deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete group');
    } finally {
      setDeletingGroupId(null);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="groups-container">
      <div className="groups-header">
        <h1>Groups</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          <FiPlus size={20} /> Create Group
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button onClick={() => setError('')}>&times;</button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
          <button onClick={() => setSuccess('')}>&times;</button>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Group</h2>
            <form onSubmit={handleCreateGroup}>
              <div className="form-group">
                <label htmlFor="group-name">Group Name *</label>
                <input
                  id="group-name"
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name"
                  maxLength={100}
                />
              </div>
              <div className="form-group">
                <label htmlFor="group-desc">Description</label>
                <textarea
                  id="group-desc"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="Enter group description"
                  maxLength={500}
                  rows={4}
                />
              </div>
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>
          <FiTrash2 style={{ display: 'inline', marginRight: '8px' }} />
          Platform Admin: Delete Any Group
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Search group by name..."
            value={deleteSearchQuery}
            onChange={(e) => setDeleteSearchQuery(e.target.value)}
            onKeyUp={handleSearchDeleteGroups}
            style={{
              flex: 1,
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
          <button
            onClick={handleSearchDeleteGroups}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <FiSearch size={16} /> Search
          </button>
        </div>

        {deleteSearchResults.length > 0 && (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {deleteSearchResults.map(group => (
              <div
                key={group.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  borderBottom: '1px solid #e5e7eb',
                  backgroundColor: 'white',
                  marginBottom: '0.5rem',
                  borderRadius: '4px'
                }}
              >
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0' }}>{group.name}</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                    {group.members?.length || 0} members • Created {new Date(group.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteGroup(group.id)}
                  disabled={deletingGroupId === group.id}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: deletingGroupId === group.id ? 'not-allowed' : 'pointer',
                    opacity: deletingGroupId === group.id ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '14px',
                    fontWeight: 500
                  }}
                >
                  <FiTrash2 size={16} />
                  {deletingGroupId === group.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
        {deleteSearchQuery && deleteSearchResults.length === 0 && (
          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
            No groups found matching "{deleteSearchQuery}". Only platform admins, co-owners, secondary owners, and owner can delete groups.
          </p>
        )}
      </div>

      <div className="groups-list">
        {groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <h3>No groups yet</h3>
            <p>Create your first group to get started!</p>
          </div>
        ) : (
          groups.map(group => (
            <div 
              key={group.id} 
              className="group-card"
              onClick={() => navigate(`/groups/${group.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <div className="group-card-header">
                <div className="group-info">
                  <h3>{group.name}</h3>
                  <p className="group-description">{group.description}</p>
                  <div className="group-meta">
                    <span className="member-count">
                      👥 {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
                    </span>
                    <span className="group-owner">
                      Owner: {group.members.find(m => m.role === 'owner')?.username}
                    </span>
                  </div>
                </div>
                <div className="group-actions">
                  <button 
                    className="btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/groups/${group.id}`);
                    }}
                  >
                    <FiArrowRight size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
