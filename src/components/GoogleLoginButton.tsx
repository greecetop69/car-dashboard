import { useEffect, useRef } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            ux_mode?: "popup" | "redirect";
            login_uri?: string;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: string;
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: number;
            },
          ) => void;
        };
      };
    };
  }
}

interface Props {
  clientId: string;
  disabled?: boolean;
  onCredential: (credential: string) => void;
}

function shouldUseRedirectFlow() {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent;
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  return isIOS || isMobile;
}

function loadGoogleScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-google-gsi="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleGsi = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(script);
  });
}

export default function GoogleLoginButton({ clientId, disabled = false, onCredential }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!clientId || disabled || !containerRef.current) return;

    let cancelled = false;
    const useRedirectFlow = shouldUseRedirectFlow();
    const loginUri = `${window.location.origin}/api/auth/google/callback`;

    void loadGoogleScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;
        containerRef.current.innerHTML = "";
        window.google.accounts.id.initialize({
          client_id: clientId,
          ...(useRedirectFlow ? { ux_mode: "redirect" as const, login_uri: loginUri } : {}),
          callback: (response) => {
            if (response.credential) {
              onCredential(response.credential);
            }
          },
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "medium",
          text: "signin_with",
          shape: "pill",
          logo_alignment: "left",
          width: Math.min(containerRef.current.clientWidth || 280, 320),
        });
      })
      .catch(() => {
        if (!containerRef.current) return;
        containerRef.current.innerHTML =
          '<div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Google Sign-In load failed</div>';
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, disabled, onCredential]);

  return (
    <div
      ref={containerRef}
      className={`w-full min-w-0 sm:w-auto ${disabled ? "pointer-events-none opacity-60" : ""}`}
    />
  );
}
