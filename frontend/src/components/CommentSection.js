import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function CommentSection({ postId, user, apiBase }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async function fetchCommentsInside() {
      try {
        const response = await axios.get(`${apiBase}/posts/${postId}/comments`);
        setComments(response.data);
      } catch (err) {
        console.error('Failed to fetch comments');
      } finally {
        setLoading(false);
      }
    })();
  }, [postId, apiBase]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const response = await axios.post(`${apiBase}/posts/${postId}/comment`, {
        content: newComment
      });
      setComments([...comments, response.data]);
      setNewComment('');
    } catch (err) {
      console.error('Failed to add comment');
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="comments-section">
      <form className="comment-input" onSubmit={handleAddComment}>
        <input
          type="text"
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <button type="submit">Comment</button>
      </form>

      <div>
        {comments.map(comment => (
          <div key={comment.id} className="comment">
            <div className="comment-author">{comment.author}</div>
            <div className="comment-text">{comment.content}</div>
            <div className="comment-time">
              {new Date(comment.createdAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
