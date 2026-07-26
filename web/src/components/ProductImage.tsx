import React, { useState } from 'react';

interface ProductImageProps {
  icon?: string;
  size?: number;
  style?: React.CSSProperties;
}

export const ProductImage: React.FC<ProductImageProps> = ({ icon, size = 48, style }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const finalIcon = icon ? icon.trim() : '';

  const isRealPhoto =
    !error &&
    (finalIcon.startsWith('http') ||
      finalIcon.startsWith('file:') ||
      finalIcon.startsWith('data:') ||
      finalIcon.startsWith('/'));

  const containerStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '10px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: '#F3F4F6',
    border: '1.5px solid #EBEBEB',
    boxSizing: 'border-box',
    ...style,
  };

  if (isRealPhoto) {
    return (
      <div style={containerStyle}>
        {/* Blur placeholder while loading */}
        {!loaded && (
          <div
            className="image-loading-placeholder"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#E5E7EB',
              filter: 'blur(8px)',
              zIndex: 1,
            }}
          />
        )}
        <img
          src={finalIcon}
          alt="Product"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.25s ease-in-out',
          }}
        />
      </div>
    );
  }

  // If the icon is an emoji or a short custom icon (e.g. length <= 4), render it directly
  if (finalIcon && finalIcon.length <= 4) {
    const emojiFontSize = Math.max(12, Math.round(size * 0.55));
    return (
      <div style={containerStyle}>
        <span style={{ fontSize: `${emojiFontSize}px`, lineHeight: 1 }}>{finalIcon}</span>
      </div>
    );
  }

  // Dynamic font sizing based on container size
  const shopbookFontSize = size === 48 ? 8 : Math.max(6, Math.round(size * 0.13));
  const posFontSize = size === 48 ? 18 : Math.max(10, Math.round(size * 0.31));

  return (
    <div style={containerStyle}>
      <span
        style={{
          fontSize: `${shopbookFontSize}px`,
          fontWeight: '700',
          color: '#C8C8C8',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}
      >
        SHOPBOOK
      </span>
      <span
        style={{
          fontSize: `${posFontSize}px`,
          fontWeight: 'bold',
          color: '#B0B0B0',
          letterSpacing: '0.5px',
          lineHeight: 1.1,
          marginTop: '2px',
        }}
      >
        POS
      </span>
    </div>
  );
};
