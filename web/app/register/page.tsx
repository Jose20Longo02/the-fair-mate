"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo, useEffect, useRef } from "react";
import AvatarPicker from "@/components/AvatarPicker";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { MAX_USERNAME_LENGTH, USERNAME_REGEX } from "@/lib/username";

const USERNAME_MIN_LENGTH = 2;
const USERNAME_CHECK_DEBOUNCE_MS = 400;

const PAGE_BG = "#252525";
const BUTTON_BLUE = "#1e40af";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SKILL_LEVEL_OPTIONS = [
  { value: 400, label: "New to chess" },
  { value: 800, label: "Beginner" },
  { value: 1200, label: "Intermediate" },
  { value: 1600, label: "Advanced" },
] as const;

function useEmailValid(email: string) {
  if (!email.trim()) return null;
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

function usePasswordChecks(password: string) {
  return useMemo(
    () => ({
      minLength: password.length >= 8,
      hasLetter: /[a-zA-Z]/.test(password),
      hasNumber: /\d/.test(password),
    }),
    [password]
  );
}

export default function Register() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [initialElo, setInitialElo] = useState(1200);
  const [avatar, setAvatar] = useState<string>(AVATAR_OPTIONS[0]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false, confirm: false });
  const [usernameCheck, setUsernameCheck] = useState<null | "loading" | true | false>(null);
  const [usernameReason, setUsernameReason] = useState<string | null>(null);
  const usernameCheckRef = useRef(0);

  const emailValid = useEmailValid(email);
  const passwordChecks = usePasswordChecks(password);
  const passwordStrong =
    passwordChecks.minLength && passwordChecks.hasLetter && passwordChecks.hasNumber;
  const passwordsMatch =
    confirmPassword.length > 0 ? password === confirmPassword : null;

  const nameTrimmed = name.trim();
  const usernameFormatOk =
    nameTrimmed.length === 0 ||
    (nameTrimmed.length >= USERNAME_MIN_LENGTH &&
      nameTrimmed.length <= MAX_USERNAME_LENGTH &&
      USERNAME_REGEX.test(nameTrimmed));
  const usernameRequired = nameTrimmed.length >= USERNAME_MIN_LENGTH;
  const usernameValid = !usernameRequired || usernameCheck === true;

  useEffect(() => {
    if (nameTrimmed.length < USERNAME_MIN_LENGTH) {
      setUsernameCheck(null);
      setUsernameReason(nameTrimmed.length > 0 ? `At least ${USERNAME_MIN_LENGTH} characters` : null);
      return;
    }
    if (nameTrimmed.length > MAX_USERNAME_LENGTH) {
      setUsernameCheck(null);
      setUsernameReason(`Maximum ${MAX_USERNAME_LENGTH} characters`);
      return;
    }
    if (!USERNAME_REGEX.test(nameTrimmed)) {
      setUsernameCheck(null);
      setUsernameReason("Only letters, numbers, and underscore (_)");
      return;
    }
    setUsernameCheck("loading");
    setUsernameReason(null);
    const id = ++usernameCheckRef.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/auth/check-username?name=${encodeURIComponent(nameTrimmed)}`
        );
        const data = await res.json();
        if (id !== usernameCheckRef.current) return;
        setUsernameCheck(data.available === true);
        setUsernameReason(data.reason ?? null);
      } catch {
        if (id !== usernameCheckRef.current) return;
        setUsernameCheck(null);
        setUsernameReason("Could not check");
      }
    }, USERNAME_CHECK_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [nameTrimmed]);

  const step1Valid =
    emailValid === true &&
    passwordStrong &&
    passwordsMatch === true &&
    email.trim().length > 0 &&
    usernameValid &&
    usernameFormatOk;

  function handleStep1Continue(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!step1Valid) return;
    setStep(2);
  }

  function handleStep2Continue(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setStep(3);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim() || undefined,
          avatar,
          initialElo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }

  const inputBase =
    "mt-2 w-full rounded-xl border bg-stone-700/80 px-4 py-3 text-base text-white placeholder-stone-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-900";
  const inputValid = "border-stone-500 focus:border-stone-400 focus:ring-stone-500";
  const inputInvalid = "border-red-500/80 focus:border-red-400 focus:ring-red-500/50";
  const inputNeutral = "border-stone-600 focus:border-stone-500 focus:ring-stone-500";

  return (
    <main
      className="flex min-h-[calc(100vh-4rem)] w-full flex-1 items-center justify-center px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-5rem)] sm:px-6 sm:py-10 md:min-h-[calc(100vh-6rem)]"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto w-full max-w-md">
        {/* Step indicator */}
        <div className="mb-6 flex items-center justify-center gap-2 sm:mb-8">
          <span
            className={`h-2 w-2 rounded-full transition-colors sm:h-2.5 sm:w-2.5 ${
              step >= 1 ? "bg-blue-500" : "bg-stone-600"
            }`}
          />
          <span className="h-0.5 w-6 rounded-full bg-stone-600 sm:w-8" />
          <span
            className={`h-2 w-2 rounded-full transition-colors sm:h-2.5 sm:w-2.5 ${
              step >= 2 ? "bg-blue-500" : "bg-stone-600"
            }`}
          />
          <span className="h-0.5 w-6 rounded-full bg-stone-600 sm:w-8" />
          <span
            className={`h-2 w-2 rounded-full transition-colors sm:h-2.5 sm:w-2.5 ${
              step >= 3 ? "bg-blue-500" : "bg-stone-600"
            }`}
          />
          <span className="ml-2 text-xs font-medium text-stone-500 sm:text-sm">
            Step {step} of 3
          </span>
        </div>

        <div className="rounded-2xl border border-stone-600/90 bg-stone-800/90 p-6 shadow-xl shadow-black/20 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Sign up
          </h1>
          <p className="mt-2 text-sm text-stone-400 sm:text-base">
            {step === 1 && "Enter your account details."}
            {step === 2 && "What's your chess level? We'll use this as your starting ELO."}
            {step === 3 && "Choose your profile picture. You can change it later."}
          </p>

          {step === 1 ? (
            <form onSubmit={handleStep1Continue} className="mt-8 space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-stone-300">
                  Username
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="username"
                  value={name}
                  onChange={(e) => {
                    const next = e.target.value.replace(/\s+/g, "");
                    setName(next);
                  }}
                  maxLength={MAX_USERNAME_LENGTH}
                  className={`${inputBase} ${
                    usernameCheck === true
                      ? inputValid
                      : usernameCheck === false
                        ? inputInvalid
                        : inputNeutral
                  }`}
                  placeholder="Letters/numbers/underscore only (min. 2)"
                />
                {nameTrimmed.length > 0 && (
                  <p
                    className={`mt-1.5 flex items-center gap-1.5 text-sm ${
                      usernameCheck === true
                        ? "text-emerald-400"
                        : usernameCheck === false
                          ? "text-red-400"
                          : usernameCheck === "loading"
                            ? "text-stone-500"
                            : usernameReason
                              ? "text-amber-400"
                              : "text-stone-500"
                    }`}
                  >
                    {usernameCheck === "loading" && <>Checking availability…</>}
                    {usernameCheck === true && <>✓ Username available</>}
                    {usernameCheck === false && <>✗ Username already taken</>}
                    {usernameCheck === null && usernameReason && <>{usernameReason}</>}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-stone-300">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setTouched((t) => ({ ...t, email: true }));
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  className={`${inputBase} ${
                    !touched.email
                      ? inputNeutral
                      : emailValid === true
                        ? inputValid
                        : emailValid === false
                          ? inputInvalid
                          : inputNeutral
                  }`}
                  placeholder="you@example.com"
                />
                {touched.email && email.trim() && (
                  <p
                    className={`mt-1.5 flex items-center gap-1.5 text-sm ${
                      emailValid === true ? "text-emerald-400" : emailValid === false ? "text-red-400" : "text-stone-500"
                    }`}
                  >
                    {emailValid === true ? (
                      <>✓ Valid email</>
                    ) : emailValid === false ? (
                      <>✗ Enter a valid email address</>
                    ) : null}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-stone-300">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setTouched((t) => ({ ...t, password: true }));
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  className={`${inputBase} ${
                    !touched.password
                      ? inputNeutral
                      : passwordStrong
                        ? inputValid
                        : password.length > 0
                          ? inputInvalid
                          : inputNeutral
                  }`}
                  placeholder="At least 8 characters, letter and number"
                />
                <ul className="mt-2 space-y-1 text-sm">
                  <li
                    className={`flex items-center gap-2 ${
                      passwordChecks.minLength ? "text-emerald-400" : "text-stone-500"
                    }`}
                  >
                    {passwordChecks.minLength ? "✓" : "○"} At least 8 characters
                  </li>
                  <li
                    className={`flex items-center gap-2 ${
                      passwordChecks.hasLetter ? "text-emerald-400" : "text-stone-500"
                    }`}
                  >
                    {passwordChecks.hasLetter ? "✓" : "○"} At least one letter
                  </li>
                  <li
                    className={`flex items-center gap-2 ${
                      passwordChecks.hasNumber ? "text-emerald-400" : "text-stone-500"
                    }`}
                  >
                    {passwordChecks.hasNumber ? "✓" : "○"} At least one number
                  </li>
                </ul>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-stone-300">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setTouched((t) => ({ ...t, confirm: true }));
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
                  className={`${inputBase} ${
                    !touched.confirm
                      ? inputNeutral
                      : passwordsMatch === true
                        ? inputValid
                        : passwordsMatch === false
                          ? inputInvalid
                          : inputNeutral
                  }`}
                  placeholder="Repeat your password"
                />
                {touched.confirm && confirmPassword.length > 0 && (
                  <p
                    className={`mt-1.5 flex items-center gap-1.5 text-sm ${
                      passwordsMatch === true ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {passwordsMatch === true ? (
                      <>✓ Passwords match</>
                    ) : (
                      <>✗ Passwords do not match</>
                    )}
                  </p>
                )}
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!step1Valid}
                className="w-full rounded-xl px-4 py-3.5 text-base font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: BUTTON_BLUE }}
              >
                Continue
              </button>
            </form>
          ) : step === 2 ? (
            <form onSubmit={handleStep2Continue} className="mt-8 space-y-6">
              <div>
                <label htmlFor="skillLevel" className="block text-sm font-medium text-stone-300">
                  Your level
                </label>
                <select
                  id="skillLevel"
                  value={initialElo}
                  onChange={(e) => setInitialElo(Number(e.target.value))}
                  className="mt-2 w-full cursor-pointer appearance-none rounded-xl border border-stone-600 bg-stone-700/90 py-3.5 pl-4 pr-10 text-base text-white transition-colors placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-500/40 focus:ring-offset-2 focus:ring-offset-stone-900 hover:border-stone-500/80 [&>option]:bg-stone-800 [&>option]:text-white"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23a8a29e'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 0.75rem center",
                    backgroundSize: "1.25rem",
                  }}
                >
                  {SKILL_LEVEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-sm text-stone-500">
                  Your rating will adjust as you play. Choose honestly for fairer first games.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  className="w-full rounded-xl px-4 py-3.5 text-base font-semibold text-white transition hover:opacity-90"
                  style={{ backgroundColor: BUTTON_BLUE }}
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full rounded-xl border border-stone-600 bg-transparent px-4 py-3 text-base font-medium text-stone-300 transition hover:bg-stone-700/50 hover:text-white"
                >
                  ← Back
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              {/* Summary */}
              <div className="rounded-xl border border-stone-600/80 bg-stone-800/50 px-4 py-3 text-sm text-stone-300">
                <p className="font-medium text-stone-200">Account summary</p>
                <p className="mt-1 truncate">{email.trim() || "—"}</p>
                {name.trim() && (
                  <p className="mt-0.5 text-stone-400">Username: {name.trim()}</p>
                )}
                <p className="mt-0.5 text-stone-400">
                  Level: {SKILL_LEVEL_OPTIONS.find((o) => o.value === initialElo)?.label ?? "—"}
                </p>
              </div>

              <AvatarPicker
                value={avatar}
                onChange={setAvatar}
                required
                label="Choose your avatar"
                size="md"
              />

              {error && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl px-4 py-3.5 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: BUTTON_BLUE }}
                >
                  {loading ? "Creating account…" : "Create account"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full rounded-xl border border-stone-600 bg-transparent px-4 py-3 text-base font-medium text-stone-300 transition hover:bg-stone-700/50 hover:text-white"
                >
                  ← Back
                </button>
              </div>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-stone-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium underline hover:no-underline"
              style={{ color: "#3794FF" }}
            >
              Log in
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center">
          <Link href="/" className="text-sm text-stone-400 transition hover:text-white">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
