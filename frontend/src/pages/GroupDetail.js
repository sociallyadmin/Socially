import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiTrash2, FiX, FiUserPlus, FiSlash, FiUnlock, FiArrowRight } from 'react-icons/fi';

export default function GroupDetail({ user, apiBase }) {
  const { groupId } = useParams();
  const navigate = useNavigate();
  
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [bannedMembers, setBannedMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPostingPermissions, setEditPostingPermissions] = useState('everyone');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedTransfeeUser, setSelectedTransfeeUser] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [transferring, setTransferring] = useState(false);
  
  const [groupPosts, setGroupPosts] = useState([]);
  const [postContent, setPostContent] = useState('');
  const [posting, setPosting] = useState(false);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    (async function fetchGroupDataInside() {
      try {
        setLoading(true);
        const [groupRes, membersRes, postsRes] = await Promise.all([
          axios.get(`${apiBase}/groups/${groupId}`),
          axios.get(`${apiBase}/groups/${groupId}/members`),
          axios.get(`${apiBase}/groups/${groupId}/posts`).catch(() => ({ data: [] }))
        ]);
        setGroup(groupRes.data);
        setMembers(membersRes.data);
        setGroupPosts(postsRes.data || []);
        setEditName(groupRes.data.name);
        setEditDescription(groupRes.data.description);
        setEditPostingPermissions(groupRes.data.postingPermissions || 'everyone');
        
        const userMember = membersRes.data.find(m => m.userId === user?.id);
        if (userMember && ['owner', 'admin'].includes(userMember.role)) {
          try {
            const bannedRes = await axios.get(`${apiBase}/groups/${groupId}/banned`);
            setBannedMembers(bannedRes.data);
          } catch (err) {
            console.error('Failed to load banned members');
          }
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load group');
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId, apiBase, user?.id]);

  const performSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    
    try {
      const response = await axios.get(`${apiBase}/search?q=${encodeURIComponent(query)}`);
      if (!response.data || !Array.isArray(response.data)) {
        setSearchResults([]);
        return;
      }
      
      const nonMembers = response.data.filter(u => 
        !members.some(m => m.userId === u.id) &&
        !bannedMembers.some(b => b.userId === u.id)
      );
      setSearchResults(nonMembers);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    }
  }, [apiBase, members, bannedMembers]);

  const fetchGroupData = async () => {
    try {
      setLoading(true);
      const [groupRes, membersRes, postsRes] = await Promise.all([
        axios.get(`${apiBase}/groups/${groupId}`),
        axios.get(`${apiBase}/groups/${groupId}/members`),
        axios.get(`${apiBase}/groups/${groupId}/posts`).catch(() => ({ data: [] }))
      ]);
      setGroup(groupRes.data);
      setMembers(membersRes.data);
      setGroupPosts(postsRes.data || []);
      setEditName(groupRes.data.name);
      setEditDescription(groupRes.data.description);
      setEditPostingPermissions(groupRes.data.postingPermissions || 'everyone');
      
      const userMember = membersRes.data.find(m => m.userId === user?.id);
      if (userMember && ['owner', 'admin'].includes(userMember.role)) {
        try {
          const bannedRes = await axios.get(`${apiBase}/groups/${groupId}/banned`);
          setBannedMembers(bannedRes.data);
        } catch (err) {
          console.error('Failed to load banned members');
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load group');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);
  };

  const handleSelectUser = (user) => {
    if (!selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveSelected = (userId) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
  };

  const handleInviteMembers = async () => {
    if (selectedUsers.length === 0) {
      setError('Please select at least one user to invite');
      return;
    }

    setInviting(true);
    setError('');
    setSuccess('');

    try {
      await axios.post(`${apiBase}/groups/${groupId}/invite`, {
        userIds: selectedUsers.map(u => u.id)
      });
      setSuccess(`Added ${selectedUsers.length} member(s)`);
      setSelectedUsers([]);
      setShowInviteModal(false);
      setTimeout(() => fetchGroupData(), 500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to invite members');
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateGroup = async () => {
    setUpdating(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.put(`${apiBase}/groups/${groupId}`, {
        name: editName,
        description: editDescription
      });
      setGroup(response.data);
      
      if (editPostingPermissions !== (response.data.postingPermissions || 'everyone')) {
        await axios.put(`${apiBase}/groups/${groupId}/posting-permissions`, {
          postingPermissions: editPostingPermissions
        });
        setGroup({ ...response.data, postingPermissions: editPostingPermissions });
      }
      
      setShowEditModal(false);
      setSuccess('Group updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update group');
    } finally {
      setUpdating(false);
    }
  };

  const handleChangeRole = async (memberId, newRole) => {
    try {
      await axios.put(`${apiBase}/groups/${groupId}/members/${memberId}/role`, {
        role: newRole
      });
      setMembers(members.map(m => 
        m.userId === memberId ? { ...m, role: newRole } : m
      ));
      setSuccess('Role updated');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;

    try {
      await axios.delete(`${apiBase}/groups/${groupId}/members/${memberId}`);
      setMembers(members.filter(m => m.userId !== memberId));
      setSuccess('Member removed');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleBanMember = async (memberId, memberName) => {
    if (!window.confirm(`Are you sure you want to ban ${memberName} from this group?`)) return;

    try {
      await axios.post(`${apiBase}/groups/${groupId}/ban/${memberId}`);
      setMembers(members.filter(m => m.userId !== memberId));
      setBannedMembers([...bannedMembers, {
        userId: memberId,
        username: memberName,
        bannedAt: new Date().toISOString(),
        bannedBy: user?.id
      }]);
      setSuccess(`${memberName} has been banned from the group`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to ban member');
    }
  };

  const handleUnbanMember = async (memberId) => {
    try {
      await axios.delete(`${apiBase}/groups/${groupId}/ban/${memberId}`);
      setBannedMembers(bannedMembers.filter(b => b.userId !== memberId));
      setSuccess('Member unbanned successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to unban member');
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm('Are you sure you want to delete this group? This cannot be undone.')) return;

    try {
      await axios.delete(`${apiBase}/groups/${groupId}`);
      navigate('/groups');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete group');
    }
  };

  const handleCreatePost = async () => {
    if (!postContent.trim()) {
      setError('Post content cannot be empty');
      return;
    }

    setPosting(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(`${apiBase}/groups/${groupId}/posts`, {
        content: postContent
      });
      setGroupPosts([response.data, ...groupPosts]);
      setPostContent('');
      setSuccess('Post created successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Delete this post?')) return;

    try {
      await axios.delete(`${apiBase}/groups/${groupId}/posts/${postId}`);
      setGroupPosts(groupPosts.filter(p => p.id !== postId));
      setSuccess('Post deleted');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete post');
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedTransfeeUser) {
      setError('Please select a member to transfer ownership to');
      return;
    }

    if (!window.confirm(`Transfer group ownership to ${selectedTransfeeUser.username}?`)) return;

    setTransferring(true);
    setError('');
    setSuccess('');

    try {
      await axios.post(`${apiBase}/groups/${groupId}/transfer-ownership`, {
        newOwnerId: selectedTransfeeUser.userId
      });
      setSuccess('Group ownership transferred successfully');
      setShowTransferModal(false);
      setSelectedTransfeeUser(null);
      setTimeout(() => fetchGroupData(), 500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to transfer ownership');
    } finally {
      setTransferring(false);
    }
  };

  const userMember = members.find(m => m.userId === user?.id);
  const isGroupOwner = group?.ownerId === user?.id || userMember?.role === 'owner';
  const canManageMembers = isGroupOwner || userMember?.role === 'admin';
  
  const getCanPost = () => {
    if (!userMember) return false;
    const permissions = group?.postingPermissions || 'everyone';
    
    if (permissions === 'everyone') return true;
    if (permissions === 'moderator') return ['owner', 'admin', 'moderator'].includes(userMember.role);
    if (permissions === 'admin') return ['owner', 'admin'].includes(userMember.role);
    if (permissions === 'owner') return userMember.role === 'owner';
    return false;
  };
  
  const canPost = getCanPost();

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (!group) {
    return (
      <div className="group-detail">
        <div className="alert alert-error">
          {error || 'Group not found'}
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/groups')}>
          <FiArrowLeft /> Back to Groups
        </button>
      </div>
    );
  }

  return (
    <div className="group-detail">
      <div className="group-detail-header">
        <button 
          className="btn-icon"
          onClick={() => navigate('/groups')}
          title="Back to Groups"
        >
          <FiArrowLeft size={20} />
        </button>
        <h1>{group.name}</h1>
        {isGroupOwner && (
          <div className="group-header-actions">
            <button 
              className="btn-icon"
              onClick={() => setShowEditModal(true)}
              title="Edit Group"
            >
              <FiEdit2 size={20} />
            </button>
            <button 
              className="btn-icon danger"
              onClick={handleDeleteGroup}
              title="Delete Group"
            >
              <FiTrash2 size={20} />
            </button>
          </div>
        )}
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

      <div className="group-detail-content">
        <div className="group-info-section">
          <div className="group-description">
            <h3>About</h3>
            <p>{group.description || 'No description'}</p>
          </div>
          <div className="group-meta">
            <div className="meta-item">
              <span className="meta-label">Created</span>
              <span className="meta-value">{new Date(group.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Members</span>
              <span className="meta-value">{members.length}</span>
            </div>
          </div>
          {isGroupOwner && (
            <div className="group-owner-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowTransferModal(true)}
              >
                <FiArrowRight size={16} /> Transfer Ownership
              </button>
            </div>
          )}
        </div>

        <div className="members-section">
          <div className="members-header">
            <h2>Members ({members.length})</h2>
            {canManageMembers && (
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => setShowInviteModal(true)}
              >
                <FiUserPlus size={16} /> Invite Members
              </button>
            )}
          </div>

          <div className="members-list">
            {members.map(member => (
              <div key={member.userId} className="member-item">
                <div className="member-info">
                  <div className="member-name">{member.username}</div>
                  <div className="member-role-badge" data-role={member.role}>
                    {member.role}
                  </div>
                </div>
                {canManageMembers && member.userId !== group.ownerId && (
                  <div className="member-actions">
                    {member.role !== 'owner' && (
                      <select 
                        value={member.role}
                        onChange={(e) => handleChangeRole(member.userId, e.target.value)}
                        className="role-select"
                      >
                        <option value="member">Member</option>
                        <option value="moderator">Moderator</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                    <button 
                      className="btn-icon danger"
                      onClick={() => handleRemoveMember(member.userId)}
                      title="Remove member"
                    >
                      <FiX size={18} />
                    </button>
                    <button 
                      className="btn-icon danger"
                      onClick={() => handleBanMember(member.userId, member.username)}
                      title="Ban member"
                    >
                      <FiSlash size={18} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {canManageMembers && bannedMembers.length > 0 && (
        <div className="banned-members-section">
          <div className="members-header">
            <h2>Banned Members ({bannedMembers.length})</h2>
          </div>
          <div className="members-list">
            {bannedMembers.map(banned => (
              <div key={banned.userId} className="member-item banned-member-item">
                <div className="member-info">
                  <div className="member-name">{banned.username}</div>
                  <div className="banned-info">
                    Banned on {new Date(banned.bannedAt).toLocaleDateString()}
                  </div>
                </div>
                {isGroupOwner && (
                  <button 
                    className="btn-icon"
                    onClick={() => handleUnbanMember(banned.userId)}
                    title="Unban member"
                  >
                    <FiUnlock size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {canPost && (
        <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'white', borderRadius: '1rem', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Create Post</h3>
          <textarea
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            placeholder="What's on your mind..."
            rows={4}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              fontFamily: 'inherit',
              fontSize: '1rem',
              marginBottom: '1rem'
            }}
          />
          <button 
            className="btn btn-primary"
            onClick={handleCreatePost}
            disabled={posting || !postContent.trim()}
          >
            {posting ? 'Posting...' : 'Post'}
          </button>
        </div>
      )}

      {groupPosts.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Group Posts ({groupPosts.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {groupPosts.map(post => (
              <div key={post.id} style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '1rem',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'start', flex: 1 }}>
                    <div
                      style={{
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: '50%',
                        background: post.avatar ? 'transparent' : 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        flexShrink: 0,
                        overflow: 'hidden'
                      }}
                    >
                      {post.avatar ? (
                        <img 
                          src={post.avatar} 
                          alt={post.author}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                      ) : (
                        post.author.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--text-dark)' }}>{post.author}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                        {new Date(post.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {(post.authorId === user?.id || canManageMembers) && (
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      style={{
                        background: 'var(--danger)',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '0.5rem',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div style={{ color: 'var(--text-dark)', lineHeight: '1.6' }}>
                  {post.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!canPost && groupPosts.length === 0 && (
        <div style={{ marginTop: '2rem', textAlign: 'center', padding: '2rem', background: 'var(--light)', borderRadius: '1rem' }}>
          <p style={{ color: 'var(--text-light)' }}>No posts yet. {!canPost && 'You do not have permission to post in this group.'}</p>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Group</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleUpdateGroup(); }}>
              <div className="form-group">
                <label htmlFor="edit-name">Group Name</label>
                <input
                  id="edit-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-desc">Description</label>
                <textarea
                  id="edit-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  maxLength={500}
                  rows={4}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-posting">Posting Permissions</label>
                <select
                  id="edit-posting"
                  value={editPostingPermissions}
                  onChange={(e) => setEditPostingPermissions(e.target.value)}
                >
                  <option value="everyone">Everyone</option>
                  <option value="moderator">Moderator+</option>
                  <option value="admin">Admin+</option>
                  <option value="owner">Owner Only</option>
                </select>
              </div>
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={updating}
                >
                  {updating ? 'Updating...' : 'Update Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Invite Members</h2>
            <div className="invite-section">
              <div className="form-group">
                <label htmlFor="search-users">Search Users</label>
                <input
                  id="search-users"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search by username..."
                />
              </div>

              {searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map(result => (
                    <div 
                      key={result.id} 
                      className="search-result"
                      onClick={() => handleSelectUser(result)}
                    >
                      <span>{result.username}</span>
                      <button type="button" className="btn-icon">
                        <FiUserPlus size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {selectedUsers.length > 0 && (
                <div className="selected-users">
                  <h3>Selected Users ({selectedUsers.length})</h3>
                  <div className="selected-users-list">
                    {selectedUsers.map(u => (
                      <div key={u.id} className="selected-user-tag">
                        <span>{u.username}</span>
                        <button 
                          type="button"
                          onClick={() => handleRemoveSelected(u.id)}
                          className="btn-remove"
                        >
                          <FiX size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => {
                  setShowInviteModal(false);
                  setSelectedUsers([]);
                  setSearchQuery('');
                }}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn btn-primary"
                onClick={handleInviteMembers}
                disabled={inviting || selectedUsers.length === 0}
              >
                {inviting ? 'Inviting...' : `Invite ${selectedUsers.length} User(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="modal-overlay" onClick={() => setShowTransferModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Transfer Group Ownership</h2>
            <div className="transfer-section">
              <p style={{ marginBottom: '1rem', color: 'var(--text-light)' }}>
                Select a member to transfer ownership to. You will become an admin.
              </p>
              <div className="transfer-members-list">
                {members
                  .filter(m => m.userId !== group.ownerId)
                  .map(member => (
                    <div
                      key={member.userId}
                      className={`transfer-member-item ${selectedTransfeeUser?.userId === member.userId ? 'selected' : ''}`}
                      onClick={() => setSelectedTransfeeUser(member)}
                    >
                      <div className="member-info">
                        <div className="member-name">{member.username}</div>
                        <div className="member-role-badge" data-role={member.role}>
                          {member.role}
                        </div>
                      </div>
                      <input
                        type="radio"
                        checked={selectedTransfeeUser?.userId === member.userId}
                        onChange={() => setSelectedTransfeeUser(member)}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                  ))}
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowTransferModal(false);
                  setSelectedTransfeeUser(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleTransferOwnership}
                disabled={transferring || !selectedTransfeeUser}
              >
                {transferring ? 'Transferring...' : 'Transfer Ownership'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
