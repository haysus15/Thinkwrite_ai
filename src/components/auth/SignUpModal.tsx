// src/components/auth/SignUpModal.tsx
"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";

interface SignUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToSignIn: () => void;
  onEmailVerificationSent: (email: string) => void;
}

export default function SignUpModal({
  isOpen,
  onClose,
  onSwitchToSignIn,
  onEmailVerificationSent,
}: SignUpModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationSentEmail, setVerificationSentEmail] = useState<string | null>(null);
  const [resendError, setResendError] = useState("");
  const [resendSuccess, setResendSuccess] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const { signUp, resendVerification } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setEmail("");
      setPassword("");
      setError("");
      setLoading(false);
      setVerificationSentEmail(null);
      setResendError("");
      setResendSuccess("");
      setResendLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signUpError, needsEmailConfirmation } = await signUp(email, password, name);

    if (signUpError) {
      setError(signUpError);
      setLoading(false);
    } else {
      if (needsEmailConfirmation) {
        setVerificationSentEmail(email);
        onEmailVerificationSent(email);
        setLoading(false);
        return;
      }

      onClose();
      const redirectTo = searchParams.get("redirect");
      router.push(redirectTo || "/select-studio");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-black/90 border border-white/20 rounded-2xl shadow-[0_0_100px_rgba(234,170,0,0.3)] backdrop-blur-xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          {verificationSentEmail ? (
            <>
              <h2 className="text-2xl font-['Orbitron'] font-bold text-white mb-2">
                Check Your Email
              </h2>
              <p className="text-sm text-white/60 mb-6">
                We sent a verification link to{" "}
                <span className="text-white/90">{verificationSentEmail}</span>. You’ll need
                to click that link before you can sign in.
              </p>
              <p className="text-xs text-white/50 mb-4">
                Didn’t get it? Check your spam folder or resend the email below.
              </p>
              {resendError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {resendError}
                </div>
              )}
              {resendSuccess && (
                <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-sm">
                  {resendSuccess}
                </div>
              )}
              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => {
                    if (!verificationSentEmail) return;
                    setResendError("");
                    setResendSuccess("");
                    setResendLoading(true);
                    const { error: resendErrorMessage } = await resendVerification(
                      verificationSentEmail
                    );
                    if (resendErrorMessage) {
                      setResendError(resendErrorMessage);
                    } else {
                      setResendSuccess("Verification email resent. Check your inbox.");
                    }
                    setResendLoading(false);
                  }}
                  disabled={resendLoading}
                  className="w-full px-6 py-3 border border-white/20 text-white/80 rounded-lg hover:text-white hover:border-white/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendLoading ? "Resending..." : "Resend Verification Email"}
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onSwitchToSignIn();
                  }}
                  className="w-full px-6 py-3 bg-gradient-to-r from-[#00f5ff] to-[#a855f7] text-black font-['Orbitron'] font-semibold rounded-lg hover:scale-[1.02] transition-transform"
                >
                  Go To Sign In
                </button>
                <button
                  onClick={onClose}
                  className="w-full px-6 py-3 border border-white/20 text-white/80 rounded-lg hover:text-white hover:border-white/40 transition-colors"
                >
                  Close
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-['Orbitron'] font-bold text-white mb-2">
                Create Your Account
              </h2>
              <p className="text-sm text-white/60 mb-6">
                Join ThinkWrite AI and start writing in your authentic voice
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm text-white/80 mb-2">
                    Full Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#EAAA00] transition-colors"
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm text-white/80 mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#EAAA00] transition-colors"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm text-white/80 mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#EAAA00] transition-colors"
                    placeholder="Create a password (min. 6 characters)"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-3 bg-gradient-to-r from-[#00f5ff] to-[#a855f7] text-black font-['Orbitron'] font-semibold rounded-lg hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Creating Account..." : "Sign Up"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-white/60">
                  Already have an account?{" "}
                  <button
                    onClick={onSwitchToSignIn}
                    className="text-[#EAAA00] hover:text-[#d9a000] font-medium transition-colors"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
