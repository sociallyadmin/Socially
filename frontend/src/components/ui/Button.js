import React from 'react';

export default function Button({
  children,
  onClick,
  className = '',
  variant = 'primary',
  size = '',
  type = 'button',
  disabled = false,
  ...props
}) {
  const variantClass = variant ? `btn-${variant}` : '';
  const sizeClass = size === 'sm' ? 'btn-sm' : '';
  const classes = ['btn', variantClass, sizeClass, className].filter(Boolean).join(' ');

  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  );
}
