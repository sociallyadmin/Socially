import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { FiHeart, FiMessageCircle, FiShare2, FiArrowLeft } from 'react-icons/fi';
import CommentSection from '../components/CommentSection';
import { sharePost } from '../utils/shareUtils';

export default function PostDetail({ user, apiBase }) {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedComments, setExpandedComments] = useState(false);

  useEffect(() => {
    (async function fetchPostInside() {
      try {
        const response = await axios.get(`${apiBase}/posts/${postId}`);
        setPost(response.data);
      } catch (err) {
        console.error('Failed to fetch post');
      } finally {
        setLoading(false);
      }
    })();
  }, [postId, apiBase]);

  const handleLike = async () => {
    try {
      const response = await axios.post(`${apiBase}/posts/${postId}/like`);
      setPost({ ...post, isLiked: response.data.isLiked, likes: response.data.likes });
    } catch (err) {
      console.error('Failed to like post');
    }
  };

  const handleShare = async () => {
    if (!post) {
      console.error('No post available to share');
      alert('Post not available');
      return;
    }

    console.log('Share button clicked for post:', post.id);
    console.log('Post object:', { id: post.id, author: post.author });

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
      setPost({ ...post, shares: response.data.shares, isShared: response.data.isShared });
    } catch (err) {
      console.error('Failed to update share count:', err.message);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (!post) {
    return (
      <div className="post-detail-error">
        <p>Post not found</p>
        <button onClick={() => navigate('/')} className="btn btn-primary">Back to Feed</button>
      </div>
    );
  }

  return (
    <div className="post-detail-page">
      <button className="back-btn" onClick={() => navigate('/')}>
        <FiArrowLeft /> Back to Feed
      </button>

      <div className="post-detail-card">
        <div className="post-header">
          <div className="post-author-info">
            <img src={post.avatar || '/default-avatar.svg'} alt="Avatar" className="user-avatar" />
            <div className="post-author-details">
              <div className="post-author-name">{post.author}</div>
              <div className="post-time">
                {new Date(post.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        <div className="post-content">
          {post.content}
        </div>

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
          <button 
            type="button"
            className={`action-btn ${post.isLiked ? 'liked' : ''}`}
            onClick={handleLike}
          >
            <FiHeart fill={post.isLiked ? 'currentColor' : 'none'} />
            {post.likes}
          </button>
          <button 
            type="button"
            className="action-btn" 
            onClick={() => setExpandedComments(!expandedComments)}
          >
            <FiMessageCircle />
            {post.comments?.length || 0}
          </button>
          <button 
            type="button"
            className={`action-btn ${post.isShared ? 'shared' : ''}`}
            onClick={handleShare}
          >
            <FiShare2 />
            {post.shares || 0}
          </button>
        </div>

        {expandedComments && (
          <CommentSection postId={postId} user={user} apiBase={apiBase} />
        )}
      </div>
    </div>
  );
}
