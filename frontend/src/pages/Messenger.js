import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import ChatWindow from '../components/ChatWindow';
import '../styles/Messenger.css';

export default function Messenger({ user, apiBase }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);

  const fetchConversationsCallback = useCallback(async () => {
    try {
      const response = await axios.get(`${apiBase}/conversations`);
      setConversations(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchConversationsCallback();
    const interval = setInterval(fetchConversationsCallback, 3000);
    return () => clearInterval(interval);
  }, [fetchConversationsCallback]);

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
      setSearchResults(response.data);
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleSelectUser = (user) => {
    if (!selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user]);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const handleRemoveUser = (userId) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
  };

  const handleCreateChat = async () => {
    if (selectedUsers.length === 0) return;
    
    try {
      const response = await axios.post(`${apiBase}/conversations`, {
        participantIds: selectedUsers.map(u => u.id)
      });
      setSelectedConversation(response.data);
      setSelectedUsers([]);
      setShowNewChat(false);
      fetchConversationsCallback();
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  if (selectedConversation) {
    return (
      <ChatWindow 
        conversation={selectedConversation}
        user={user}
        apiBase={apiBase}
        onBack={() => {
          setSelectedConversation(null);
          fetchConversationsCallback();
        }}
      />
    );
  }

  return (
    <div className="messenger-container">
      <div className="conversations-list">
        <div className="messenger-header">
          <h2>Messages</h2>
          <button 
            className="new-chat-btn"
            onClick={() => setShowNewChat(!showNewChat)}
          >
            ✎
          </button>
        </div>

        {showNewChat && (
          <div className="new-chat-panel">
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="search-input"
            />
            
            {selectedUsers.length > 0 && (
              <div className="selected-users">
                {selectedUsers.map(u => (
                  <div key={u.id} className="selected-user">
                    <span>{u.username}</span>
                    <button 
                      onClick={() => handleRemoveUser(u.id)}
                      className="remove-user-btn"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map(u => (
                  <div 
                    key={u.id} 
                    className="search-result-item"
                    onClick={() => handleSelectUser(u)}
                  >
                    {u.avatar && <img src={u.avatar} alt={u.username} />}
                    <div>
                      <div className="result-username">{u.username}</div>
                      {u.bio && <div className="result-bio">{u.bio}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedUsers.length > 0 && (
              <button 
                className="start-chat-btn"
                onClick={handleCreateChat}
              >
                Start Chat
              </button>
            )}
          </div>
        )}

        <div className="conversations-scroll">
          {loading ? (
            <div className="loading-conversations">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="no-conversations">No conversations yet</div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                className="conversation-item"
                onClick={() => setSelectedConversation(conv)}
              >
                <div className="conversation-participants">
                  {conv.otherParticipants.map(p => p.username).join(', ')}
                </div>
                {conv.lastMessage && (
                  <div className="conversation-preview">{conv.lastMessage}</div>
                )}
                <div className="conversation-time">
                  {conv.lastMessageTime && new Date(conv.lastMessageTime).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
