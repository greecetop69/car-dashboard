import type { MouseEvent, ReactNode } from "react";

interface OpenExternalLinkProps {
  href: string;
  className: string;
  children: ReactNode;
  stopPropagation?: boolean;
}

export default function OpenExternalLink({
  href,
  className,
  children,
  stopPropagation = true,
}: OpenExternalLinkProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (stopPropagation) {
      e.stopPropagation();
    }
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      onAuxClick={handleClick}
      className={className}
    >
      {children}
    </a>
  );
}
