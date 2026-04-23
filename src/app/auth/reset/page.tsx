"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const t = useTranslations();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [isRecovery, setIsRecovery] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    setResolved(true);

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError(t("auth.errors.passwordMismatch"));
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(t("auth.errors.resetFailed"));
      return;
    }

    setSuccess(true);
    await supabase.auth.signOut({ scope: "global" });
    router.push("/?reset=success");
  };

  if (!resolved) {
    return (
        <div className="min-h-screen flex items-center justify-center text-white/80">
        {t("global.loading")}...
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-white/90">{t("auth.reset.invalidLink")}</p>
        <Link href="/" className="text-[#EAAA00] hover:text-[#d9a000] transition-colors">
          {t("auth.reset.returnHome")}
        </Link>
      </div>
    );
  }

  if (success) {
    return (
        <div className="min-h-screen flex items-center justify-center text-white/90 px-6 text-center">
        {t("auth.reset.successRedirect")}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black/80 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/20 bg-black/90 p-8">
        <h1 className="text-2xl font-['Orbitron'] font-bold text-white mb-2">
          {t("auth.reset.title")}
        </h1>
        <p className="text-sm text-white/60 mb-6">{t("auth.reset.subtitle")}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="block text-sm text-white/80 mb-2">
              {t("auth.reset.newPassword")}
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 pr-11 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#EAAA00] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowNew((prev) => !prev)}
                className="absolute inset-y-0 right-3 text-white/60 hover:text-white transition-colors"
                aria-label={showNew ? t("auth.actions.hidePassword") : t("auth.actions.showPassword")}
              >
                {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm text-white/80 mb-2">
              {t("auth.reset.confirmPassword")}
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 pr-11 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#EAAA00] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                className="absolute inset-y-0 right-3 text-white/60 hover:text-white transition-colors"
                aria-label={showConfirm ? t("auth.actions.hidePassword") : t("auth.actions.showPassword")}
              >
                {showConfirm ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full px-6 py-3 bg-gradient-to-r from-[#00f5ff] to-[#a855f7] text-black font-['Orbitron'] font-semibold rounded-lg hover:scale-[1.02] transition-transform"
          >
            {t("auth.reset.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
