import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Friends({ user, apiBase }) {
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userStatuses, setUserStatuses] = useState({});
  const navigate = useNavigate();

  const fetchFriends = useCallback(async () => {
    try {
      const response = await axios.get(`${apiBase}/friends`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        timeout: 10000
      });
      setFriends(response.data || []);
    } catch (err) {
      console.error('Failed to fetch friends');
    }
  }, [apiBase]);

  const fetchPendingRequests = useCallback(async () => {
    try {
      const response = await axios.get(`${apiBase}/friends/requests`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        timeout: 10000
      });
      setPendingRequests(response.data || []);
    } catch (err) {
      console.error('Failed to fetch pending requests');
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchFriends();
    fetchPendingRequests();
  }, [fetchFriends, fetchPendingRequests]);

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setUserStatuses({});
      return;
    }

    try {
      const allUsers = await axios.get(`${apiBase}/admin/users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        timeout: 10000
      });

      const filtered = allUsers.data.filter(u =>
        u.username.toLowerCase().includes(query.toLowerCase()) && u.id !== user.id
      );

      setSearchResults(filtered);

      const statuses = {};
      for (const resultUser of filtered) {
        try {
          const statusResponse = await axios.get(`${apiBase}/friends/status/${resultUser.id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            timeout: 10000
          });
          statuses[resultUser.id] = statusResponse.data;
        } catch (err) {
          console.error('Failed to fetch status for user:', resultUser.id);
        }
      }
      setUserStatuses(statuses);
    } catch (err) {
      console.error('Failed to search users');
    }
  };

  const handleSendRequest = async (userId) => {
    try {
      await axios.post(`${apiBase}/friends/request/${userId}`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        timeout: 10000
      });
      setUserStatuses({
        ...userStatuses,
        [userId]: { status: 'pending', direction: 'outgoing' }
      });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send friend request');
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await axios.post(`${apiBase}/friends/requests/${requestId}/accept`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        timeout: 10000
      });
      fetchFriends();
      fetchPendingRequests();
    } catch (err) {
      alert('Failed to accept friend request');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await axios.post(`${apiBase}/friends/requests/${requestId}/reject`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        timeout: 10000
      });
      fetchPendingRequests();
    } catch (err) {
      alert('Failed to reject friend request');
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (!window.confirm('Are you sure you want to remove this friend?')) return;

    try {
      await axios.delete(`${apiBase}/friends/${friendId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        timeout: 10000
      });
      fetchFriends();
    } catch (err) {
      alert('Failed to remove friend');
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="friends-page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Friends</h1>

      <div style={{ marginBottom: '3rem' }}>
        <h2>Find Friends</h2>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Search for users..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              searchUsers(e.target.value);
            }}
            style={{
              flex: 1,
              padding: '0.75rem',
              borderRadius: '0.25rem',
              border: '1px solid var(--border-color)'
            }}
          />
        </div>

        {searchResults.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '1rem'
          }}>
            {searchResults.map(resultUser => {
              const status = userStatuses[resultUser.id];
              return (
                <div key={resultUser.id} style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  textAlign: 'center'
                }}>
                  <div style={{ marginBottom: '0.5rem', fontWeight: 'bold', cursor: 'pointer' }}
                       onClick={() => navigate(`/profile/${resultUser.id}`)}>
                    {resultUser.username}
                  </div>
                  <div style={{ marginBottom: '1rem', color: 'var(--text-light)', fontSize: '0.9rem' }}>
                    Since {new Date(resultUser.createdAt).toLocaleDateString()}
                  </div>

                  {status?.status === 'friends' ? (
                    <button
                      onClick={() => handleRemoveFriend(resultUser.id)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: '#f0f0f0',
                        color: '#333',
                        border: '1px solid #ccc',
                        borderRadius: '0.25rem',
                        cursor: 'pointer'
                      }}
                    >
                      Remove Friend
                    </button>
                  ) : status?.status === 'pending' && status?.direction === 'outgoing' ? (
                    <button
                      disabled
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: '#ccc',
                        color: '#999',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'not-allowed'
                      }}
                    >
                      Request Sent
                    </button>
                  ) : status?.status === 'pending' && status?.direction === 'incoming' ? (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => {
                          const request = pendingRequests.find(r => r.fromId === resultUser.id);
                          if (request) handleAcceptRequest(request.id);
                        }}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.25rem',
                          cursor: 'pointer'
                        }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => {
                          const request = pendingRequests.find(r => r.fromId === resultUser.id);
                          if (request) handleRejectRequest(request.id);
                        }}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.25rem',
                          cursor: 'pointer'
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSendRequest(resultUser.id)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer'
                      }}
                    >
                      Add Friend
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pendingRequests.length > 0 && (
        <div style={{ marginBottom: '3rem' }}>
          <h2>Pending Requests ({pendingRequests.length})</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '1rem'
          }}>
            {pendingRequests.map(request => (
              <div key={request.id} style={{
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                padding: '1rem',
                textAlign: 'center'
              }}>
                <div style={{ marginBottom: '0.5rem', fontWeight: 'bold', cursor: 'pointer' }}
                     onClick={() => navigate(`/profile/${request.fromId}`)}>
                  {request.fromUsername}
                </div>
                <div style={{ marginBottom: '1rem', color: 'var(--text-light)', fontSize: '0.9rem' }}>
                  Requested {new Date(request.createdAt).toLocaleDateString()}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleAcceptRequest(request.id)}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: 'pointer'
                    }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRejectRequest(request.id)}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: 'pointer'
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2>Your Friends ({friends.length})</h2>
        {friends.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-light)', padding: '2rem' }}>
            You haven't added any friends yet. Search above to find and add friends!
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '1rem'
          }}>
            {friends.map(friend => (
              <div key={friend.id} style={{
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                padding: '1rem',
                textAlign: 'center'
              }}>
                <img
                  src={friend.avatar || '/default-avatar.svg'}
                  alt={friend.username}
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    marginBottom: '0.5rem',
                    objectFit: 'cover',
                    cursor: 'pointer'
                  }}
                  onClick={() => navigate(`/profile/${friend.id}`)}
                />
                <div style={{ marginBottom: '0.5rem', fontWeight: 'bold', cursor: 'pointer' }}
                     onClick={() => navigate(`/profile/${friend.id}`)}>
                  {friend.username}
                </div>
                {friend.bio && (
                  <div style={{ marginBottom: '1rem', color: 'var(--text-light)', fontSize: '0.9rem' }}>
                    {friend.bio}
                  </div>
                )}
                <button
                  onClick={() => handleRemoveFriend(friend.id)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: 'pointer'
                  }}
                >
                  Remove Friend
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
