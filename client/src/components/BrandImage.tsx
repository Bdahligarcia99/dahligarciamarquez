// client/src/components/BrandImage.tsx
// Configurable image slot component for branding images
// These can later be made editable from dashboard settings

import { BRAND_IMAGES, SITE_NAME } from '../config/branding';

type ImageSlot = keyof typeof BRAND_IMAGES;

interface BrandImageProps {
  slot: ImageSlot;
  className?: string;
  maxHeight?: number;
  maxWidth?: number;
  alt?: string;
  fallback?: React.ReactNode;
  showPlaceholder?: boolean; // Show placeholder when no image (dev mode)
  rounded?: boolean; // Make placeholder circular (for profile images)
}

export default function BrandImage({
  slot,
  className = '',
  maxHeight,
  maxWidth,
  alt,
  fallback,
  showPlaceholder = true,
  rounded = false,
}: BrandImageProps) {
  const imageUrl = BRAND_IMAGES[slot];
  const slotAlt = alt || `${SITE_NAME} ${slot.replace(/-/g, ' ')}`;

  // If we have an image URL, render the image
  if (imageUrl) {
    // For rounded images, use fixed dimensions and cover
    if (rounded) {
      const size = maxHeight || maxWidth || 160;
      return (
        <img
          src={imageUrl}
          alt={slotAlt}
          className={`object-cover rounded-full ${className}`}
          style={{
            width: `${size}px`,
            height: `${size}px`,
          }}
        />
      );
    }
    
    return (
      <img
        src={imageUrl}
        alt={slotAlt}
        className={`object-contain ${className}`}
        style={{
          maxHeight: maxHeight ? `${maxHeight}px` : undefined,
          maxWidth: maxWidth ? `${maxWidth}px` : undefined,
          height: 'auto',
          width: 'auto',
        }}
      />
    );
  }

  // Show placeholder box (with fallback content inside, or slot name)
  if (showPlaceholder) {
    // Circular placeholder for profile images
    if (rounded) {
      const size = maxHeight || maxWidth || 160;
      return (
        <div
          className={`
            flex flex-col items-center justify-center
            border-2 border-dashed border-gray-300 
            bg-gray-50 text-gray-400
            rounded-full
            ${className}
          `}
          style={{
            width: `${size}px`,
            height: `${size}px`,
          }}
          title={`Image slot: ${slot} (click to configure in dashboard)`}
        >
          <svg
            className="w-8 h-8 mb-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span className="text-xs font-medium">{slot}</span>
        </div>
      );
    }

    // Rectangular placeholder (default)
    return (
      <div
        className={`
          flex items-center justify-center gap-2
          border-2 border-dashed border-gray-300 
          bg-gray-50 text-gray-500 
          rounded-md px-3 py-2
          font-medium
          ${className}
        `}
        style={{
          minHeight: maxHeight ? `${maxHeight}px` : '40px',
          maxHeight: maxHeight ? `${maxHeight}px` : undefined,
          minWidth: '80px',
          maxWidth: maxWidth ? `${maxWidth}px` : '240px',
        }}
        title={`Image slot: ${slot} (click to configure in dashboard)`}
      >
        <svg
          className="w-4 h-4 flex-shrink-0 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        {fallback || <span className="truncate text-sm">{slot}</span>}
      </div>
    );
  }

  // No placeholder - just show fallback or nothing
  if (fallback) {
    return <>{fallback}</>;
  }

  return null;
}

