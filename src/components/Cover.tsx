import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoverProps {
  src?: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

/** 2:3 poster with a shimmer placeholder and a fallback for broken/missing images. */
export function Cover({ src, alt, className, priority = false }: CoverProps) {
  const [state, setState] = useState<"loading" | "loaded" | "error">(src ? "loading" : "error");

  return (
    <div className={cn("relative aspect-[2/3] overflow-hidden bg-white/[0.04]", className)}>
      {state === "loading" && <div className="absolute inset-0 animate-pulse bg-white/[0.06]" />}
      {state === "error" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/30">
          <ImageOff className="size-7" aria-hidden />
          <span className="text-xs">No image</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onLoad={() => setState("loaded")}
          onError={() => setState("error")}
          className={cn(
            "size-full object-cover transition-[opacity,transform] duration-500",
            state === "loaded" ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  );
}
