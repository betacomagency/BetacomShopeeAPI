/**
 * ImageWithZoom - Component hiển thị ảnh với zoom khi hover
 * Dùng chung cho tất cả các trang có hiển thị ảnh sản phẩm
 * Sử dụng Portal để render zoom image ra ngoài container tránh bị cắt bởi overflow
 */

import { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface ImageWithZoomProps {
  src: string;
  alt: string;
  className?: string;
  zoomSize?: number;
}

/** Calculate zoom position relative to image element */
function calcZoomPosition(rect: DOMRect, zoomSize: number) {
  let top = rect.top;
  let left = rect.right + 8;

  if (left + zoomSize > window.innerWidth) {
    left = rect.left - zoomSize - 8;
  }
  if (left < 0) left = 8;
  if (top + zoomSize > window.innerHeight) {
    top = window.innerHeight - zoomSize - 8;
  }
  if (top < 0) top = 8;

  return { top, left };
}

export function ImageWithZoom({
  src,
  alt,
  className,
  zoomSize = 280,
}: ImageWithZoomProps) {
  const [showZoom, setShowZoom] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Compute position on render when zoom is visible (no useEffect + setState)
  const position = useMemo(() => {
    if (!showZoom || !imgRef.current) return { top: 0, left: 0 };
    return calcZoomPosition(imgRef.current.getBoundingClientRect(), zoomSize);
  }, [showZoom, zoomSize]);

  return (
    <>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={cn('cursor-pointer', className)}
        onMouseEnter={() => setShowZoom(true)}
        onMouseLeave={() => setShowZoom(false)}
      />
      {showZoom &&
        createPortal(
          <div
            className="fixed bg-card rounded-lg shadow-2xl border-2 border-border p-1 pointer-events-none"
            style={{
              top: position.top,
              left: position.left,
              width: zoomSize,
              height: zoomSize,
              zIndex: 99999,
            }}
          >
            <img
              src={src}
              alt={alt}
              className="w-full h-full object-contain rounded"
            />
          </div>,
          document.body
        )}
    </>
  );
}

export default ImageWithZoom;
