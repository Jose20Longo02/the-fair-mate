"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AvatarPicker from "@/components/AvatarPicker";

export default function AccountAvatarSection({ currentAvatar }: { currentAvatar: string | null }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(currentAvatar);

  useEffect(() => {
    setAvatar(currentAvatar);
  }, [currentAvatar]);

  async function handleChange(filename: string) {
    setAvatar(filename);
    setSaving(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: filename }),
      });
      if (res.ok) router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 sm:mt-5">
      <AvatarPicker
        value={avatar}
        onChange={handleChange}
        label="Profile picture"
        size="md"
      />
      {saving && (
        <p className="mt-2 text-xs text-stone-500">Saving…</p>
      )}
    </div>
  );
}
