"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Eraser, CheckCircle2, PenTool, Type, AlertCircle } from "lucide-react";

interface SignatureCanvasProps {
  onSign: (dataUrl: string) => void;
  onCancel?: () => void;
  signerName?: string;
  isSubmitting?: boolean;
}

export function SignatureCanvas({
  onSign,
  onCancel,
  signerName = "",
  isSubmitting = false,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typedName, setTypedName] = useState(signerName);
  const [error, setError] = useState<string | null>(null);

  // Initialize canvas with proper DPI scaling
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#0f172a"; // Deep navy ink

    // Fill white background for signature artifact
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  useEffect(() => {
    setupCanvas();
    const handleResize = () => setupCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setupCanvas]);

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setError(null);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
    setError(null);
  };

  const renderTypedSignatureToCanvas = (): string | null => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Fill white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw stylized cursive text
    ctx.font = "italic 48px 'Brush Script MT', cursive, 'Caveat', sans-serif";
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(typedName.trim(), canvas.width / 2, canvas.height / 2);

    return canvas.toDataURL("image/png");
  };

  const handleConfirm = () => {
    if (mode === "draw") {
      if (!hasDrawn || !canvasRef.current) {
        setError("Please draw your signature before submitting");
        return;
      }
      const dataUrl = canvasRef.current.toDataURL("image/png");
      onSign(dataUrl);
    } else {
      if (!typedName.trim()) {
        setError("Please type your legal name to create a signature");
        return;
      }
      const dataUrl = renderTypedSignatureToCanvas();
      if (!dataUrl) {
        setError("Failed to generate signature from name");
        return;
      }
      onSign(dataUrl);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-card border border-border rounded-2xl shadow-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Sign Contract</h3>
          <p className="text-xs text-muted-foreground">
            Your cryptographic digital signature will be stamped on this document
          </p>
        </div>
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
          <button
            type="button"
            id="signature-mode-draw-btn"
            onClick={() => setMode("draw")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === "draw"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            Draw
          </button>
          <button
            type="button"
            id="signature-mode-type-btn"
            onClick={() => setMode("type")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === "type"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            Type
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {mode === "draw" ? (
        <div className="relative">
          <div className="border-2 border-dashed border-border rounded-xl overflow-hidden bg-white shadow-inner">
            <canvas
              ref={canvasRef}
              id="signature-canvas"
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerLeave={stopDrawing}
              className="w-full h-44 cursor-crosshair touch-none block"
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-muted-foreground">
              Sign inside the box using mouse, stylus, or finger
            </span>
            <button
              type="button"
              id="clear-signature-btn"
              onClick={clearCanvas}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
            >
              <Eraser className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Your Legal Full Name
            </label>
            <input
              type="text"
              id="typed-signature-input"
              value={typedName}
              onChange={(e) => {
                setTypedName(e.target.value);
                setError(null);
              }}
              placeholder="e.g. Marcus Vance"
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="border border-border rounded-xl p-4 bg-white flex items-center justify-center min-h-[100px]">
            {typedName.trim() ? (
              <p className="text-3xl text-slate-900 font-serif italic tracking-wide">
                {typedName.trim()}
              </p>
            ) : (
              <span className="text-xs text-slate-400 italic">Preview will appear here</span>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-border flex items-center justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          id="confirm-signature-btn"
          onClick={handleConfirm}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 px-5 py-2 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-md hover:shadow disabled:opacity-50"
        >
          {isSubmitting ? (
            <span>Signing...</span>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Adopt & Sign
            </>
          )}
        </button>
      </div>
    </div>
  );
}
