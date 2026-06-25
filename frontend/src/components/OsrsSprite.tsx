import { useState, useEffect } from "react";

export function OsrsSprite({ srcs, fallback, size = 48, pixelated = true, className = "", style }: {
  srcs: string[]; fallback: string; size?: number; pixelated?: boolean; className?: string; style?: React.CSSProperties;
}) {
  const [idx, setIdx]       = useState(0);
  const [failed, setFailed] = useState(false);

  const srcsKey = srcs.join("|");
  useEffect(() => {
    setIdx(0);
    setFailed(false);
  }, [srcsKey]);

  if (failed || srcs.length === 0) {
    return <span style={{ fontSize: size * 0.75, ...style }} className={className}>{fallback}</span>;
  }

  function handleLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    // Wiki returns a tiny placeholder (≤10px) when a file doesn't exist — treat as failure
    if (img.naturalWidth <= 10 || img.naturalHeight <= 10) {
      idx + 1 < srcs.length ? setIdx(i => i + 1) : setFailed(true);
    }
  }

  return (
    <img
      key={srcsKey + idx}
      src={srcs[idx]}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: pixelated ? "pixelated" : "auto", objectFit: "contain", maxWidth: size, maxHeight: size, ...style }}
      onLoad={handleLoad}
      onError={() => idx + 1 < srcs.length ? setIdx(i => i + 1) : setFailed(true)}
    />
  );
}

export function OsrsIcon({ src, fallback, size = 32 }: { src: string; fallback: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  if (failed) return <span style={{ fontSize: size * 0.75 }}>{fallback}</span>;
  return (
    <img key={src} src={src} alt="" width={size} height={size}
         style={{ imageRendering: "pixelated", objectFit: "contain" }}
         onError={() => setFailed(true)} />
  );
}
