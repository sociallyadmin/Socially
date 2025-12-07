import React, { useState } from 'react';
import axios from 'axios';

export default function CreatePostModal({ user, apiBase, onPostCreated, onClose }) {
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('text');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState([]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && selectedFiles.length === 0) {
      alert('Please add some content or media');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('type', postType);
      
      selectedFiles.forEach(file => {
        formData.append('media', file);
      });

      const response = await axios.post(`${apiBase}/posts`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setContent('');
      setPostType('text');
      setSelectedFiles([]);
      setPreview([]);
      
      onPostCreated(response.data);
    } catch (err) {
      console.error('Failed to create post');
      alert('Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-post-modal">
      <div className="create-post-content">
        <button className="close-btn" onClick={onClose}>Close</button>
        
        <h2>Create a Post</h2>

        <div className="post-tabs">
          <button
            className={`post-tab ${postType === 'text' ? 'active' : ''}`}
            onClick={() => setPostType('text')}
          >
            📝 Text
          </button>
          <button
            className={`post-tab ${postType === 'photo' ? 'active' : ''}`}
            onClick={() => setPostType('photo')}
          >
            📸 Photo
          </button>
          <button
            className={`post-tab ${postType === 'video' ? 'active' : ''}`}
            onClick={() => setPostType('video')}
          >
            🎥 Video
          </button>
          <button
            className={`post-tab ${postType === 'brief' ? 'active' : ''}`}
            onClick={() => setPostType('brief')}
          >
            ⚡ Brief (Short Video)
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>What's on your mind?</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your thoughts..."
              style={{ minHeight: '150px' }}
            />
          </div>

          {(postType === 'photo' || postType === 'video' || postType === 'brief') && (
            <div className="file-input-wrapper">
              <label htmlFor="file-input" className="file-input-btn">
                Choose {postType === 'photo' ? 'Photos' : postType === 'brief' ? 'Short Video (max 60s)' : 'Videos'}
              </label>
              <input
                id="file-input"
                type="file"
                multiple={postType === 'photo'}
                accept={postType === 'photo' ? 'image/*' : 'video/*'}
                onChange={handleFileChange}
                className="file-input"
              />
            </div>
          )}

          {preview.length > 0 && (
            <div className="post-media" style={{ margin: '1rem 0' }}>
              {preview.map((item, idx) => (
                <div key={idx} style={{ position: 'relative' }}>
                  {item.type === 'video' ? (
                    <video width="200" height="200" controls>
                      <source src={item.url} />
                    </video>
                  ) : (
                    <img src={item.url} alt="Preview" width="200" height="200" style={{ objectFit: 'cover' }} />
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      background: 'rgba(0,0,0,0.7)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '30px',
                      height: '30px',
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Posting...' : 'Post'}
          </button>
        </form>
      </div>
    </div>
  );
}
