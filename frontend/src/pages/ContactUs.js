import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://api.sociallyapp.org/api';

export default function ContactUs({ apiBase }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API_BASE}/contact`, formData);
      setSubmitted(true);
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err) {
      console.error('Failed to send message');
      alert('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="contact-form">
      <h2>📞 Contact Us</h2>
      <p style={{ textAlign: 'center', color: 'var(--text-light)', marginBottom: '2rem' }}>
        Have questions or feedback? We'd love to hear from you!
      </p>

      {submitted && (
        <div className="success-message">
          ✅ Message sent successfully! We'll get back to you soon.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Your name"
            required
          />
        </div>

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Your email"
            required
          />
        </div>

        <div className="form-group">
          <label>Subject</label>
          <input
            type="text"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            placeholder="Subject of your message"
            required
          />
        </div>

        <div className="form-group">
          <label>Message</label>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            placeholder="Your message..."
            required
            rows="6"
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Sending...' : 'Send Message'}
        </button>
      </form>

      <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '2px solid var(--border)' }}>
        <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Other Ways to Reach Us</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ background: 'var(--light)', padding: '1rem', borderRadius: '0.5rem' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>📧 Email</div>
            <div style={{ color: 'var(--text-light)' }}>contact@sociallyapp.org</div>
          </div>
          <div style={{ background: 'var(--light)', padding: '1rem', borderRadius: '0.5rem' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>🐦 Twitter</div>
            <div style={{ color: 'var(--text-light)' }}>@SociallyApp</div>
          </div>
          <div style={{ background: 'var(--light)', padding: '1rem', borderRadius: '0.5rem' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>💬 Discord</div>
            <div style={{ color: 'var(--text-light)' }}>Join our community</div>
          </div>
        </div>
      </div>
    </div>
  );
}
