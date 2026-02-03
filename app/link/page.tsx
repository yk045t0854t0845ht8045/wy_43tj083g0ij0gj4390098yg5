"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ArrowRight } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

// Verified Badge Component (Instagram Oficial)
function VerifiedBadge() {
  return (
    <motion.svg
      aria-label="Verificado"
      role="img"
      width="22"
      height="22"
      viewBox="0 0 40 40"
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ delay: 0.6, type: "spring", stiffness: 260, damping: 20 }}
    >
      <title>Verificado</title>
      <path
        d="M19.998 3.094 14.638 0l-2.972 5.15H5.432v6.354L0 14.64 3.094 20 0 25.359l5.432 3.137v5.905h5.975L14.638 40l5.36-3.094L25.358 40l3.232-5.6h6.162v-6.01L40 25.359 36.905 20 40 14.641l-5.248-3.03v-6.46h-6.419L25.358 0l-5.36 3.094Zm7.415 11.225 2.254 2.287-11.43 11.5-6.835-6.93 2.244-2.258 4.587 4.581 9.18-9.18Z"
        fill="rgb(0, 149, 246)"
        fillRule="evenodd"
      />
    </motion.svg>
  );
}



// Social Icons with VIBRANT brand colors - SVG paths for each platform
const socialIcons: Record<
  string,
  {
    path: React.ReactNode;
    color: string;
    gradient?: string;
    secondaryColor?: string;
    videoUrl: string;
  }
> = {
  Instagram: {
    path: (
      <>
        <rect
          x="2"
          y="2"
          width="20"
          height="20"
          rx="5"
          ry="5"
          strokeWidth="2"
          fill="none"
          stroke="currentColor"
        />
        <circle
          cx="12"
          cy="12"
          r="4"
          strokeWidth="2"
          fill="none"
          stroke="currentColor"
        />
        <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" />
      </>
    ),
    color: "#E1306C",
    gradient:
      "linear-gradient(45deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)",
    videoUrl: "/videos/buttons/ssstik.io_@01.bogdan_1769745809119.mp4",
  },
  YouTube: {
    path: (
      <>
        <path
          d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"
          strokeWidth="2"
          fill="none"
          stroke="currentColor"
        />
        <polygon
          points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"
          fill="currentColor"
        />
      </>
    ),
    color: "#FF0000",
    gradient: "linear-gradient(135deg, #FF0000 0%, #CC0000 100%)",
    videoUrl: "/videos/buttons/ssstik.io_@dabbler.3d_1769745235020.mp4",
  },
  "Twitter / X": {
    path: (
      <path
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
        fill="currentColor"
      />
    ),
    color: "#1DA1F2",
    gradient: "linear-gradient(135deg, #1DA1F2 0%, #0D8BD9 100%)",
    videoUrl: "/videos/buttons/rf9-43i80j3408tj43.gif",
  },
  LinkedIn: {
    path: (
      <>
        <path
          d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"
          strokeWidth="2"
          fill="none"
          stroke="currentColor"
        />
        <rect x="2" y="9" width="4" height="12" fill="currentColor" />
        <circle cx="4" cy="4" r="2" fill="currentColor" />
      </>
    ),
    color: "#0A66C2",
    gradient: "linear-gradient(135deg, #0A66C2 0%, #004182 100%)",
    videoUrl: "/videos/buttons/rf9-43i80j3408tj43.gif",
  },
  GitHub: {
    path: (
      <path
        d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
        fill="currentColor"
      />
    ),
    color: "#6e40c9",
    gradient:
      "linear-gradient(135deg, #6e40c9 0%, #8957e5 50%, #a371f7 100%)",
    videoUrl: "/videos/buttons/rf9-43i80j3408tj43.gif",
  },
  WhatsApp: {
    path: (
      <path
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
        fill="currentColor"
      />
    ),
    color: "#25D366",
    gradient: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
    videoUrl:
      "/videos/buttons/pifg490304m09fg439gh4390yt.mp4",
  },
  TikTok: {
    path: (
      <path
        d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
        fill="currentColor"
      />
    ),
    color: "#FF0050",
    secondaryColor: "#00F2EA",
    gradient: "linear-gradient(135deg, #FF0050 0%, #00F2EA 100%)",
    videoUrl: "/videos/buttons/rf9-43i80j3408tj43.gif",
  },
  Website: {
    path: (
      <>
        <circle
          cx="12"
          cy="12"
          r="10"
          strokeWidth="2"
          fill="none"
          stroke="currentColor"
        />
        <line
          x1="2"
          y1="12"
          x2="22"
          y2="12"
          strokeWidth="2"
          stroke="currentColor"
        />
        <path
          d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
          strokeWidth="2"
          fill="none"
          stroke="currentColor"
        />
      </>
    ),
    color: "#6366F1",
    gradient:
      "linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #A855F7 100%)",
    videoUrl: "/videos/buttons/rf9-43i80j3408tj43.gif",
  },
  "Loja Online": {
    path: (
      <>
        <path
          d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"
          strokeWidth="2"
          fill="none"
          stroke="currentColor"
        />
        <line
          x1="3"
          y1="6"
          x2="21"
          y2="6"
          strokeWidth="2"
          stroke="currentColor"
        />
        <path
          d="M16 10a4 4 0 0 1-8 0"
          strokeWidth="2"
          fill="none"
          stroke="currentColor"
        />
      </>
    ),
    color: "#F59E0B",
    gradient: "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)",
    videoUrl: "/videos/buttons/rf9-43i80j3408tj43.gif",
  },
  Contato: {
    path: (
      <>
        <path
          d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
          strokeWidth="2"
          fill="none"
          stroke="currentColor"
        />
        <polyline
          points="22,6 12,13 2,6"
          strokeWidth="2"
          fill="none"
          stroke="currentColor"
        />
      </>
    ),
    color: "#10B981",
    gradient: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
    videoUrl: "/videos/buttons/rf9-43i80j3408tj43.gif",
  },
};

