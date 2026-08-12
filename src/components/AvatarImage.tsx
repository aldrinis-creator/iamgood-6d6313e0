import { ReactNode } from "react";
import { useAvatarSrc } from "@/lib/avatarUrl";

interface AvatarImageProps {
  /** Stored avatar_url value (legacy public URL or storage path). */
  value?: string | null;
  className?: string;
  alt?: string;
  fallback: ReactNode;
}

/** Renders an avatar from the private avatars bucket via a signed URL. */
const AvatarImage = ({ value, className, alt = "Avatar", fallback }: AvatarImageProps) => {
  const src = useAvatarSrc(value);
  if (!src) return <>{fallback}</>;
  return <img src={src} alt={alt} className={className} />;
};

export default AvatarImage;
