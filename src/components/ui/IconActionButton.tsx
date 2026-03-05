import type { MouseEvent, ReactNode } from "react";

interface IconActionButtonProps {
  title?: string;
  className: string;
  onClick?: () => void;
  children: ReactNode;
  stopPropagation?: boolean;
  disabled?: boolean;
}

export default function IconActionButton({
  title,
  className,
  onClick,
  children,
  stopPropagation = true,
  disabled = false,
}: IconActionButtonProps) {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) {
      e.stopPropagation();
    }
    if (!disabled) {
      onClick?.();
    }
  };

  return (
    <button title={title} className={className} onClick={handleClick} disabled={disabled}>
      {children}
    </button>
  );
}