// 3D Animated Icon Component with TikTok special handling
function AnimatedIcon({
  name,
  isHovered,
  prefersReducedMotion,
}: {
  name: string;
  isHovered: boolean;
  prefersReducedMotion: boolean | null;
}) {
  const iconData = socialIcons[name];
  if (!iconData) return null;

  const isTikTok = name === "TikTok";

  return (
    <motion.div
      className="relative w-6 h-6"
      style={{
        perspective: "200px",
        transformStyle: "preserve-3d",
      }}
    >
      {/* Mono Icon (default) */}
      <motion.svg
        viewBox="0 0 24 24"
        className="absolute inset-0 w-full h-full"
        style={{
          color: "rgba(255,255,255,0.9)",
          transformStyle: "preserve-3d",
          backfaceVisibility: "hidden",
        }}
        initial={false}
        animate={{
          rotateY: isHovered && !prefersReducedMotion ? 180 : 0,
          opacity: isHovered ? 0 : 1,
          scale: isHovered && !prefersReducedMotion ? 0.8 : 1,
        }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {iconData.path}
      </motion.svg>

      {/* Colored 3D Icon (on hover) - Special handling for TikTok */}
      <motion.div
        className="absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
          backfaceVisibility: "hidden",
        }}
        initial={false}
        animate={{
          rotateY: isHovered && !prefersReducedMotion ? 0 : -180,
          opacity: isHovered ? 1 : 0,
          scale: isHovered && !prefersReducedMotion ? 1 : 0.8,
        }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {isTikTok ? (
          <>
            <svg
              viewBox="0 0 24 24"
              className="absolute inset-0 w-full h-full"
              style={{
                color: "#00F2EA",
                transform: "translate(-1px, 0)",
                filter: "drop-shadow(0 0 4px #00F2EA80)",
              }}
            >
              {iconData.path}
            </svg>
            <svg
              viewBox="0 0 24 24"
              className="absolute inset-0 w-full h-full"
              style={{
                color: "#FF0050",
                transform: "translate(1px, 0)",
                filter: "drop-shadow(0 0 4px #FF005080)",
              }}
            >
              {iconData.path}
            </svg>
            <svg
              viewBox="0 0 24 24"
              className="absolute inset-0 w-full h-full"
              style={{
                color: "#ffffff",
              }}
            >
              {iconData.path}
            </svg>
          </>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="w-full h-full"
            style={{
              color: iconData.color,
              filter: `drop-shadow(0 0 10px ${iconData.color}80)`,
            }}
          >
            {iconData.path}
          </svg>
        )}
      </motion.div>

      {/* Glow pulse on hover */}
      <AnimatePresence>
        {isHovered && !prefersReducedMotion && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: isTikTok
                ? `radial-gradient(circle, ${iconData.color}40, ${iconData.secondaryColor}40, transparent 70%)`
                : `radial-gradient(circle, ${iconData.color}50, transparent 70%)`,
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.5, 1] }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}


