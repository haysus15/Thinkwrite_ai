// src/app/mirror-mode/dashboard/page.tsx
'use client';

import MirrorModeDashboard from '@/components/mirror-mode/MirrorModeDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthRequiredUrl } from '@/lib/auth/redirects';

export default function MirrorModeDashboardPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#000000', // Pure black for loading - cosmic bg will show
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid rgba(192, 192, 192, 0.3)',
            borderTop: '3px solid #C0C0C0',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        padding: '2rem'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '420px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.2)',
            margin: '0 auto 1rem'
          }} />
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Authentication required</h2>
          <p style={{ margin: '0 0 1.5rem', color: 'rgba(255,255,255,0.6)' }}>
            Sign in to access Mirror Mode.
          </p>
          <a
            href={getAuthRequiredUrl("/mirror-mode/dashboard")}
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              background: '#C0C0C0',
              color: '#000',
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Force transparent backgrounds so CosmicParticleBackground shows through */}
      <style jsx global>{`
        html,
        body,
        #__next,
        main {
          background: transparent !important;
          background-color: transparent !important;
          margin: 0;
          padding: 0;
        }
        
        /* The cosmic background component sets its own black background */
        /* All other elements should be transparent to let stars show */
      `}</style>
      
      {/* TRANSPARENT wrapper - no background! The cosmic component handles it */}
      <div style={{ 
        minHeight: '100vh',
        background: 'transparent',
        margin: 0,
        padding: 0,
        position: 'relative'
      }}>
        <MirrorModeDashboard userId={user.id} />
      </div>
    </>
  );
}
