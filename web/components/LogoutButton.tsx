"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton({
  className,
  onClick: onClose,
  label,
}: {
  className?: string;
  onClick?: () => void;
  label?: string;
}) {
  const router = useRouter();

  async function handleLogout() {
    onClose?.();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={
        className ??
        "text-sm font-medium text-stone-600 hover:text-stone-900"
      }
    >
      {label ?? "Log out"}
    </button>
  );
}
