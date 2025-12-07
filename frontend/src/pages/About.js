import React from 'react';

export default function About() {
  return (
    <div className="about-container" style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      
      {/* About Socially Section */}
      <div
        style={{
          backgroundColor: 'var(--primary-light, #e0f7fa)',
          padding: '2rem',
          borderRadius: '1rem',
          textAlign: 'center',
          marginBottom: '2rem',
        }}
      >
        <h1>📱 About Socially</h1>
        <p
          style={{
            color: 'var(--text-light, #555)',
            fontSize: '1.2rem',
            maxWidth: '700px',
            margin: '1rem auto 0 auto',
            lineHeight: '1.5',
          }}
        >
          Socially is more than just a social media app — it’s a space where people connect, share their lives, and build meaningful communities. 🌟
          Whether you want to share moments, discover new interests, or chat with friends in real-time, Socially is designed to bring people together in a safe and inclusive environment. 🤝
        </p>
      </div>

      <div className="about-content">
        
        {/* Our Mission */}
        <div className="about-section">
          <h2>🌟 Our Mission</h2>
          <p>
            Socially is dedicated to creating a vibrant, inclusive social platform where people can connect, share, and grow together. We believe in the power of authentic connections and meaningful interactions.
          </p>
        </div>

        {/* What We Offer */}
        <div className="about-section">
          <h2>🎯 What We Offer</h2>
          <ul className="about-list">
            <li><strong>Connect:</strong> Share your life with friends and family through posts, photos, and videos</li>
            <li><strong>Discover:</strong> Explore groups with shared interests and find like-minded people</li>
            <li><strong>Communicate:</strong> Use our real-time messenger to stay in touch with your network</li>
            <li><strong>Share:</strong> Seamlessly distribute your posts with your social circles</li>
            <li><strong>Control:</strong> Manage your privacy with granular content visibility options</li>
          </ul>
        </div>

        {/* Our Values */}
        <div className="about-section">
          <h2>💡 Our Values</h2>
          <div className="values-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            {[
              { emoji: '🤝', title: 'Community First', desc: 'We prioritize the needs and well-being of our community members' },
              { emoji: '🔒', title: 'Privacy & Security', desc: 'Your data and privacy are paramount to everything we do' },
              { emoji: '✨', title: 'Innovation', desc: 'Constantly evolving to bring you better features and experiences' },
              { emoji: '🌍', title: 'Inclusivity', desc: 'A platform for everyone, regardless of background or interests' },
            ].map((value, index) => (
              <div key={index} className="value-card" style={{ flex: '1 1 200px', backgroundColor: '#f5f5f5', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div className="value-emoji" style={{ fontSize: '2rem' }}>{value.emoji}</div>
                <h3>{value.title}</h3>
                <p>{value.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="about-section">
          <h2>🚀 Features</h2>
          <ul className="about-list">
            <li>Create and share posts with customizable privacy settings</li>
            <li>Join and manage groups around your interests</li>
            <li>Real-time messaging with your connections</li>
            <li>Like, comment, and share posts with your network</li>
            <li>Manage your profile and customize your experience</li>
            <li>Friend requests and friend management</li>
          </ul>
        </div>

        {/* About the Owner */}
        <div className="about-section">
          <h2>👤 About the Owner</h2>
          <p>
            Socially was founded by <strong>Mason</strong>, a passionate developer and community-builder who believes in creating meaningful social experiences. Mason's vision is to empower people to connect authentically and share what matters most in a safe, inclusive environment.
          </p>
        </div>

        {/* Contact Section */}
        <div
          style={{
            marginTop: '3rem',
            padding: '1.5rem',
            backgroundColor: 'var(--light, #fafafa)',
            borderRadius: '0.5rem',
            borderLeft: '4px solid var(--primary, #00bcd4)',
          }}
        >
          <h3 style={{ color: 'var(--primary, #00bcd4)', marginBottom: '0.5rem' }}>📞 Get in Touch</h3>
          <p style={{ color: 'var(--text-light, #555)' }}>
            Questions or feedback? Check out our <a href="/contact" style={{ color: 'var(--primary, #00bcd4)', textDecoration: 'none', fontWeight: '600' }}>Contact Us</a> page or review our <a href="/guidelines" style={{ color: 'var(--primary, #00bcd4)', textDecoration: 'none', fontWeight: '600' }}>Community Guidelines</a>.
          </p>
        </div>

      </div>
    </div>
  );
}
