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
  const { user, signOut } = useAuth();
  const searchParams = useSearchParams();

  useEffect(() => {
    const requiresAuth = searchParams.get('auth') === 'required';
    if (requiresAuth && !user) {
      setShowSignUp(false);
      setShowSignIn(true);
    }
  }, [searchParams, user]);

  const handleSignOut = async () => {
    await signOut();
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
            {user ? (
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
      />
      <SignInModal 
        isOpen={showSignIn} 
        onClose={() => setShowSignIn(false)}
        onSwitchToSignUp={() => {
          setShowSignIn(false);
          setShowSignUp(true);
        }}
      />
    </>
  );
}
