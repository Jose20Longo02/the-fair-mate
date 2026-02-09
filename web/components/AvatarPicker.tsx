"use client";

import Image from "next/image";
import { AVATAR_OPTIONS, avatarUrl } from "@/lib/avatars";

const BUTTON_BLUE = "#1e40af";

type Props = {
  value: string | null;
  onChange: (filename: string) => void;
  required?: boolean;
  label?: string;
  size?: "sm" | "md" | "lg";
};

export default function AvatarPicker({ value, onChange, required, label = "Choose your avatar", size = "md" }: Props) {
  const sizeClass = size === "sm" ? "h-12 w-12 sm:h-14 sm:w-14" : size === "lg" ? "h-20 w-20 sm:h-24 sm:w-24" : "h-16 w-16 sm:h-20 sm:w-20";

  return (
    <div className="w-full min-w-0">
      {label && (
        <p className="mb-3 text-sm font-medium text-stone-300 sm:text-base">
          {label} {required && <span className="text-stone-500">*</span>}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
        {AVATAR_OPTIONS.map((filename) => {
          const isSelected = value === filename;
          return (
            <button
              key={filename}
              type="button"
              onClick={() => onChange(filename)}
              className={`relative shrink-0 overflow-hidden rounded-full border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-stone-500 focus:ring-offset-2 focus:ring-offset-stone-900 ${sizeClass} ${
                isSelected
                  ? "border-white scale-110 ring-4 ring-blue-400/70 ring-offset-2 ring-offset-stone-800 shadow-lg shadow-blue-900/40"
                  : "border-stone-600 hover:scale-105 hover:border-stone-400 hover:shadow-md hover:shadow-black/30"
              }`}
              style={isSelected ? { boxShadow: `0 0 0 2px white, 0 0 12px ${BUTTON_BLUE}80, 0 4px 14px rgba(0,0,0,0.3)` } : undefined}
            >
              <Image
                src={avatarUrl(filename)}
                alt={filename.replace(".png", "")}
                fill
                className="object-cover"
                sizes={size === "lg" ? "96px" : size === "sm" ? "56px" : "80px"}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
