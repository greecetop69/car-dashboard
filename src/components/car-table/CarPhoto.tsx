import { useEffect, useState } from "react";

interface Props {
  src: string | null;
  alt: string;
  className: string;
  inactive?: boolean;
}

export default function CarPhoto({ src, alt, className, inactive = false }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);

  const candidates = buildCandidates(src);
  const currentSrc = candidates[candidateIndex] ?? null;

  useEffect(() => {
    setLoaded(false);
    setErrored(false);
    setCandidateIndex(0);
  }, [src]);

  useEffect(() => {
    if (!currentSrc || loaded || errored) return;
    const timeout = window.setTimeout(() => {
      // Global guard: never keep skeleton forever on broken connections.
      // Do not rotate candidates by timeout because slow networks can load later.
      setErrored(true);
    }, 45000);
    return () => window.clearTimeout(timeout);
  }, [currentSrc, loaded, errored]);

  if (!src || errored || !currentSrc) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-sm text-slate-300 ${className}`}
      >
        нет фото
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg border border-slate-200 ${className}`}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-slate-200" />}
      <img
        src={currentSrc}
        alt={alt}
        className={`h-full w-full object-cover transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
        style={
          inactive
            ? {
                filter: "grayscale(100%) contrast(75%) brightness(75%) saturate(50%)",
                opacity: loaded ? 0.65 : 0,
              }
            : undefined
        }
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          setCandidateIndex((prev) => {
            if (prev + 1 < candidates.length) return prev + 1;
            setErrored(true);
            return prev;
          });
        }}
      />
    </div>
  );
}

function buildCandidates(src: string | null) {
  if (!src) return [];
  if (!src.includes("img.kbchachacha.com")) return [src];

  const match = src.match(/\/img(\d{2})\/img(\d{4})\//i);
  if (!match) return [src];

  const shards = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"];
  const currentShard = match[1];
  const alternates = shards
    .filter((shard) => shard !== currentShard)
    .map((shard) => src.replace(`/img${currentShard}/`, `/img${shard}/`));

  return [src, ...alternates];
}
