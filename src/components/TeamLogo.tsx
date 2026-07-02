"use client";
import { useState } from "react";
import { TEAM_LOGOS } from "@/data/teamLogos";

interface Props {
  team: string;
  size?: number;
  className?: string;
}

export default function TeamLogo({ team, size = 20, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const src = TEAM_LOGOS[team];
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt={team}
      width={size}
      height={size}
      className={`object-contain flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
