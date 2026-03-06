import { memo, useEffect, useState } from "react";

interface Props {
  src: string | null;
  alt: string;
  className: string;
  inactive?: boolean;
}

function CarPhoto({ src, alt, className, inactive = false }: Props) {
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setErrored(false);
  }, [src]);

  if (!src || errored) {
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
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        style={
          inactive
            ? {
                filter: "grayscale(100%) contrast(75%) brightness(75%) saturate(50%)",
                opacity: 0.65,
              }
            : undefined
        }
        onError={() => setErrored(true)}
      />
    </div>
  );
}

export default memo(CarPhoto);
