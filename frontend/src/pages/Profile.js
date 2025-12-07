import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { FiEdit2, FiHeart, FiMessageCircle, FiShare2 } from 'react-icons/fi';
import { sharePost } from '../utils/shareUtils';

export default function Profile({ user, apiBase }) {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [friendStatus, setFriendStatus] = useState(null);
  

  const fetchProfile = useCallback(async () => {
    try {
      const response = await axios.get(`${apiBase}/users/${userId}`);
      setProfile(response.data);
      setEditBio(response.data.bio || '');
      setIsFollowing(user?.following?.includes(userId) || false);
    } catch (err) {
      console.error('Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  }, [userId, apiBase, user?.following]);

  const fetchUserPosts = useCallback(async () => {
    try {
      const response = await axios.get(`${apiBase}/posts/user/${userId}`);
      setPosts(response.data);
    } catch (err) {
      console.error('Failed to fetch posts');
    }
  }, [userId, apiBase]);

  const fetchFriendStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${apiBase}/friends/status/${userId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        timeout: 10000
      });
      setFriendStatus(response.data.status);
      // request id not used in current UI
    } catch (err) {
      console.error('Failed to fetch friend status');
    }
  }, [userId, apiBase]);

  useEffect(() => {
    fetchProfile();
    fetchUserPosts();
    if (user?.id) {
      fetchFriendStatus();
    }
  }, [fetchProfile, fetchUserPosts, fetchFriendStatus, user?.id]);

  const handleSaveBio = async () => {
    try {
      const response = await axios.put(`${apiBase}/users/${userId}`, {
        bio: editBio
      });
      setProfile(response.data);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update bio');
    }
  };

  const handleFollow = async () => {
    try {
      const response = await axios.post(`${apiBase}/follow/${userId}`);
      setIsFollowing(response.data.following);
      fetchProfile();
    } catch (err) {
      console.error('Failed to follow');
    }
  };

  const handleSendFriendRequest = async () => {
    try {
      await axios.post(`${apiBase}/friends/request/${userId}`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        timeout: 10000
      });
      setFriendStatus('pending');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send friend request');
    }
  };

  // Accept/reject helper removed because not used in UI currently

  const handleRemoveFriend = async () => {
    if (!window.confirm('Are you sure you want to remove this friend?')) return;
    try {
      await axios.delete(`${apiBase}/friends/${userId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        timeout: 10000
      });
      setFriendStatus('none');
    } catch (err) {
      alert('Failed to remove friend');
    }
  };

  const handleShare = async (postId) => {
    console.log('Share button clicked for post:', postId);
    
    const post = posts.find(p => p.id === postId);
    if (!post) {
      console.error('Post not found for sharing with ID:', postId);
      alert('Post not found');
      return;
    }

    console.log('Found post to share:', { id: post.id, author: post.author });

    try {
      const shareResult = await sharePost(post, apiBase);
      console.log('Share result:', shareResult);
      
      if (!shareResult.success && !shareResult.aborted) {
        console.error('Share dialog failed:', shareResult.error);
      }
    } catch (err) {
      console.error('Unexpected error in sharePost:', err);
    }

    try {
      console.log('Updating share count on backend for post:', postId);
      const response = await axios.post(`${apiBase}/posts/${postId}/share`);
      console.log('Share count updated:', response.data);
      setPosts(prevPosts => prevPosts.map(p => p.id === postId ? { ...p, shares: response.data.shares, isShared: response.data.isShared } : p));
    } catch (err) {
      console.error('Failed to update share count:', err.message);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (!profile) {
    return <div className="error-message">Profile not found</div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <img src={profile.avatar || '/default-avatar.svg'} alt="Avatar" className="profile-header-avatar" />
        <h1>{profile.username}</h1>
        
        {isEditing && user?.id === userId ? (
          <div className="form-group">
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="Tell us about yourself"
            />
            <button className="btn btn-primary" onClick={handleSaveBio}>Save</button>
            <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
          </div>
        ) : (
          <div>
            <div className="profile-header-bio">{profile.bio || 'No bio yet'}</div>
            {user?.id === userId && (
              <button className="btn btn-primary profile-edit-btn" onClick={() => setIsEditing(true)}>
                <FiEdit2 /> Edit Bio
              </button>
            )}
            {user?.id !== userId && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button 
                  className={`btn ${isFollowing ? 'btn-secondary' : 'btn-primary'} profile-edit-btn`}
                  onClick={handleFollow}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>

                {friendStatus === 'friends' && (
                  <button 
                    className="btn btn-secondary profile-edit-btn"
                    onClick={handleRemoveFriend}
                  >
                    Remove Friend
                  </button>
                )}
                {friendStatus === 'pending' && (
                  <button 
                    className="btn btn-secondary profile-edit-btn"
                    disabled
                  >
                    Request Sent
                  </button>
                )}
                {friendStatus === 'none' && (
                  <button 
                    className="btn btn-primary profile-edit-btn"
                    onClick={handleSendFriendRequest}
                  >
                    Add Friend
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="profile-stats">
          <div className="stat">
            <div className="stat-number">{profile.followers?.length || 0}</div>
            <div className="stat-label">Followers</div>
          </div>
          <div className="stat">
            <div className="stat-number">{profile.following?.length || 0}</div>
            <div className="stat-label">Following</div>
          </div>
          <div className="stat">
            <div className="stat-number">{posts.length}</div>
            <div className="stat-label">Posts</div>
          </div>
        </div>
      </div>

      <div className="profile-posts">
        <h2>Posts</h2>
        {posts.map(post => (
          <div key={post.id} className="post-card">
            <div className="post-content">{post.content}</div>
            {post.media && post.media.length > 0 && (
              <div className="post-media">
                {post.media.map((media, idx) => (
                  <div key={idx} className="media-item">
                    {media.type === 'video' ? (
                      <video controls><source src={media.url} /></video>
                    ) : (
                      <img src={media.url} alt="Media" />
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="post-actions">
              <button className="action-btn">
                <FiHeart />
                {post.likes}
              </button>
              <button className="action-btn">
                <FiMessageCircle />
                {post.comments?.length || 0}
              </button>
              <button 
                type="button"
                className={`action-btn ${post.isShared ? 'shared' : ''}`}
                onClick={() => handleShare(post.id)}
              >
                <FiShare2 />
                {post.shares || 0}
              </button>
            </div>
          </div>
        ))}
        {posts.length === 0 && <p>No posts yet</p>}
      </div>
    </div>
  );
}
