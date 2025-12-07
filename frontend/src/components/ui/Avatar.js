import React, { useState } from 'react';

export default function Avatar({ src, alt = 'Avatar', size = 'md', className = '' }) {
  const [errored, setErrored] = useState(false);

  const sizeMap = {
    sm: 32,
    md: 48,
    lg: 72
  };

  const dim = sizeMap[size] || sizeMap.md;

  const style = {
    width: dim,
    height: dim,
    borderRadius: '50%',
    objectFit: 'cover',
    display: 'inline-block'
  };

  if (!src || errored) {
    // simple colored placeholder with initials could be added later
    return (
      <div
        className={`avatar-placeholder ${className}`}
        style={{
          ...style,
          background: 'linear-gradient(135deg, #eef2ff, #fce7f3)',
          color: '#374151',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700
        }}
        aria-label={alt}
      >
        {alt ? alt.charAt(0).toUpperCase() : 'U'}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setErrored(true)}
      className={`avatar ${className}`}
      style={style}
    />
  );
}