// Inline Video Preview Component - INSIDE the button, tilted 25deg with fade to left
function InlineVideoPreview({
  videoUrl,
  isVisible,
  brandColor,
  gradient,
}: {
  videoUrl: string;
  isVisible: boolean;
  brandColor: string;
  gradient?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (videoRef.current) {
      if (isVisible) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [isVisible]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="absolute right-0 top-0 bottom-0 w-[45%] overflow-hidden rounded-r-full pointer-events-none"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          style={{
            maskImage:
              "linear-gradient(to left, rgba(0,0,0,0.9) 20%, rgba(0,0,0,0.5) 50%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to left, rgba(0,0,0,0.9) 20%, rgba(0,0,0,0.5) 50%, transparent 100%)",
          }}
        >
          {/* Video Container with 25deg tilt */}
          <motion.div
            className="absolute inset-0 origin-center"
            style={{
              transform: "rotate(-12deg) scale(1.4)",
            }}
            initial={{ rotate: -25, scale: 1.3 }}
            animate={{
              rotate: [-12, -10, -12],
              scale: [1.4, 1.45, 1.4],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <video
              ref={videoRef}
              src={videoUrl}
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
              style={{
                filter: "brightness(0.85) saturate(1.3) contrast(1.1)",
              }}
            />
          </motion.div>

          {/* Brand Color Overlay */}
          <div
            className="absolute inset-0 mix-blend-overlay"
            style={{
              background:
                gradient ||
                `linear-gradient(135deg, ${brandColor}60, ${brandColor}30)`,
              opacity: 0.5,
            }}
          />

          {/* Shimmer Effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 1,
              ease: "easeInOut",
            }}
          />

          {/* Edge Glow */}
          <div
            className="absolute right-0 top-0 bottom-0 w-[3px]"
            style={{
              background: `linear-gradient(to bottom, transparent, ${brandColor}, transparent)`,
              boxShadow: `0 0 15px ${brandColor}80`,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Link Button Component with Inline Video Preview
function LinkButton({
  name,
  href,
  delay = 0,
  prefersReducedMotion,
  EASE,
  DUR,
}: {
  name: string;
  href: string;
  delay?: number;
  prefersReducedMotion: boolean | null;
  EASE: readonly [number, number, number, number];
  DUR: { xs: number; sm: number; md: number; lg: number; xl: number };
}) {
  const [isHovered, setIsHovered] = useState(false);
  const iconData = socialIcons[name];

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: DUR.lg, ease: EASE }}
    >
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        whileHover={prefersReducedMotion ? undefined : { y: -4, scale: 1.02 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
        className="group relative inline-flex w-full items-center rounded-full px-3 py-3.5 text-[18px] font-semibold transition-all duration-500 ease-out transform-gpu bg-[#171717] text-white border-2 border-[#404040] shadow-[0_18px_55px_rgba(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-white overflow-hidden"
        style={{
          willChange: "transform",
          borderColor: isHovered ? `${iconData?.color}80` : undefined,
          boxShadow: isHovered
            ? `0 25px 80px ${iconData?.color}30, 0 0 0 1px ${iconData?.color}20, inset 0 1px 0 rgba(255,255,255,0.1)`
            : undefined,
        }}
        aria-label={`Acessar ${name}`}
      >
        {/* Animated Background Gradient on Hover */}
        <motion.div
          className="absolute inset-0 opacity-0 transition-opacity duration-500"
          style={{
            background:
              iconData?.gradient ||
              `linear-gradient(135deg, ${iconData?.color}30, transparent)`,
            opacity: isHovered ? 0.2 : 0,
          }}
        />

        {/* Inline Video Preview - INSIDE button on right side */}
        <InlineVideoPreview
          videoUrl={iconData?.videoUrl || ""}
          isVisible={isHovered && !prefersReducedMotion}
          brandColor={iconData?.color || "#171717"}
          gradient={iconData?.gradient}
        />

        {/* Icon Container - LEFT with 3D Animation */}
        <motion.span
          className="relative z-10 flex items-center justify-center w-14 h-14 rounded-full bg-white/[0.08] border border-white/[0.12] transition-all duration-500"
          style={{
            borderColor: isHovered ? `${iconData?.color}60` : undefined,
            backgroundColor: isHovered ? `${iconData?.color}20` : undefined,
            boxShadow: isHovered ? `0 0 20px ${iconData?.color}30` : undefined,
          }}
        >
          <AnimatedIcon
            name={name}
            isHovered={isHovered}
            prefersReducedMotion={prefersReducedMotion}
          />
        </motion.span>

        {/* Label - CENTER */}
        <span className="relative z-10 flex-1 text-center pr-16 text-white/95 tracking-tight transition-all duration-500 group-hover:text-white font-medium">
          {name}
        </span>

        {/* Shimmer Effect on Hover */}
        <motion.span
          className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/[0.1] to-transparent pointer-events-none z-20"
          initial={{ x: "-100%" }}
          animate={{ x: isHovered ? "200%" : "-100%" }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />

        {/* Pulse Ring on Hover */}
        <AnimatePresence>
          {isHovered && !prefersReducedMotion && (
            <motion.span
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ border: `2px solid ${iconData?.color}` }}
              initial={{ opacity: 0.8, scale: 1 }}
              animate={{ opacity: 0, scale: 1.1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </AnimatePresence>
      </motion.a>
    </motion.div>
  );
}



// Main Page Component
export default function LinkPage() {
  const prefersReducedMotion = useReducedMotion();

  

  const EASE = useMemo(() => [0.2, 0.8, 0.2, 1] as const, []);
  const DUR = useMemo(
    () => ({
      xs: 0.18,
      sm: 0.22,
      md: 0.35,
      lg: 0.7,
      xl: 0.9,
    }),
    []
  );

    // ✅ Cookie consent (Dinâmica no bottom - centralizado)
  const COOKIE_KEY = "wyzer_cookie_consent_v1";
  const [cookieReady, setCookieReady] = useState(false);
  const [showCookieConsent, setShowCookieConsent] = useState(false);

  const [cookieAccepting, setCookieAccepting] = useState(false);
  const cookieTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cookieTimerRef.current) window.clearInterval(cookieTimerRef.current);
    };
  }, []);

  useEffect(() => {
    try {
      const v = localStorage.getItem(COOKIE_KEY);
      setShowCookieConsent(v !== "1");
    } catch {
      setShowCookieConsent(true);
    } finally {
      setCookieReady(true);
    }
  }, []);

  const acceptCookies = useCallback(() => {
    if (cookieAccepting) return;

    setCookieAccepting(true);

    try {
      localStorage.setItem(COOKIE_KEY, "1");
    } catch {}

    // micro delay pra ficar “premium”
    window.setTimeout(() => {
      setShowCookieConsent(false);
      setCookieAccepting(false);
    }, prefersReducedMotion ? 0 : 220);
  }, [COOKIE_KEY, cookieAccepting, prefersReducedMotion]);

  const cookieWrapVariants = useMemo(
    () => ({
      hidden: { opacity: 0, y: 40 },
      show: {
        opacity: 1,
        y: 0,
        transition: { duration: prefersReducedMotion ? 0 : 0.55, ease: EASE },
      },
      exit: {
        opacity: 0,
        y: 56,
        transition: { duration: prefersReducedMotion ? 0 : 0.45, ease: EASE },
      },
    }),
    [EASE, prefersReducedMotion]
  );

  const cookieCardVariants = useMemo(
    () => ({
      hidden: { opacity: 0, y: 22, scale: 0.985, filter: "blur(10px)" },
      show: {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
        transition: { duration: prefersReducedMotion ? 0 : 0.6, ease: EASE },
      },
      exit: {
        opacity: 0,
        y: 36,
        scale: 0.992,
        filter: "blur(10px)",
        transition: { duration: prefersReducedMotion ? 0 : 0.5, ease: EASE },
      },
    }),
    [EASE, prefersReducedMotion]
  );

  const links = useMemo(
    () => [
      { name: "Instagram", href: "https://www.instagram.com/wyzerbot/" },
      { name: "WhatsApp", href: "https://wa.me" },
      {
        name: "YouTube",
        href: "https://youtube.com/@wyzerbot?si=0OXV-AlyQYnuVZ6t",
      },
      {
        name: "TikTok",
        href: "https://www.tiktok.com/@wyzerbot?is_from_webapp=1&sender_device=pc",
      },
      { name: "Twitter / X", href: "https://x.com/WyzerBot" },
      {
        name: "LinkedIn",
        href: "https://www.linkedin.com/in/wyzer-bot-6336353a9/",
      },
      { name: "GitHub", href: "https://github.com/WyzerBot" },
    ],
    []
  );



  return (
    <main className="min-h-screen bg-white relative overflow-hidden overflow-x-hidden">
      {/* Subtle Grid Pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #000 1px, transparent 1px),
            linear-gradient(to bottom, #000 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
        aria-hidden="true"
      />

      {/* Radial Gradient Accents */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[800px] bg-gradient-to-b from-black/[0.02] to-transparent rounded-full blur-3xl" />
        <motion.div
          className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl opacity-30"
          style={{
            background:
              "radial-gradient(circle, rgba(0,0,0,0.03) 0%, transparent 70%)",
          }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.4, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-start min-h-screen px-6 py-20 sm:py-24">
        {/* Profile Section */}
        <motion.div
          className="flex flex-col items-center mb-16"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.lg, ease: EASE }}
        >
          {/* Avatar */}
          <motion.div
            className="relative mb-10"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              delay: 0.15,
              type: "spring",
              stiffness: 260,
              damping: 22,
            }}
          >
            {/* Animated Ring - Outer with gradient */}
            <motion.div
              className="absolute -inset-[5px] rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, #171717, #555, #171717, #888, #171717)",
              }}
              animate={prefersReducedMotion ? undefined : { rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              aria-hidden="true"
            />

            {/* Secondary Ring with shimmer */}
            <motion.div
              className="absolute -inset-[5px] rounded-full"
              style={{
                background:
                  "conic-gradient(from 180deg, transparent, rgba(255,255,255,0.25), transparent)",
              }}
              animate={prefersReducedMotion ? undefined : { rotate: -360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              aria-hidden="true"
            />

            {/* Avatar Container */}
            <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-full bg-white p-[5px]">
              <motion.div
                className="w-full h-full rounded-full bg-transparent flex items-center justify-center overflow-hidden shadow-[inset_0_2px_30px_rgba(255,255,255,0.08)]"
                whileHover={prefersReducedMotion ? undefined : { scale: 1.03 }}
                transition={{ duration: 0.3 }}
              >
                <img
                  src="/lg/socials/t43h79r349737tg.png"
                  alt="Logo"
                  className="w-full h-full object-cover rounded-full select-none"
                  draggable={false}
                />
              </motion.div>
            </div>

            {/* Online Indicator with pulse */}
            <motion.div
              className="absolute bottom-3 right-3 w-8 h-8 rounded-full border-[4px] border-white bg-emerald-500 shadow-lg"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.7, type: "spring", stiffness: 300 }}
              aria-label="Online"
            >
              <motion.span
                className="absolute inset-0 bg-emerald-400 rounded-full"
                animate={
                  prefersReducedMotion
                    ? undefined
                    : { scale: [1, 1.8, 1], opacity: [0.8, 0, 0.8] }
                }
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                aria-hidden="true"
              />
            </motion.div>
          </motion.div>

          {/* Name with Verified Badge */}
          <motion.div
            className="flex items-center gap-3 mb-2.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: DUR.md, ease: EASE }}
          >
            <h1 className="text-[34px] sm:text-[42px] font-bold text-[#0a0a0a] tracking-tight">
              Wyzer
            </h1>
            <VerifiedBadge />
          </motion.div>

          {/* Username */}
          <motion.p
            className="text-[#666] text-[16px] font-medium mb-5 tracking-tight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.42, duration: DUR.md, ease: EASE }}
          >
            @wyzerbot
          </motion.p>

          {/* Bio Description */}
          <motion.p
            className="text-[#444]/80 text-center text-[18px] leading-relaxed max-w-[680px] px-4 text-balance"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.48, duration: DUR.md, ease: EASE }}
          >
            Gere atendimentos envolventes prontos para vender. Automatize conversas, capture leads, organize o funil e colabore com facilidade — com IA de nível enterprise que entende contexto e entrega respostas consistentes.
          </motion.p>

          {/* Stats */}
          <motion.div
            className="flex items-center gap-10 sm:gap-12 mt-10 px-12 py-6 bg-[#fafafa] rounded-2xl border border-[#eaeaea] shadow-[0_4px_32px_rgba(0,0,0,0.05)]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: DUR.lg, ease: EASE }}
          >
            {[
              { label: "Seguidores", value: "12.5K" },
              { label: "Projetos", value: "48" },
              { label: "Clientes", value: "200+" },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.65 + index * 0.08,
                  duration: DUR.md,
                  ease: EASE,
                }}
                whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
              >
                <p className="text-2xl sm:text-3xl font-bold text-[#0a0a0a] tracking-tight">
                  {stat.value}
                </p>
                <p className="text-[14px] text-[#888] font-medium tracking-wider uppercase mt-2">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Links Section */}
        <nav
          className="w-full max-w-lg space-y-4 px-2"
          aria-label="Links das redes sociais"
        >
          {links.map((link, index) => (
            <LinkButton
              key={link.name}
              name={link.name}
              href={link.href}
              delay={0.75 + index * 0.06}
              prefersReducedMotion={prefersReducedMotion}
              EASE={EASE}
              DUR={DUR}
            />
          ))}
        </nav>

       {/* Footer */}
<motion.footer
  className="mt-24 text-center"
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ delay: 1.8, duration: DUR.lg, ease: EASE }}
>
  {/* ✅ trocado: "Feito com amor..." -> links legais */}
  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[14px] text-[#aaa] tracking-wide">
    <a
      href="https://cookies.wyzer.com.br"
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-[#171717] transition-colors"
    >
      Cookies
    </a>
    <span className="text-[#ddd]">•</span>
    <a
      href="https://terms.wyzer.com.br"
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-[#171717] transition-colors"
    >
      Termos
    </a>
    <span className="text-[#ddd]">•</span>
    <a
      href="https://privacy.wyzer.com.br"
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-[#171717] transition-colors"
    >
      Política de privacidade
    </a>
  </div>

  <motion.div
    className="mt-5 flex items-center justify-center gap-3"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 1.95, duration: DUR.md, ease: EASE }}
  >
    <span className="text-[12px] text-[#ccc] tracking-[0.12em] uppercase font-medium">
      Powered by
    </span>
    <motion.span
      className="text-[12px] text-[#666] font-bold tracking-[0.01em] uppercase"
      whileHover={{ color: "#171717" }}
    >
      Wyze Code
    </motion.span>
  </motion.div>
</motion.footer>
      </div>

      {/* CTA Floating (bottom-right) - colocar ANTES do </main> */}
      <motion.a
        href="https://wyzer.com.br" // <-- troque pelo seu link
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50"
        initial={{ opacity: 0, y: 26, scale: 0.98, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={{
          delay: 1.05,
          type: "spring",
          stiffness: 420,
          damping: 34,
          mass: 0.9,
        }}
        whileHover={prefersReducedMotion ? undefined : { y: -3, scale: 1.01 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
        aria-label="Quer uma pagina como essa? Clique aqui"
        style={{ willChange: "transform" }}
      >
        <motion.div
          className="group relative overflow-hidden rounded-full bg-black px-5 py-3.5 border-2 border-[#404040] shadow-[0_18px_55px_rgba(0,0,0,0.18)]"
          initial={false}
          animate={prefersReducedMotion ? undefined : { y: [0, -1, 0] }}
          transition={
            prefersReducedMotion
              ? undefined
              : { duration: 4.8, repeat: Infinity, ease: "easeInOut" }
          }
        >
          {/* top highlight bem sutil (Apple-like) */}
          <div
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/14 to-transparent"
            aria-hidden="true"
          />

          <div className="relative z-10 flex items-center gap-5">
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] text-white/92 font-semibold tracking-tight">
                Quer uma página como essa?
              </span>
              <span className="text-[14px] text-white/60 font-medium tracking-tight">
                Com seu link personalizado — clique aqui
              </span>
            </div>

            {/* Action pill (mesmo estilo de borda dos botões) */}
            <motion.span
              className="ml-auto inline-flex items-center justify-center rounded-full bg-white/10 border-2 border-[#404040] w-12 h-12"
              initial={false}
              animate={prefersReducedMotion ? undefined : { x: [0, 1.5, 0] }}
              transition={
                prefersReducedMotion
                  ? undefined
                  : { duration: 1.9, repeat: Infinity, ease: "easeInOut" }
              }
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white/90">
                <path
                  fill="currentColor"
                  d="M13.5 5.5a1 1 0 0 1 1.414 0l5.086 5.086a1 1 0 0 1 0 1.414l-5.086 5.086a1 1 0 1 1-1.414-1.414L16.172 13H4a1 1 0 1 1 0-2h12.172l-2.672-2.672a1 1 0 0 1 0-1.414Z"
                />
              </svg>
            </motion.span>
          </div>

          {/* premium focus ring / hover polish (sem "espelho") */}
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            initial={false}
            animate={
              prefersReducedMotion ? undefined : { opacity: [0.1, 0.18, 0.1] }
            }
            transition={
              prefersReducedMotion
                ? undefined
                : { duration: 3.8, repeat: Infinity, ease: "easeInOut" }
            }
            style={{
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.05)",
            }}
            aria-hidden="true"
          />

          {/* micro shimmer apenas no hover (bem corporativo) */}
          <motion.div
            className="absolute -inset-y-10 -left-32 w-56 rotate-[18deg] pointer-events-none opacity-0 group-hover:opacity-100"
            style={{
              background:
                "linear-gradient(to right, transparent, rgba(255,255,255,0.10), transparent)",
            }}
            initial={false}
            animate={prefersReducedMotion ? undefined : { x: [-160, 400] }}
            transition={
              prefersReducedMotion
                ? undefined
                : { duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }
            }
            aria-hidden="true"
          />
        </motion.div>
      </motion.a>


        {/* ✅ CONSENTIMENTO DE COOKIES (Dinâmica Apple / sobe de baixo) */}
      <AnimatePresence initial={false} mode="sync" presenceAffectsLayout={false}>
        {cookieReady && showCookieConsent && (
          <motion.div
            variants={cookieWrapVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="fixed inset-x-0 bottom-0 z-[70] pointer-events-none"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
              willChange: "transform, opacity",
              contain: "layout paint",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          >
            {/* ✅ centralizado no bottom */}
            <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-6">
              <div className="w-full flex justify-center">
                <motion.div
                  whileHover={prefersReducedMotion || cookieAccepting ? undefined : { y: -1, scale: 1.003 }}
                  whileTap={prefersReducedMotion || cookieAccepting ? undefined : { scale: 0.997 }}
                  transition={{ duration: prefersReducedMotion ? 0 : DUR.md, ease: EASE }}
                  className="pointer-events-auto relative transform-gpu w-full max-w-[640px]"
                  style={{ willChange: "transform", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
                >
                  <motion.div
                    variants={cookieCardVariants}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    transition={{ duration: prefersReducedMotion ? 0 : DUR.lg, ease: EASE }}
                    className="bg-black rounded-[40px] px-6 sm:px-10 md:px-10 pt-6 pb-5 w-full mt-2 relative z-10 transition-all duration-500 ease-out flex flex-col ring-1 ring-white/10 shadow-[0_18px_55px_rgba(0,0,0,0.18)] transform-gpu"
                    style={{
                      willChange: "transform, opacity, filter",
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                    }}
                  >
                    <h2 className="text-white mb-1.5 text-[1.35rem] sm:text-[1.65rem] md:text-[1.5rem] font-medium tracking-tight">
                      Consentimento de Cookies
                    </h2>

                    <p className="text-[#8a8a8a] text-[12px] sm:text-[13px] font-medium mb-3">
                      Usamos cookies para melhorar sua experiência, segurança e desempenho.
                    </p>

                    <p className="text-white/70 text-[12px] sm:text-[13px] leading-relaxed">
                      Ao continuar navegando, você concorda com o uso de cookies conforme nossa política. Você pode ajustar
                      suas preferências no navegador a qualquer momento.
                    </p>

                    <div className="mt-4">
                      <motion.button
                        type="button"
                        onClick={acceptCookies}
                        disabled={cookieAccepting}
                        whileHover={prefersReducedMotion || cookieAccepting ? undefined : { y: -2, scale: 1.01 }}
                        whileTap={prefersReducedMotion || cookieAccepting ? undefined : { scale: 0.98 }}
                        transition={{ duration: prefersReducedMotion ? 0 : DUR.sm, ease: EASE }}
                        className={cx(
                          "group relative w-full bg-[#171717] border border-[#454545] border-2 rounded-full px-6 py-4 text-white",
                          "hover:border-[#6a6a6a] focus:outline-none focus:border-lime-400 transition-all duration-300 ease-out",
                          "text-[13px] font-semibold shadow-[0_18px_55px_rgba(0,0,0,0.12)] hover:shadow-[0_22px_70px_rgba(0,0,0,0.16)] pr-16 transform-gpu",
                          cookieAccepting ? "opacity-80 cursor-not-allowed" : ""
                        )}
                        style={{ willChange: "transform" }}
                      >
                        <span className="relative z-10">
                          {cookieAccepting ? "Entendi e continuar" : "Entendi e continuar"}
                        </span>

                        <motion.span
                          whileHover={prefersReducedMotion || cookieAccepting ? undefined : { scale: 1.06 }}
                          whileTap={prefersReducedMotion || cookieAccepting ? undefined : { scale: 0.96 }}
                          transition={{ duration: prefersReducedMotion ? 0 : DUR.sm, ease: EASE }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent group-hover:bg-white/10 rounded-full p-3 transition-all duration-300 ease-out group-hover:translate-x-0.5"
                        >
                          <ArrowRight className="w-5 h-5 text-white transition-transform duration-300 group-hover:translate-x-0.5" />
                        </motion.span>
                      </motion.button>
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  );
}
