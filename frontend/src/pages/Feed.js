import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FiHeart, FiMessageCircle, FiShare2, FiMoreHorizontal } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import CommentSection from '../components/CommentSection';
import { sharePost } from '../utils/shareUtils';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';

export default function Feed({ user, apiBase, setUser }) {
  const [posts, setPosts] = useState([]);
  const [expandedPost, setExpandedPost] = useState(null);
  const [openMenuPost, setOpenMenuPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [postContent, setPostContent] = useState('');
  const [postType, setPostType] = useState('text');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [preview, setPreview] = useState([]);
  const [posting, setPosting] = useState(false);
  const [postPrivacy, setPostPrivacy] = useState('public');
  const [taggedUsers, setTaggedUsers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [userSearchInput, setUserSearchInput] = useState('');
  const navigate = useNavigate();
  const [following, setFollowing] = useState(user?.following || []);

  // Helper function for authentication headers
  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  const fetchAvailableUsers = useCallback(async () => {
    try {
      const response = await axios.get(`${apiBase}/users`, { 
        ...authHeaders(),
        timeout: 10000 
      });
      setAvailableUsers(response.data.filter(u => u.id !== user?.id) || []);
    } catch (err) {
      console.error('Failed to fetch users:', err.message);
    }
  }, [apiBase, user?.id]);

  const handleFollow = async (authorId) => {
    try {
      const response = await axios.post(`${apiBase}/follow/${authorId}`, {}, { 
        ...authHeaders(),
        timeout: 10000 
      });
      setFollowing(response.data.following ? [...following, authorId] : following.filter(id => id !== authorId));
    } catch (err) {
      console.error('Failed to follow/unfollow user');
    }
  };

  const handleShare = async (postId) => {
    console.log('Share button clicked for post:', postId);
    
    const post = posts.find(p => p.id === postId);
    if (!post) {
      console.error('Post not found for sharing with ID:', postId);
      console.log('Available posts:', posts.map(p => ({ id: p.id, author: p.author })));
      alert('Post not found');
      return;
    }

    console.log('Found post to share:', { id: post.id, author: post.author, content: post.content?.substring(0, 50) });

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
      const response = await axios.post(`${apiBase}/posts/${postId}/share`, {}, { 
        ...authHeaders(),
        timeout: 10000 
      });
      console.log('Share count updated:', response.data);
      setPosts(prevPosts => prevPosts.map(p => p.id === postId ? { ...p, shares: response.data.shares, isShared: response.data.isShared } : p));
    } catch (err) {
      console.error('Failed to update share count:', err.message);
    }
  };

  

  const fetchPosts = useCallback(async () => {
    try {
      setError(null);
      const response = await axios.get(`${apiBase}/posts`, { 
        ...authHeaders(),
        timeout: 10000 
      });
      setPosts(response.data || []);
    } catch (err) {
      console.error('Failed to fetch posts:', err.message);
      setError(err.code === 'ECONNABORTED' ? 'Feed is taking too long to load. Please try again.' : 'Failed to load feed. Please try again.');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchPosts();
    fetchAvailableUsers();
  }, [fetchPosts, fetchAvailableUsers]);

  const handleAddTaggedUser = (userId) => {
    if (!taggedUsers.includes(userId)) {
      setTaggedUsers([...taggedUsers, userId]);
    }
    setUserSearchInput('');
  };

  const handleRemoveTaggedUser = (userId) => {
    setTaggedUsers(taggedUsers.filter(id => id !== userId));
  };

  const getFilteredUsers = () => {
    if (!userSearchInput.trim()) {
      return [];
    }
    return availableUsers.filter(u => 
      u.username.toLowerCase().includes(userSearchInput.toLowerCase()) && 
      !taggedUsers.includes(u.id)
    );
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles([...selectedFiles, ...files]);
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreview(prev => [...prev, { 
          url: event.target.result, 
          type: file.type.startsWith('video') ? 'video' : 'image' 
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    setPreview(preview.filter((_, i) => i !== index));
  };

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!postContent.trim() && selectedFiles.length === 0) {
      alert('Please add some content or media');
      return;
    }

    setPosting(true);

    try {
      const formData = new FormData();
      formData.append('content', postContent);
      formData.append('type', postType);
      formData.append('privacy', postPrivacy);
      formData.append('taggedUsers', JSON.stringify(taggedUsers));
      
      selectedFiles.forEach(file => {
        formData.append('media', file);
      });

      const response = await axios.post(`${apiBase}/posts`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        timeout: 30000
      });

      const postWithLikeData = {
        ...response.data,
        isLiked: false,
        likes: 0,
        isShared: false,
        shares: 0
      };
        setPosts([postWithLikeData, ...posts]);

      setPostContent('');
      setPostType('text');
      setPostPrivacy('public');
      setTaggedUsers([]);
      setUserSearchInput('');
      setSelectedFiles([]);
      setPreview([]);
    } catch (err) {
      console.error('Failed to create post');
      alert('Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      const response = await axios.post(`${apiBase}/posts/${postId}/like`, {}, { 
        ...authHeaders(),
        timeout: 10000 
      });
      setPosts(prevPosts => prevPosts.map(p => p.id === postId ? { ...p, isLiked: response.data.isLiked, likes: response.data.likes } : p));
    } catch (err) {
      console.error('Failed to like post');
    }
  };

  const handleDeletePost = async (postId) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await axios.delete(`${apiBase}/posts/${postId}`, { 
          ...authHeaders(),
          timeout: 10000 
        });
        setPosts(posts.filter(p => p.id !== postId));
      } catch (err) {
        console.error('Failed to delete post');
      }
    }
  };

  const handleReportPost = async (postId) => {
    const reason = prompt('Report reason:', 'Spam');
    if (reason) {
      try {
        await axios.post(`${apiBase}/reports`, {
          targetId: postId,
          targetType: 'post',
          reason,
          description: prompt('Additional details (optional):') || ''
        }, { 
          ...authHeaders(),
          timeout: 10000 
        });
        alert('Report submitted successfully');
      } catch (err) {
        console.error('Failed to report post');
      }
    }  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="feed" style={{ maxWidth: 700, margin: '2rem auto' }}>
      {error && (
        <div className="card error-message" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span>{error}</span>
          <button 
            onClick={() => { setLoading(true); fetchPosts(); }}
            className="btn btn-danger"
          >
            Retry
          </button>
        </div>
      )}

      <div className="feed-top" />

      <div className="feed-left">
        <div className="create-post card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <Avatar src={user?.avatar || '/default-avatar.svg'} size={56} />
            <form onSubmit={handlePostSubmit} style={{ flex: 1 }}>
              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="What's on your mind?"
                className="form-control"
                style={{ minHeight: 100 }}
              />

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="button" className={`btn ${postType === 'text' ? 'btn-accent' : 'btn-light'}`} onClick={() => setPostType('text')}>📝 Text</button>
                <button type="button" className={`btn ${postType === 'photo' ? 'btn-accent' : 'btn-light'}`} onClick={() => setPostType('photo')}>📸 Photo</button>
                <button type="button" className={`btn ${postType === 'video' ? 'btn-accent' : 'btn-light'}`} onClick={() => setPostType('video')}>🎥 Video</button>
                <button type="button" className={`btn ${postType === 'brief' ? 'btn-accent' : 'btn-light'}`} onClick={() => setPostType('brief')}>⚡ Brief</button>
              </div>

              <div style={{ marginTop: 16 }}>
                <label htmlFor="tag-input" style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>Tag People</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="tag-input"
                    type="text"
                    value={userSearchInput}
                    onChange={(e) => setUserSearchInput(e.target.value)}
                    placeholder="Search and tag users..."
                    className="form-control"
                  />
                  {getFilteredUsers().length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--border)', zIndex: 10, maxHeight: 180, overflowY: 'auto', borderRadius: '0 0 12px 12px' }}>
                      {getFilteredUsers().map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleAddTaggedUser(u.id)}
                          style={{ width: '100%', textAlign: 'left', padding: 8, background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          {u.username}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {taggedUsers.length > 0 && (
                  <div style={{ marginTop: 8, marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {taggedUsers.map(userId => {
                      const taggedUser = availableUsers.find(u => u.id === userId);
                      return (
                        <div key={userId} style={{ background: 'var(--primary)', color: '#fff', padding: '4px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{taggedUser?.username || 'Unknown'}</span>
                          <button type="button" onClick={() => handleRemoveTaggedUser(userId)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                <label htmlFor="privacy-select" style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>Privacy</label>
                <select
                  id="privacy-select"
                  value={postPrivacy}
                  onChange={(e) => setPostPrivacy(e.target.value)}
                  className="form-control"
                >
                  <option value="public">🌍 Public</option>
                  <option value="friends">👥 Friends Only</option>
                  <option value="friendsOfFriends">👨‍👨‍👧‍👦 Friends & Friends of Friends</option>
                  {taggedUsers.length > 0 && <option value="friendsAndTagged">👥 Friends & Tagged People</option>}
                  {taggedUsers.length > 0 && <option value="friendsOfFriendsAndTagged">👨‍👨‍👧‍👦 Friends of Friends & Tagged People</option>}
                </select>
              </div>

              {(postType === 'photo' || postType === 'video' || postType === 'brief') && (
                <div style={{ marginTop: 16 }}>
                  <label htmlFor="file-input" style={{ display: 'inline-block', padding: '8px 16px', background: 'var(--input-bg)', borderRadius: 8, cursor: 'pointer' }}>Choose {postType === 'photo' ? 'Photos' : postType === 'brief' ? 'Short Video (max 60s)' : 'Videos'}</label>
                  <input id="file-input" type="file" multiple={postType === 'photo'} accept={postType === 'photo' ? 'image/*' : 'video/*'} onChange={handleFileChange} style={{ display: 'none' }} />
                </div>
              )}

              {preview.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 16 }}>
                  {preview.map((item, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      {item.type === 'video' ? (
                        <video style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8 }} controls><source src={item.url} /></video>
                      ) : (
                        <img src={item.url} alt="Preview" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8 }} />
                      )}
                      <button type="button" onClick={() => removeFile(idx)} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: '50%', width: 28, height: 28, border: 'none', cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 20 }}>
                <Button type="submit" className="btn btn-primary">{posting ? 'Posting...' : 'Post'}</Button>
              </div>
            </form>
          </div>
        </div>

        {posts.map(post => (
          <div key={post.id} className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div onClick={() => navigate(`/profile/${post.authorId}`)} style={{ cursor: 'pointer' }}>
                  <Avatar src={post.avatar || '/default-avatar.svg'} size={48} />
                </div>
                <div>
                  <div onClick={() => navigate(`/profile/${post.authorId}`)} style={{ fontWeight: 600, cursor: 'pointer' }}>{post.author}</div>
                  <div style={{ color: 'var(--text-light)', fontSize: '0.95em' }}>{new Date(post.createdAt).toLocaleDateString()}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {post.authorId !== user.id && (
                  <button onClick={() => handleFollow(post.authorId)} className={`btn btn-primary btn-sm`} style={{ minWidth: 80 }}>
                    {following.includes(post.authorId) ? 'Following' : 'Follow'}
                  </button>
                )}
                <div style={{ position: 'relative' }}>
                  <button className="btn btn-light" style={{ borderRadius: '50%', padding: 8 }} onClick={() => setOpenMenuPost(openMenuPost === post.id ? null : post.id)}><FiMoreHorizontal /></button>
                  {openMenuPost === post.id && (
                    <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', width: 140, zIndex: 10 }}>
                      {(post.authorId === user.id || user.role === 'owner' || user.role === 'moderator') && (
                        <button className="btn btn-danger" style={{ width: '100%', textAlign: 'left', padding: 8, borderRadius: 8, background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} onClick={() => handleDeletePost(post.id)}>Delete</button>
                      )}
                      <button className="btn btn-light" style={{ width: '100%', textAlign: 'left', padding: 8, borderRadius: 8, background: 'none', border: 'none', color: 'var(--text-dark)', cursor: 'pointer' }} onClick={() => handleReportPost(post.id)}>Report</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16, color: 'var(--text-dark)' }}>
              {post.content}
            </div>

            {post.media && post.media.length > 0 && (
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                {post.media.map((media, idx) => (
                  <div key={idx} className="media-item">
                    {media.type === 'video' ? (
                      <video style={{ width: '100%', borderRadius: 8 }} controls><source src={media.url} /></video>
                    ) : (
                      <img src={media.url} alt="Media" style={{ width: '100%', borderRadius: 8 }} />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 24 }}>
              <button type="button" onClick={() => handleLike(post.id)} className={`btn btn-light`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: post.isLiked ? 'var(--danger)' : 'var(--primary)', fontWeight: 600 }}>
                <FiHeart />
                <span>{post.likes}</span>
              </button>
              <button type="button" onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)} className="btn btn-light" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 600 }}>
                <FiMessageCircle />
                <span>{post.comments?.length || 0}</span>
              </button>
              <button type="button" onClick={() => handleShare(post.id)} className={`btn btn-light`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: post.isShared ? 'var(--primary)' : 'var(--primary)', fontWeight: 600 }}>
                <FiShare2 />
                <span>{post.shares || 0}</span>
              </button>
            </div>

            {expandedPost === post.id && (
              <CommentSection postId={post.id} user={user} apiBase={apiBase} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
