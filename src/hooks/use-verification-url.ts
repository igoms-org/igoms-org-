import { useEffect, useState } from "react";

export function useVerificationUrl(publicId: string) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return `${origin}/verify/${publicId}`;
}
