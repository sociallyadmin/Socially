import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import '../styles/ChatWindow.css';

export default function ChatWindow({ conversation, user, apiBase, onBack }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [showAddUsers, setShowAddUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const messagesEndRef = useRef(null);

  const fetchMessagesCallback = useCallback(async () => {
    try {
      const response = await axios.get(`${apiBase}/conversations/${conversation.id}/messages`);
      setMessages(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }, [conversation.id, apiBase]);

  useEffect(() => {
    fetchMessagesCallback();
    const interval = setInterval(fetchMessagesCallback, 2000);
    return () => clearInterval(interval);
  }, [fetchMessagesCallback, conversation.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    try {
      await axios.post(
        `${apiBase}/conversations/${conversation.id}/messages`,
        { content: inputValue }
      );
      setInputValue('');
      fetchMessagesCallback();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleEditMessage = async (messageId) => {
    if (!editContent.trim()) return;

    try {
      await axios.put(
        `${apiBase}/conversations/${conversation.id}/messages/${messageId}`,
        { content: editContent }
      );
      setEditingId(null);
      setEditContent('');
      fetchMessagesCallback();
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Delete message?')) return;

    try {
      await axios.delete(
        `${apiBase}/conversations/${conversation.id}/messages/${messageId}`
      );
      fetchMessagesCallback();
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await axios.get(`${apiBase}/search`, {
        params: { q: query }
      });
      const currentParticipants = conversation.participants.map(p => p.id);
      setSearchResults(response.data.filter(u => !currentParticipants.includes(u.id)));
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleAddUser = async (userId) => {
    try {
      await axios.post(
        `${apiBase}/conversations/${conversation.id}/add-participants`,
        { userIds: [userId] }
      );
      setSearchQuery('');
      setSearchResults([]);
      setShowAddUsers(false);
      window.location.reload();
    } catch (err) {
      console.error('Failed to add user:', err);
    }
  };

  const participantNames = conversation.participants
    .map(p => p.username)
    .join(', ');

  return (
    <div className="chat-window card" style={{ maxWidth: 600, margin: '2rem auto', boxShadow: 'var(--card-shadow)' }}>
      <div className="chat-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: 16 }}>
        <button className="btn btn-primary" style={{ minWidth: 80 }} onClick={onBack}>← Back</button>
        <div className="chat-info" style={{ flex: 1 }}>
          <h3 style={{ margin: 0 }}>{participantNames}</h3>
          <div className="participant-count" style={{ color: 'var(--text-light)', fontSize: '0.95em' }}>{conversation.participants.length} participants</div>
        </div>
        <button 
          className="btn btn-accent"
          onClick={() => setShowAddUsers(!showAddUsers)}
          title="Add users to chat"
          style={{ minWidth: 80 }}
        >
          ➕ Add
        </button>
      </div>

      {showAddUsers && (
        <div className="add-users-panel card" style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Search users to add..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="form-control"
            style={{ marginBottom: 8 }}
          />
          {searchResults.length > 0 && (
            <div className="add-users-results">
              {searchResults.map(u => (
                <div 
                  key={u.id} 
                  className="add-user-item"
                  onClick={() => handleAddUser(u.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, cursor: 'pointer', borderRadius: 8, marginBottom: 4, background: 'var(--input-bg)' }}
                >
                  {u.avatar && <img src={u.avatar} alt={u.username} style={{ width: 32, height: 32, borderRadius: '50%' }} />}
                  <span>{u.username}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="messages-container" style={{ minHeight: 320, marginBottom: 16 }}>
        {loading ? (
          <div className="loading-messages">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="no-messages">No messages yet. Start the conversation!</div>
        ) : (
          messages.map(msg => (
            <div 
              key={msg.id} 
              className={`message ${msg.authorId === user.id ? 'own' : 'other'}`}
              style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start', background: msg.authorId === user.id ? 'var(--input-bg)' : 'transparent', borderRadius: 8, padding: 8 }}
            >
              <div className="message-avatar">
                {msg.authorAvatar ? (
                  <img src={msg.authorAvatar} alt={msg.authorName} style={{ width: 36, height: 36, borderRadius: '50%' }} />
                ) : (
                  <div className="avatar-placeholder" style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{msg.authorName[0]}</div>
                )}
              </div>
              <div className="message-content" style={{ flex: 1 }}>
                <div className="message-header" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span className="message-author" style={{ fontWeight: 600 }}>{msg.authorName}</span>
                  <span className="message-time" style={{ color: 'var(--text-light)', fontSize: '0.9em' }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                {editingId === msg.id ? (
                  <div className="edit-form" style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="form-control"
                      style={{ flex: 1 }}
                    />
                    <button 
                      onClick={() => handleEditMessage(msg.id)}
                      className="btn btn-success"
                    >
                      Save
                    </button>
                    <button 
                      onClick={() => setEditingId(null)}
                      className="btn btn-danger"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="message-text" style={{ margin: 0 }}>{msg.content}</p>
                    {msg.edited && (
                      <div className="message-edited" style={{ color: 'var(--text-light)', fontSize: '0.85em' }}>(edited)</div>
                    )}
                  </>
                )}
              </div>
              {msg.authorId === user.id && editingId !== msg.id && (
                <div className="message-actions" style={{ display: 'flex', gap: 4 }}>
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      setEditingId(msg.id);
                      setEditContent(msg.content);
                    }}
                    title="Edit message"
                    style={{ minWidth: 32 }}
                  >
                    ✎
                  </button>
                  <button 
                    className="btn btn-danger"
                    onClick={() => handleDeleteMessage(msg.id)}
                    title="Delete message"
                    style={{ minWidth: 32 }}
                  >
                    🗑
                  </button>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="message-input-area" style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type a message..."
          className="form-control"
          style={{ flex: 1 }}
        />
        <button 
          onClick={handleSendMessage}
          className="btn btn-primary"
          disabled={!inputValue.trim()}
          style={{ minWidth: 80 }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
