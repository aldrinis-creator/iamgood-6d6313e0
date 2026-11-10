import React, { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}${onSuccessRedirect}`,
        },
      });

      if (error) {
        toast.error(`Sign in with ${provider === "google" ? "Google" : "Apple"} failed`, {
          description: error.message,
        });
      }
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

      {/* Apple Sign-In Button */}
      <button
        type="button"
        onClick={() => handleOAuthLogin("apple")}
        disabled={loadingProvider !== null}
        className="w-full bg-[#182335] hover:bg-[#1E2C42] border border-auth-border-hi text-auth-text-1 text-[15px] font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors disabled:opacity-60"
      >
        <svg className="w-4 h-4 shrink-0 fill-current text-white" viewBox="0 0 170 170">
          <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.58-7.71-11.64-14.01-6.19-9.57-11.16-20.59-14.92-33.07-3.76-12.48-5.64-24.16-5.64-35.03 0-14.15 3.51-26.04 10.53-35.68 7.02-9.64 16.03-14.58 27.03-14.83 4.89 0 10.33 1.25 16.32 3.75 6 2.5 9.94 3.8 11.83 3.91 1.63 0 5.66-1.3 12.09-3.91 6.43-2.61 11.77-3.8 16.03-3.59 12.06.66 21.72 5.38 28.98 14.17-10.45 6.31-15.57 14.9-15.35 25.77.22 8.48 3.54 15.82 9.97 22.02 6.43 6.19 14.1 9.68 23.01 10.45-2.28 7.18-5.19 14.58-8.71 22.18zM119.22 31.84c0-7.72 2.72-14.89 8.16-21.52 5.44-6.63 12.17-10.32 20.2-11.08.22 1.09.33 2.18.33 3.26 0 7.61-2.83 14.9-8.48 21.85-5.66 6.96-12.55 10.76-20.66 11.41-.22-1.31-.33-2.61-.33-3.92z" />
        </svg>
        <span>
          {loadingProvider === "apple" ? "Connecting Apple..." : "Sign in with Apple"}
        </span>
      </button>
    </div>
  );
};

export default SocialAuthButtons;
