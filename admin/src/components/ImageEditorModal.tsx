import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button, TextInput } from '@strapi/design-system';
import { useIntl } from 'react-intl';

export interface ImageEditorResult {
  src: string;
  alt: string;
  caption: string;
  width?: number | null;
  height?: number | null;
}

interface ImageEditorModalProps {
  open: boolean;
  src: string;
  alt: string;
  caption?: string;
  onClose: () => void;
  onSave: (result: ImageEditorResult) => void;
}

type AspectPreset = 'free' | '16:9' | '4:3' | '1:1';

export function ImageEditorModal({
  open,
  src,
  alt: initialAlt,
  caption: initialCaption = '',
  onClose,
  onSave,
}: ImageEditorModalProps) {
  const { formatMessage } = useIntl();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [aspectPreset, setAspectPreset] = useState<AspectPreset>('free');
  const [altText, setAltText] = useState<string>(initialAlt || '');
  const [captionText, setCaptionText] = useState<string>(initialCaption || '');
  const [imgLoaded, setImgLoaded] = useState<boolean>(false);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setZoom(1);
    setAspectPreset('free');
    setAltText(initialAlt || '');
    setCaptionText(initialCaption || '');
    setImgLoaded(false);

    if (typeof window !== 'undefined' && src) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageElementRef.current = img;
        setImgLoaded(true);
      };
      img.onerror = () => {
        imageElementRef.current = null;
        setImgLoaded(false);
      };
      img.src = src;
    }
  }, [open, src, initialAlt, initialCaption]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageElementRef.current;
    if (!canvas || !img || !imgLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isRotated90 = Math.abs(rotation % 180) === 90;
    const rawW = isRotated90 ? img.naturalHeight : img.naturalWidth;
    const rawH = isRotated90 ? img.naturalWidth : img.naturalHeight;

    let targetW = rawW;
    let targetH = rawH;

    if (aspectPreset === '16:9') {
      targetH = Math.round((targetW * 9) / 16);
    } else if (aspectPreset === '4:3') {
      targetH = Math.round((targetW * 3) / 4);
    } else if (aspectPreset === '1:1') {
      const side = Math.min(targetW, targetH);
      targetW = side;
      targetH = side;
    }

    const maxPreview = 420;
    const scale = Math.min(1, maxPreview / Math.max(targetW || 1, targetH || 1));
    canvas.width = Math.max(1, Math.round(targetW * scale));
    canvas.height = Math.max(1, Math.round(targetH * scale));

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale((flipH ? -1 : 1) * zoom, (flipV ? -1 : 1) * zoom);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }, [rotation, flipH, flipV, zoom, aspectPreset, imgLoaded]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  if (!open) return null;

  const hasTransform =
    rotation !== 0 || flipH || flipV || zoom !== 1 || aspectPreset !== 'free';

  const handleApply = () => {
    let finalSrc = src;
    let finalW: number | undefined;
    let finalH: number | undefined;

    if (hasTransform && canvasRef.current && imgLoaded) {
      try {
        finalSrc = canvasRef.current.toDataURL('image/png');
        finalW = canvasRef.current.width;
        finalH = canvasRef.current.height;
      } catch {
        // Cross-origin canvas taint fallback: preserve original src
        finalSrc = src;
      }
    }

    onSave({
      src: finalSrc,
      alt: altText.trim(),
      caption: captionText.trim(),
      ...(finalW ? { width: finalW } : {}),
      ...(finalH ? { height: finalH } : {}),
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={formatMessage({
        id: 'tiptap-editor.imageEditor.title',
        defaultMessage: 'Image Editor (Crop, Rotate & Caption)',
      })}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        backgroundColor: 'rgba(33, 33, 52, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          maxWidth: '580px',
          width: '100%',
          padding: '20px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        }}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: '1.6rem', fontWeight: 600 }}>
          {formatMessage({
            id: 'tiptap-editor.imageEditor.title',
            defaultMessage: 'Image Editor (Crop, Rotate & Caption)',
          })}
        </h3>

        <div
          style={{
            background: '#f6f6f9',
            borderRadius: '6px',
            padding: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '220px',
            marginBottom: '12px',
          }}
        >
          {imgLoaded ? (
            <canvas
              ref={canvasRef}
              style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '4px' }}
            />
          ) : (
            <img
              src={src}
              alt={altText}
              style={{ maxWidth: '100%', maxHeight: '260px', borderRadius: '4px' }}
            />
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '12px',
            alignItems: 'center',
          }}
        >
          <Button
            variant="tertiary"
            size="S"
            onClick={() => setRotation((r) => (r - 90) % 360)}
          >
            ↺ -90°
          </Button>
          <Button
            variant="tertiary"
            size="S"
            onClick={() => setRotation((r) => (r + 90) % 360)}
          >
            ↻ +90°
          </Button>
          <Button variant="tertiary" size="S" onClick={() => setFlipH((f) => !f)}>
            ⇆ Flip H
          </Button>
          <Button variant="tertiary" size="S" onClick={() => setFlipV((f) => !f)}>
            ⇅ Flip V
          </Button>
          {(['free', '16:9', '4:3', '1:1'] as AspectPreset[]).map((preset) => (
            <Button
              key={preset}
              variant={aspectPreset === preset ? 'secondary' : 'tertiary'}
              size="S"
              onClick={() => setAspectPreset(preset)}
            >
              {preset.toUpperCase()}
            </Button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <label
            htmlFor="tiptap-image-zoom"
            style={{ fontSize: '1.2rem', fontWeight: 500, minWidth: '60px' }}
          >
            Zoom ({Math.round(zoom * 100)}%)
          </label>
          <input
            id="tiptap-image-zoom"
            type="range"
            min="0.5"
            max="2.5"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            style={{ flexGrow: 1 }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          <TextInput
            placeholder={formatMessage({
              id: 'tiptap-editor.image.altText',
              defaultMessage: 'Alt text (accessibility description)',
            })}
            value={altText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAltText(e.target.value)}
            aria-label={formatMessage({
              id: 'tiptap-editor.image.altText',
              defaultMessage: 'Alt text',
            })}
          />
          <TextInput
            placeholder={formatMessage({
              id: 'tiptap-editor.image.caption',
              defaultMessage: 'Figure caption (<figcaption>)',
            })}
            value={captionText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCaptionText(e.target.value)}
            aria-label={formatMessage({
              id: 'tiptap-editor.image.caption',
              defaultMessage: 'Figure caption',
            })}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button variant="tertiary" onClick={onClose}>
            {formatMessage({ id: 'tiptap-editor.common.cancel', defaultMessage: 'Cancel' })}
          </Button>
          <Button variant="default" onClick={handleApply}>
            {formatMessage({ id: 'tiptap-editor.common.apply', defaultMessage: 'Apply' })}
          </Button>
        </div>
      </div>
    </div>
  );
}
