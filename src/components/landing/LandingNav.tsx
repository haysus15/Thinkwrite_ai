'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import SignUpModal from '@/components/auth/SignUpModal';
import SignInModal from '@/components/auth/SignInModal';
import { useSearchParams } from 'next/navigation';

export default function LandingNav() {
  const [showSignUp, setShowSignUp] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { user, signOut, loading } = useAuth();
  const searchParams = useSearchParams();

  useEffect(() => {
    const requiresAuth = searchParams.get('auth') === 'required';
    if (requiresAuth && !user) {
      setShowSignUp(false);
      setShowSignIn(true);
    }
  }, [searchParams, user]);

  useEffect(() => {
    if (user) {
      setShowSignIn(false);
      setShowSignUp(false);
    }
  }, [user]);

  useEffect(() => {
    if (!toastMessage) return;
    const timeout = setTimeout(() => setToastMessage(null), 4500);
    return () => clearTimeout(timeout);
  }, [toastMessage]);

  const handleSignOut = async () => {
    await signOut();
  };

  const showToast = (message: string) => {
    setToastMessage(message);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo Image */}
          <div className="flex items-center">
            <Image 
              src="/thinkwrite-logo-transparent.png" 
              alt="THINKWRITE - AI" 
              width={200}
              height={30}
              className="h-auto w-auto max-h-6"
              priority
            />
          </div>
          
          {/* Nav Links */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-300 hover:text-[#FFD37A] transition-colors text-sm">
              Features
            </a>
            <a href="#how-it-works" className="text-gray-300 hover:text-[#FFD37A] transition-colors text-sm">
              How It Works
            </a>
            <a href="#pricing" className="text-gray-300 hover:text-[#FFD37A] transition-colors text-sm">
              Pricing
            </a>
          </div>
          
          {/* CTA Buttons */}
          <div className="flex items-center space-x-4">
            {loading ? (
              <div className="flex items-center space-x-4">
                <div className="h-4 w-16 rounded bg-white/10" />
                <div className="h-9 w-20 rounded bg-white/10" />
              </div>
            ) : user ? (
              <>
                <a 
                  href="/select-studio"
                  className="text-gray-300 hover:text-[#FFD37A] transition-colors text-sm"
                >
                  My Studios
                </a>
                <button 
                  onClick={handleSignOut}
                  className="text-gray-300 hover:text-white transition-colors text-sm"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => setShowSignIn(true)}
                  className="text-gray-300 hover:text-white transition-colors text-sm"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => setShowSignUp(true)}
                  className="px-5 py-2 font-['Orbitron'] font-semibold rounded-lg hover:scale-105 transition-transform text-sm text-black"
                  style={{
                    background: 'linear-gradient(90deg, #FFFFFF 0%, #E7E9EE 25%, #FFD37A 60%, #B8860B 100%)',
                    boxShadow: '0 0 18px rgba(255,210,120,0.22), 0 0 42px rgba(255,210,120,0.10), inset 0 0 18px rgba(255,255,255,0.18)',
                    border: '1px solid rgba(255,255,255,0.22)',
                  }}
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Auth Modals */}
      <SignUpModal 
        isOpen={showSignUp} 
        onClose={() => setShowSignUp(false)}
        onSwitchToSignIn={() => {
          setShowSignUp(false);
          setShowSignIn(true);
        }}
        onEmailVerificationSent={(email) => {
          showToast(`Profile created for ${email}. Check your email to verify your account.`);
        }}
      />
      <SignInModal 
        isOpen={showSignIn} 
        onClose={() => setShowSignIn(false)}
        onSwitchToSignUp={() => {
          setShowSignIn(false);
          setShowSignUp(true);
        }}
      />

      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-[200] rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-[11px] text-white/85 shadow-lg backdrop-blur">
          {toastMessage}
        </div>
      )}
    </>
  );
}
