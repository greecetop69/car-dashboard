import type { MouseEvent, ReactNode } from "react";

interface ButtonProps {
  className: string;
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  stopPropagation?: boolean;
  disabled?: boolean;
}

export default function Button({
  className,
  children,
  onClick,
  title,
  stopPropagation = true,
  disabled = false,
}: ButtonProps) {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) e.stopPropagation();
    if (!disabled) onClick?.();
  };

  return (
    <button type="button" className={className} onClick={handleClick} title={title} disabled={disabled}>
      {children}
    </button>
  );
}
