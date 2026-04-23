import { useState, useCallback, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

type ScenePhase = 'intro' | 'stillness' | 'transitioning' | 'chaos' | 'la'

const ease = [0.43, 0.13, 0.23, 0.96] as const

const kenBurnsStyle = `
  @keyframes kenBurns {
    0%   { transform: scale(1.0) translate(0px, 0px); }
    50%  { transform: scale(1.08) translate(-6px, -4px); }
    100% { transform: scale(1.0) translate(0px, 0px); }
  }
  .bg-stillness {
    animation: kenBurns 20s ease-in-out infinite;
    will-change: transform;
  }
  @keyframes chaosZoom {
    0%   { transform: scale(1.0); }
    100% { transform: scale(1.12); }
  }
  .bg-chaos {
    animation: chaosZoom 8s ease-in-out infinite alternate;
    will-change: transform;
  }
`

// ── Types ────────────────────────────────────────────────────────────────────

interface TwinkleStar {
  x: number
  y: number
  radius: number
  baseOpacity: number   // resting dim level
  opacity: number       // current rendered opacity
  color: string
  // Flash state machine
  flashCountdown: number          // frames until next flash fires
  flashState: 'idle' | 'rising' | 'falling'
  flashPeak: number               // peak opacity for this flash
  flashFrame: number              // frames elapsed within current flash phase
}

interface ShootingStar {
  x: number
  y: number
  angle: number   // radians
  speed: number
  length: number
  life: number    // frames elapsed
  maxLife: number // total frames
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const rand = (min: number, max: number) => Math.random() * (max - min) + min
const STAR_COLORS = ['#ffffff', '#ffffff', '#ffffff', '#cce4ff', '#fff5cc']

function makeStar(w: number, h: number): TwinkleStar {
  const baseOpacity = rand(0.15, 0.4)
  return {
    x: rand(0, w),
    y: rand(0, h * 0.45),
    radius: rand(0.3, 1.2),
    baseOpacity,
    opacity: baseOpacity,
    color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
    flashCountdown: Math.floor(rand(120, 300)), // 2-5s at 60fps, staggered start
    flashState: 'idle',
    flashPeak: 0,
    flashFrame: 0,
  }
}

function makeShootingStar(w: number, h: number): ShootingStar {
  const angleDeg = rand(-50, -20)
  const angle = (angleDeg * Math.PI) / 180
  const speed = rand(6, 10)
  const length = rand(80, 120)
  const maxLife = Math.ceil((length * 2) / speed)
  return {
    x: rand(w * 0.1, w * 0.9),
    y: rand(0, h * 0.4),
    angle,
    speed,
    length,
    life: 0,
    maxLife,
  }
}

// ── StarCanvas ───────────────────────────────────────────────────────────────

function StarCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = window.innerWidth
    let h = window.innerHeight
    canvas.width = w
    canvas.height = h

    let stars: TwinkleStar[] = Array.from({ length: 80 }, () => makeStar(w, h))
    let shooters: ShootingStar[] = []
    let nextSpawnIn = rand(3000, 6000) // ms
    let lastSpawnTime = performance.now()
    let rafId: number

    const spawnShooter = () => {
      if (shooters.length < 2) shooters.push(makeShootingStar(w, h))
    }

    const draw = (now: number) => {
      ctx.clearRect(0, 0, w, h)

      // Twinkling stars — flash state machine
      for (const s of stars) {
        if (s.flashState === 'idle') {
          s.flashCountdown--
          if (s.flashCountdown <= 0) {
            s.flashState = 'rising'
            s.flashPeak = rand(0.9, 1.0)
            s.flashFrame = 0
          }
          s.opacity = s.baseOpacity
        } else if (s.flashState === 'rising') {
          s.flashFrame++
          const t = Math.min(s.flashFrame / 8, 1)
          s.opacity = s.baseOpacity + (s.flashPeak - s.baseOpacity) * t
          if (s.flashFrame >= 8) {
            s.flashState = 'falling'
            s.flashFrame = 0
          }
        } else {
          // falling
          s.flashFrame++
          const t = Math.min(s.flashFrame / 12, 1)
          s.opacity = s.flashPeak - (s.flashPeak - s.baseOpacity) * t
          if (s.flashFrame >= 12) {
            s.flashState = 'idle'
            s.flashCountdown = Math.floor(rand(120, 300))
            s.opacity = s.baseOpacity
          }
        }

        const isFlashing = s.flashState !== 'idle'

        if (isFlashing) {
          // Glow only during flash
          const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.radius * 4)
          glow.addColorStop(0, `rgba(255,255,255,${s.opacity.toFixed(2)})`)
          glow.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.radius * 4, 0, Math.PI * 2)
          ctx.fillStyle = glow
          ctx.globalAlpha = 1
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2)
          ctx.fillStyle = s.color
          ctx.globalAlpha = s.opacity
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1

      // Spawn shooting stars on timer
      if (now - lastSpawnTime >= nextSpawnIn) {
        spawnShooter()
        lastSpawnTime = now
        nextSpawnIn = rand(3000, 6000)
      }

      // Draw and advance shooting stars
      shooters = shooters.filter(s => s.life < s.maxLife)
      for (const s of shooters) {
        const progress = s.life / s.maxLife
        // Head position advances with life
        const headX = s.x + Math.cos(s.angle) * s.speed * s.life
        const headY = s.y + Math.sin(s.angle) * s.speed * s.life
        const tailX = headX - Math.cos(s.angle) * s.length
        const tailY = headY - Math.sin(s.angle) * s.length

        // Opacity envelope: ramp up first 20%, hold, ramp out last 30%
        let alpha = 0.9
        if (progress < 0.2) alpha = (progress / 0.2) * 0.9
        else if (progress > 0.7) alpha = ((1 - progress) / 0.3) * 0.9

        const grad = ctx.createLinearGradient(headX, headY, tailX, tailY)
        grad.addColorStop(0, `rgba(255,255,255,${alpha.toFixed(2)})`)
        grad.addColorStop(1, 'rgba(255,255,255,0)')

        ctx.beginPath()
        ctx.moveTo(headX, headY)
        ctx.lineTo(tailX, tailY)
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Bright head dot
        ctx.beginPath()
        ctx.arc(headX, headY, 1.2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${Math.min(alpha * 1.2, 1).toFixed(2)})`
        ctx.fill()

        s.life++
      }

      ctx.globalAlpha = 1

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)

    const onResize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w
      canvas.height = h
      stars = Array.from({ length: 80 }, () => makeStar(w, h))
      shooters = []
    }

    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  )
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [phase, setPhase] = useState<ScenePhase>('intro')

  const handleEnter = useCallback(() => {
    if (phase === 'intro') setPhase('stillness')
  }, [phase])

  useEffect(() => {
    if (phase !== 'stillness') return
    const timer = setTimeout(() => {
      setPhase('transitioning')
      setTimeout(() => setPhase('chaos'), 2400)
    }, 6000)
    return () => clearTimeout(timer)
  }, [phase])

  const isChaos = phase === 'chaos'
  const isTransitioning = phase === 'transitioning'

  return (
    <div style={styles.root}>
      <style>{kenBurnsStyle}</style>

      {/* ── INTRO SCENE ─────────────────────────────────────────────── */}

      {/* Intro — background */}
      <motion.div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 30,
          overflow: 'hidden',
          backgroundColor: '#0a0806',
          pointerEvents: phase === 'intro' ? 'auto' : 'none',
        }}
        animate={{ opacity: phase === 'intro' ? 1 : 0 }}
        transition={{ opacity: { duration: 1.5, ease: [0.43, 0.13, 0.23, 0.96] } }}
      >
        <img
          src="/freeyourthoughts.png"
          alt="Free your thoughts"
          style={styles.introFullscreenImage}
        />
        <div style={styles.introImageGrade} />
        <div style={styles.introImageGlow} />
      </motion.div>

      {/* Intro — text overlay */}
      <motion.div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 35,
          pointerEvents: phase === 'intro' ? 'auto' : 'none',
        }}
        animate={{ opacity: phase === 'intro' ? 1 : 0 }}
        transition={{ opacity: { duration: 1.5, ease: [0.43, 0.13, 0.23, 0.96] } }}
      >
        <p style={{
          position: 'absolute',
          top: '1.5rem',
          left: '1.5rem',
          margin: 0,
          fontFamily: "'Inter', sans-serif",
          fontSize: '0.7rem',
          fontWeight: 300,
          letterSpacing: '0.35em',
          color: 'rgba(255,255,255,0.85)',
          textShadow: '0 1px 8px rgba(0,0,0,0.6)',
          userSelect: 'none',
        }}>
          THINKWRITE AI
        </p>

        <motion.p
          style={{
            position: 'absolute',
            bottom: '1.5rem',
            right: '2rem',
            margin: 0,
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: 'italic',
            fontSize: 'clamp(1rem, 1.6vw, 1.4rem)',
            fontWeight: 300,
            color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.05em',
            textShadow: '0 0 20px rgba(0,0,0,0.9)',
            cursor: 'pointer',
            userSelect: 'none',
            pointerEvents: 'auto',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 'intro' ? 1 : 0 }}
          transition={{ duration: 2, delay: 4, ease: 'easeIn' }}
          whileHover={{ color: 'rgba(255,255,255,0.65)' }}
          onClick={handleEnter}
        >
          enter
        </motion.p>
      </motion.div>

      {/* ── STILLNESS SCENE ─────────────────────────────────────────── */}

      {/* Background — zIndex 0 */}
      <motion.div
        className={!isChaos ? 'bg-stillness' : undefined}
        style={{ ...styles.bg, backgroundImage: "url('./stillness-bg.jpg')" }}
        animate={{ opacity: isChaos ? 0 : 1 }}
        transition={{ opacity: { duration: 2, ease } }}
      />

      {/* Star canvas — zIndex 1, stillness only */}
      {!isChaos && <StarCanvas />}

      {/* All stillness text/UI — zIndex 2+ */}
      {!isChaos && <p style={styles.wordmark}>THINKWRITE AI</p>}

      {phase !== 'chaos' && (
        <div style={styles.center}>
          <motion.div
            style={styles.textBlock}
            animate={{ opacity: isTransitioning ? 0 : 1 }}
            transition={{ duration: 0.8, ease }}
          >
            <p style={{
              margin: 0,
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(1.1rem, 2vw, 1.8rem)',
              fontWeight: 300,
              fontStyle: 'italic',
              color: 'rgba(255,255,255,0.65)',
              letterSpacing: '0.06em',
              lineHeight: 2,
              textAlign: 'center',
              textShadow: '0 1px 16px rgba(0,0,0,0.6)',
            }}>
              i'm wishing on a dream<br />
              to follow what it means
            </p>
          </motion.div>
        </div>
      )}

      {!isChaos && <p style={styles.caption}>See you, space writer...</p>}

      {/* ── CHAOS SCENE ─────────────────────────────────────────────── */}

      {/* Chaos — background layer (zooms) */}
      <motion.div
        className="bg-chaos"
        style={{ ...styles.chaosOuter, pointerEvents: isChaos ? 'auto' : 'none' }}
        animate={{ opacity: isChaos ? 1 : 0 }}
        transition={{ opacity: { duration: 2, ease } }}
      />

      {/* Chaos — text overlay (fixed, never zooms) */}
      <motion.div
        style={{ ...styles.chaosTextOverlay, pointerEvents: 'none' }}
        animate={{ opacity: isChaos ? 1 : 0 }}
        transition={{ opacity: { duration: 0.8, delay: 0.2, ease } }}
      >
        <p style={styles.chaosWordmark}>THINKWRITE AI</p>

        <div style={{
          position: 'absolute',
          top: '28%',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}>
          <p style={styles.chaosQuote}>
            when I try to get a peace of mind<br />
            people try and take a piece of mine
          </p>
        </div>

        <motion.p
          style={{
            position: 'absolute',
            bottom: '1.5rem',
            right: '2rem',
            margin: 0,
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: 'italic',
            fontSize: 'clamp(1rem, 1.6vw, 1.4rem)',
            fontWeight: 300,
            color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.05em',
            textShadow: '0 0 20px rgba(0,0,0,0.9)',
            cursor: 'pointer',
            userSelect: 'none',
            pointerEvents: 'auto',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: isChaos ? 1 : 0 }}
          transition={{ duration: 2, delay: 5, ease: 'easeIn' }}
          whileHover={{ color: 'rgba(255,255,255,0.65)' }}
          onClick={() => setPhase('la')}
        >
          the marathon continues
        </motion.p>
      </motion.div>

      {/* ── LA SCENE ────────────────────────────────────────────────── */}

      {/* LA — background */}
      <motion.div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 15,
          overflow: 'hidden',
          backgroundColor: '#000',
          pointerEvents: phase === 'la' ? 'auto' : 'none',
        }}
        animate={{ opacity: phase === 'la' ? 1 : 0 }}
        transition={{ opacity: { duration: 2.5, ease: [0.43, 0.13, 0.23, 0.96] } }}
      >
        <img
          src="/westwithlove.jpg"
          alt="West with love"
          style={styles.fullscreenImage}
        />
        <div style={styles.laPhotoGrade} />
        <div style={styles.vignetteLayer} />
      </motion.div>

      {/* LA — text overlay */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 25,
          pointerEvents: 'none',
        }}
        animate={{ opacity: phase === 'la' ? 1 : 0 }}
        transition={{ opacity: { duration: 1.5, delay: 0.8, ease: 'easeIn' } }}
      >
        <p style={{
          position: 'absolute',
          top: '1.5rem',
          left: '1.5rem',
          margin: 0,
          fontFamily: "'Inter', sans-serif",
          fontSize: '0.7rem',
          fontWeight: 300,
          letterSpacing: '0.35em',
          color: 'rgba(255,255,255,0.85)',
          textShadow: '0 1px 8px rgba(0,0,0,0.6)',
          userSelect: 'none',
        }}>
          THINKWRITE AI
        </p>

        <div style={{
          position: 'absolute',
          top: '22%',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          width: '90%',
        }}>
          <p style={{
            margin: 0,
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(1.1rem, 2vw, 1.7rem)',
            fontWeight: 300,
            fontStyle: 'italic',
            color: 'rgba(255,255,255,0.75)',
            letterSpacing: '0.04em',
            lineHeight: 1.8,
            textShadow: '0 0 30px rgba(0,0,0,0.98), 0 2px 12px rgba(0,0,0,0.98)',
            textAlign: 'center',
          }}>
            the most beautiful thoughts<br />
            are always inside the darkness
          </p>
        </div>

        <p style={{
          position: 'absolute',
          bottom: '1.5rem',
          right: '2rem',
          margin: 0,
          fontFamily: "'Cormorant Garamond', serif",
          fontStyle: 'italic',
          fontSize: 'clamp(1rem, 1.6vw, 1.4rem)',
          fontWeight: 300,
          color: 'rgba(255,255,255,0.75)',
          letterSpacing: '0.05em',
          textShadow: '0 0 20px rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,0.9)',
          userSelect: 'none',
        }}>
          See you, space writer...
        </p>
      </motion.div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed',
    inset: 0,
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: '#000',
    fontFamily: "'Inter', sans-serif",
    color: '#fff',
  },

  // ── Shared ──────────────────────────────────────────────────────────
  bg: {
    position: 'absolute',
    inset: 0,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    zIndex: 0,
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
    display: 'block',
    filter: 'contrast(1.06) saturate(1.04) brightness(0.94)',
    transform: 'scale(1.01)',
  },
  introFullscreenImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
    display: 'block',
    filter: 'contrast(1.06) saturate(1.04) brightness(0.94)',
  },
  introImageGrade: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(6,8,12,0.28) 0%, rgba(0,0,0,0.02) 38%, rgba(2,2,4,0.42) 100%)',
    mixBlendMode: 'multiply',
    pointerEvents: 'none',
  },
  introImageGlow: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at 50% 42%, rgba(212,196,165,0.16) 0%, rgba(212,196,165,0.05) 22%, rgba(0,0,0,0) 60%)',
    pointerEvents: 'none',
  },
  laPhotoGrade: {
    position: 'absolute',
    inset: 0,
    background: [
      'linear-gradient(180deg, rgba(8,10,16,0.16) 0%, rgba(10,10,14,0.06) 34%, rgba(4,5,8,0.28) 100%)',
      'radial-gradient(circle at 50% 24%, rgba(196,162,118,0.1) 0%, rgba(196,162,118,0.03) 18%, rgba(0,0,0,0) 54%)',
    ].join(','),
    mixBlendMode: 'soft-light',
    pointerEvents: 'none',
  },
  vignetteLayer: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at center, rgba(0,0,0,0) 34%, rgba(0,0,0,0.12) 62%, rgba(0,0,0,0.36) 100%)',
    pointerEvents: 'none',
  },
  headline: {
    margin: 0,
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 'clamp(2.4rem, 6vw, 5rem)',
    fontWeight: 300,
    letterSpacing: '0.02em',
    lineHeight: 1.1,
    color: '#fff',
    textShadow: '0 2px 24px rgba(0,0,0,0.7)',
  },
  sublines: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
  },

  // ── Stillness ───────────────────────────────────────────────────────
  wordmark: {
    position: 'fixed',
    top: '1.5rem',
    left: '1.5rem',
    zIndex: 2,
    margin: 0,
    fontFamily: "'Inter', sans-serif",
    fontSize: '0.7rem',
    fontWeight: 300,
    letterSpacing: '0.35em',
    color: 'rgba(255,255,255,0.85)',
    textShadow: '0 1px 8px rgba(0,0,0,0.6)',
    userSelect: 'none',
  },
  center: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    padding: '2rem',
  },
  textBlock: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.5rem',
  },
  subline: {
    margin: 0,
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 'clamp(1rem, 2.2vw, 1.5rem)',
    fontWeight: 300,
    letterSpacing: '0.08em',
    color: 'rgba(255,255,255,0.65)',
    textShadow: '0 1px 12px rgba(0,0,0,0.6)',
  },
  caption: {
    position: 'fixed',
    bottom: '1.5rem',
    right: '2rem',
    margin: 0,
    zIndex: 2,
    fontFamily: "'Cormorant Garamond', serif",
    fontStyle: 'italic',
    fontSize: 'clamp(1rem, 1.6vw, 1.4rem)',
    fontWeight: 300,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: '0.05em',
    textShadow: '0 1px 6px rgba(0,0,0,0.5)',
    userSelect: 'none',
  },

  // ── Chaos ───────────────────────────────────────────────────────────
  chaosTextOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chaosCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '0',
    padding: '0 2rem',
  },
  chaosOuter: {
    position: 'fixed',
    inset: 0,
    zIndex: 10,
    backgroundImage: "url('/chaos-bg.jpg')",
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundColor: '#0a0008',
  },
  chaosWordmark: {
    position: 'absolute',
    top: '1.5rem',
    left: '1.5rem',
    margin: 0,
    fontFamily: "'Inter', sans-serif",
    fontSize: '0.7rem',
    fontWeight: 300,
    letterSpacing: '0.35em',
    color: 'rgba(255,255,255,0.85)',
    textShadow: '0 1px 8px rgba(0,0,0,0.6)',
    userSelect: 'none',
  },
  chaosQuote: {
    margin: 0,
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 'clamp(1.1rem, 2vw, 1.7rem)',
    fontWeight: 300,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: '0.04em',
    textAlign: 'center',
    lineHeight: 1.8,
    textShadow: '0 0 30px rgba(0,0,0,0.98), 0 2px 12px rgba(0,0,0,0.98)',
  },
  chaosCaption: {
    position: 'absolute',
    bottom: '1.5rem',
    right: '2rem',
    margin: 0,
    fontFamily: "'Cormorant Garamond', serif",
    fontStyle: 'italic',
    fontSize: 'clamp(1rem, 1.6vw, 1.4rem)',
    fontWeight: 300,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: '0.05em',
    textShadow: '0 0 20px rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,0.9)',
    userSelect: 'none',
  },
}
