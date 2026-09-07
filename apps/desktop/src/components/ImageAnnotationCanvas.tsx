import React, { useRef, useState, useEffect } from 'react';

export type AnnotationTool = 'rectangle' | 'arrow' | 'redact' | 'text';

interface Annotation {
  id: string;
  type: AnnotationTool;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  text?: string;
  color: string;
}

export interface ImageAnnotationCanvasProps {
  imageSrc: string;
  onSave: (annotatedDataUrl: string) => void;
  onCancel: () => void;
}

export function ImageAnnotationCanvas({
  imageSrc,
  onSave,
  onCancel,
}: ImageAnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<AnnotationTool>('rectangle');
  const [color, setColor] = useState('#ef4444'); // rose/red
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState('Bug here');

  // Load the image onto image element
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      setLoadedImage(img);
    };
  }, [imageSrc]);

  // Redraw canvas on state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions matching loaded image natural size
    canvas.width = loadedImage.naturalWidth;
    canvas.height = loadedImage.naturalHeight;

    // Draw base image
    ctx.drawImage(loadedImage, 0, 0);

    // Draw committed annotations
    const drawAnnotation = (a: Annotation) => {
      ctx.save();
      if (a.type === 'rectangle') {
        ctx.strokeStyle = a.color;
        ctx.lineWidth = Math.max(3, Math.round(canvas.width / 300));
        ctx.strokeRect(a.startX, a.startY, a.endX - a.startX, a.endY - a.startY);
      } else if (a.type === 'redact') {
        ctx.fillStyle = '#09090b';
        ctx.fillRect(a.startX, a.startY, a.endX - a.startX, a.endY - a.startY);
      } else if (a.type === 'arrow') {
        ctx.strokeStyle = a.color;
        ctx.fillStyle = a.color;
        ctx.lineWidth = Math.max(3, Math.round(canvas.width / 300));

        // Draw line
        ctx.beginPath();
        ctx.moveTo(a.startX, a.startY);
        ctx.lineTo(a.endX, a.endY);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(a.endY - a.startY, a.endX - a.startX);
        const headLen = Math.max(12, Math.round(canvas.width / 70));
        ctx.beginPath();
        ctx.moveTo(a.endX, a.endY);
        ctx.lineTo(
          a.endX - headLen * Math.cos(angle - Math.PI / 6),
          a.endY - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          a.endX - headLen * Math.cos(angle + Math.PI / 6),
          a.endY - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      } else if (a.type === 'text' && a.text) {
        const fontSize = Math.max(16, Math.round(canvas.width / 50));
        ctx.font = `bold ${fontSize}px sans-serif`;
        const textMetrics = ctx.measureText(a.text);
        const pad = 6;

        // Label background pill
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(
          a.startX - pad,
          a.startY - fontSize - pad / 2,
          textMetrics.width + pad * 2,
          fontSize + pad
        );

        // Label text
        ctx.fillStyle = a.color;
        ctx.fillText(a.text, a.startX, a.startY);
      }
      ctx.restore();
    };

    for (const ann of annotations) {
      drawAnnotation(ann);
    }

    // Draw active drawing preview
    if (isDrawing && startPos && currentPos) {
      drawAnnotation({
        id: 'preview',
        type: tool,
        startX: startPos.x,
        startY: startPos.y,
        endX: currentPos.x,
        endY: currentPos.y,
        text: tool === 'text' ? textInput : undefined,
        color,
      });
    }
  }, [loadedImage, annotations, isDrawing, startPos, currentPos, tool, color, textInput]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    setIsDrawing(true);
    setStartPos(coords);
    setCurrentPos(coords);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setCurrentPos(getCanvasCoords(e));
  };

  const handleMouseUp = () => {
    if (!isDrawing || !startPos || !currentPos) {
      setIsDrawing(false);
      return;
    }

    // Only commit if moved at least 5 pixels or tool is text
    const dist = Math.hypot(currentPos.x - startPos.x, currentPos.y - startPos.y);
    if (dist > 5 || tool === 'text') {
      const newAnn: Annotation = {
        id: `ann-${Date.now()}`,
        type: tool,
        startX: startPos.x,
        startY: startPos.y,
        endX: currentPos.x,
        endY: currentPos.y,
        text: tool === 'text' ? textInput : undefined,
        color,
      };
      setAnnotations((prev) => [...prev, newAnn]);
    }

    setIsDrawing(false);
    setStartPos(null);
    setCurrentPos(null);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  const handleUndo = () => {
    setAnnotations((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setAnnotations([]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Screenshot Annotation Editor"
    >
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Toolbar Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] bg-[var(--canvas)] select-none">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-[var(--text)]">
              Annotate Screenshot
            </span>

            <div className="h-3 w-[1px] bg-[var(--border)] mx-1" />

            {/* Tools */}
            <div className="flex items-center gap-1 bg-[var(--card)] p-0.5 rounded border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setTool('rectangle')}
                className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                  tool === 'rectangle'
                    ? 'bg-[var(--canvas)] text-[var(--text)] font-semibold shadow-xs'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
                title="Highlight Box"
              >
                Rectangle
              </button>

              <button
                type="button"
                onClick={() => setTool('arrow')}
                className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                  tool === 'arrow'
                    ? 'bg-[var(--canvas)] text-[var(--text)] font-semibold shadow-xs'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
                title="Defect Arrow"
              >
                Arrow
              </button>

              <button
                type="button"
                onClick={() => setTool('redact')}
                className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                  tool === 'redact'
                    ? 'bg-[var(--canvas)] text-[var(--text)] font-semibold shadow-xs'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
                title="Redact / Blur Box"
              >
                Redact
              </button>

              <button
                type="button"
                onClick={() => setTool('text')}
                className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                  tool === 'text'
                    ? 'bg-[var(--canvas)] text-[var(--text)] font-semibold shadow-xs'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
                title="Text Label"
              >
                Text
              </button>
            </div>

            {/* Text input when tool is text */}
            {tool === 'text' && (
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Callout text..."
                aria-label="Callout text"
                className="text-[11px] px-2 py-1 bg-[var(--card)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none w-32"
              />
            )}

            {/* Colors */}
            <div className="flex items-center gap-1.5 ml-2">
              {[
                { hex: '#ef4444', label: 'Red' },
                { hex: '#f59e0b', label: 'Amber' },
                { hex: '#10b981', label: 'Emerald' },
                { hex: '#06b6d4', label: 'Cyan' },
                { hex: '#ffffff', label: 'White' },
              ].map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  className={`w-4 h-4 rounded-full border transition-transform ${
                    color === c.hex ? 'scale-125 border-[var(--text)]' : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                  aria-label={c.label}
                />
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={annotations.length === 0}
              className="px-2 py-1 text-[11px] font-medium rounded text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40"
              title="Undo last annotation"
            >
              Undo
            </button>

            <button
              type="button"
              onClick={handleClear}
              disabled={annotations.length === 0}
              className="px-2 py-1 text-[11px] font-medium rounded text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40"
              title="Clear all annotations"
            >
              Clear
            </button>

            <div className="h-3 w-[1px] bg-[var(--border)] mx-1" />

            <button
              type="button"
              onClick={onCancel}
              className="px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] hover:text-[var(--text)] rounded"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1 text-[11px] font-medium bg-[var(--accent)] text-white rounded hover:opacity-90 transition-opacity"
            >
              Attach to Execution
            </button>
          </div>
        </div>

        {/* Canvas viewport */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[var(--canvas)]/80 select-none">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="max-w-full max-h-[70vh] object-contain border border-[var(--border)] rounded cursor-crosshair shadow-sm"
          />
        </div>
      </div>
    </div>
  );
}
