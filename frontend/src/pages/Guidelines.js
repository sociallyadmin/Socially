import React from 'react';

export default function Guidelines() {
  return (
    <div className="guidelines-container">
      <h1>📋 Community Guidelines</h1>
      <p style={{ textAlign: 'center', color: 'var(--text-light)', marginBottom: '2rem' }}>
        Please follow these guidelines to keep our community safe and welcoming for everyone.
      </p>

      <div className="guidelines-content">
        <div className="guideline-item">
          <div className="guideline-number">1</div>
          <div className="guideline-text">
            <h3>Be Respectful</h3>
            <p>Treat all members of the community with respect and dignity. Disagreements are okay, but personal attacks are not.</p>
          </div>
        </div>

        <div className="guideline-item">
          <div className="guideline-number">2</div>
          <div className="guideline-text">
            <h3>Be Nice to Other Users</h3>
            <p>Create a positive environment by being kind, supportive, and considerate to other users. Help build a community where everyone feels welcome.</p>
          </div>
        </div>

        <div className="guideline-item">
          <div className="guideline-number">3</div>
          <div className="guideline-text">
            <h3>Follow All Laws</h3>
            <p>Ensure all content and behavior comply with applicable laws and regulations. Illegal activities will not be tolerated.</p>
          </div>
        </div>

        <div className="guideline-item">
          <div className="guideline-number">4</div>
          <div className="guideline-text">
            <h3>Listen to Warnings Given by Administrators</h3>
            <p>Our administrators enforce these guidelines fairly. If warned, take the feedback seriously and adjust your behavior accordingly.</p>
          </div>
        </div>


      </div>

      <div style={{ marginTop: '3rem', padding: '1.5rem', backgroundColor: 'var(--light)', borderRadius: '0.5rem', borderLeft: '4px solid var(--primary)' }}>
        <h3 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>⚠️ Enforcement</h3>
        <p style={{ color: 'var(--text-light)' }}>
          Violations of these guidelines may result in warnings, content removal, temporary suspension, or permanent bans, depending on the severity and frequency of violations.
        </p>
      </div>
    </div>
  );
}
