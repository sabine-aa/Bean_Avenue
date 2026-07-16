import { useRef, useState } from "react";
import { api } from "../lib/api";
import { Img } from "./Img";

/** Read a File as a base64 data URL. */
function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read the file."));
    reader.readAsDataURL(file);
  });
}

/** Load a File into an <img> element (fallback for browsers without createImageBitmap). */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read the image."));
    };
    img.src = url;
  });
}

/**
 * Shrink + compress a photo in the browser before upload: cap the longest side
 * at `maxDim` and re-encode as JPEG. A phone photo (3–8 MB) becomes ~50–150 KB,
 * so uploads are fast and the image loads quickly afterwards. Transparent areas
 * are flattened onto white (product photos don't need transparency).
 */
async function downscaleToDataUrl(file: File, maxDim = 1000, quality = 0.82): Promise<string> {
  let width: number, height: number;
  let source: CanvasImageSource;
  try {
    const bmp = await createImageBitmap(file);
    width = bmp.width;
    height = bmp.height;
    source = bmp;
  } catch {
    const img = await loadImage(file);
    width = img.naturalWidth;
    height = img.naturalHeight;
    source = img;
  }
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return readDataUrl(file); // no canvas → send original
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * An image picker for the admin: upload a file from the device OR paste a URL.
 * Uploads go to /api/uploads and the returned URL is stored in the field.
 */
export function ImageField({
  value,
  onChange,
  placeholder = "Upload a photo or paste an image URL",
}: {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Please choose an image file.");
    setBusy(true);
    setError("");
    try {
      // Shrink in the browser first so the upload is small and fast.
      const dataUrl = await downscaleToDataUrl(file).catch(() => readDataUrl(file));
      const { url } = await api.post<{ url: string }>("/api/uploads", { dataUrl });
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again in a moment.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mt-1 font-normal">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="border-oat bg-oat/30 text-charcoal/50 hover:border-espresso relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed text-xs font-semibold transition disabled:opacity-60"
        >
          {value ? <Img src={value} alt="" className="h-full w-full" /> : busy ? "…" : "Upload"}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex gap-2">
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="border-oat min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="btn-3d bg-espresso text-cream shrink-0 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? "Uploading…" : "Upload"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="border-oat text-charcoal/60 hover:border-terracotta hover:text-terracotta-dark shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-charcoal/45 mt-1 text-xs">JPG, PNG, WEBP or GIF · up to 8 MB. Or paste a link.</p>
          {error && <p className="text-terracotta-dark mt-0.5 text-xs font-medium">{error}</p>}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
    </div>
  );
}
