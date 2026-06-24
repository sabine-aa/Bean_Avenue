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
      const dataUrl = await readDataUrl(file);
      const { url } = await api.post<{ url: string }>("/api/uploads", { dataUrl });
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
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
          className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-oat bg-oat/30 text-xs font-semibold text-charcoal/50 transition hover:border-espresso disabled:opacity-60"
        >
          {value ? <Img src={value} alt="" className="h-full w-full" /> : busy ? "…" : "Upload"}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex gap-2">
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="min-w-0 flex-1 rounded-xl border border-oat px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="btn-3d shrink-0 rounded-xl bg-espresso px-4 py-2 text-sm font-semibold text-cream disabled:opacity-60"
            >
              {busy ? "Uploading…" : "Upload"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="shrink-0 rounded-xl border border-oat px-3 py-2 text-sm font-semibold text-charcoal/60 hover:border-terracotta hover:text-terracotta-dark"
              >
                Clear
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-charcoal/45">JPG, PNG, WEBP or GIF · up to 8 MB. Or paste a link.</p>
          {error && <p className="mt-0.5 text-xs font-medium text-terracotta-dark">{error}</p>}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
    </div>
  );
}
