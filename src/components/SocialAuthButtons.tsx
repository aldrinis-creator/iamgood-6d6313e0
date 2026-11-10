import React, { useState } from "react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";

interface SocialAuthButtonsProps {
  onSuccessRedirect?: string;
  isInternationalOnly?: boolean;
}

export const SocialAuthButtons: React.FC<SocialAuthButtonsProps> = ({
  onSuccessRedirect = "/dashboard",
  isInternationalOnly = false,
}) => {
  const [loadingProvider, setLoadingProvider] = useState<"google" | "apple" | null>(null);

  const handleOAuthLogin = async (provider: "google" | "apple") => {
    setLoadingProvider(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(`Sign in with ${provider === "google" ? "Google" : "Apple"} failed`, {
          description: result.error.message,
        });
        return;
      }
      if (result.redirected) return;
      window.location.assign(onSuccessRedirect);
    } catch (err: any) {
      toast.error("Authentication error", {
        description: err?.message || "Could not connect to sign in provider",
      });
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <div className="w-full flex flex-col gap-2.5">
      {isInternationalOnly && (
        <div className="text-[12px] text-auth-text-3 text-center mb-1 leading-snug">
          Recommended for International Accounts (US, UK, UAE, Europe):
        </div>
      )}

      {/* Google Sign-In Button */}
      <button
        type="button"
        onClick={() => handleOAuthLogin("google")}
        disabled={loadingProvider !== null}
        className="w-full bg-[#182335] hover:bg-[#1E2C42] border border-auth-border-hi text-auth-text-1 text-[15px] font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors disabled:opacity-60"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.9c2.28-2.1 3.64-5.2 3.64-9.15z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.73-2.1-6.68-4.94H1.28v3.13C3.25 21.3 7.31 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.32 14.26a7.17 7.17 0 0 1 0-4.52V6.61H1.28a11.96 11.96 0 0 0 0 10.78l4.04-3.13z"
          />
          <path
            fill="#EA4335"
            d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.28 6.61l4.04 3.13c.95-2.84 3.58-4.97 6.68-4.97z"
          />
        </svg>
        <span>
          {loadingProvider === "google" ? "Connecting Google..." : "Continue with Google"}
        </span>
      </button>

      {/* Apple Sign-In Button: white style on dark background per Apple HIG */}
      <button
        type="button"
        onClick={() => handleOAuthLogin("apple")}
        disabled={loadingProvider !== null}
        className="w-full min-w-[140px] h-[51px] bg-white text-black text-[22px] font-medium rounded-xl flex items-center justify-center transition-opacity disabled:opacity-60"
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif" }}
      >
        {loadingProvider === "apple" ? "Connecting Apple..." : "Continue with Apple"}
      </button>
    </div>
  );
};

export default SocialAuthButtons;
