import React, { useEffect, useState } from 'react'

// Hero headlines, shown one after another. `lead` is plain, `punch` gets the brand gradient.
const LINES = [
  { lead: 'Your FSSAI licence is', punch: 'simpler than you think.' },
  { lead: 'Turn FSSAI compliance into', punch: 'a 10-minute task.' },
  { lead: 'Focus on your recipes;', punch: "we'll handle your FSSAI licence." },
  { lead: 'FSSAI licensing doesn’t have to be a headache.', punch: 'We make it easy.' },
  { lead: 'Get your FSSAI licence', punch: 'without the paperwork maze.' },
  { lead: 'The fast track to your food licence:', punch: 'zero guesswork, zero hassle.' },
  { lead: 'Legal, compliant, stress-free:', punch: 'your FSSAI licence, sorted.' },
  { lead: 'Launch your food brand with full compliance,', punch: 'minus the red tape.' },
  { lead: 'Stop overcomplicating FSSAI.', punch: 'Start your food business faster.' },
]
const HOLD_MS = 4200

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * All lines sit stacked in one grid cell, so the block is as tall as the longest line and the page never jumps.
 * The active line builds up word by word; hovering pauses; the dots jump to a line. Reduced motion: first line only.
 */
export default function RotatingHeadline() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [still] = useState(reducedMotion)

  useEffect(() => {
    if (still || paused) return
    const t = setTimeout(() => setActive((i) => (i + 1) % LINES.length), HOLD_MS)
    return () => clearTimeout(t)
  }, [active, paused, still])

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <h1 className="sr-only">
        {LINES[0].lead} {LINES[0].punch}
      </h1>
      <p aria-hidden="true" className="mt-5 grid text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-[3.4rem]">
        {LINES.map((line, i) => (
          <span
            key={i}
            className={`[grid-area:1/1] transition-opacity duration-500 ${i === active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          >
            {/* Hidden lines use the same markup, so every line measures the same way and the block height is stable. */}
            <Words line={line} animate={!still && i === active} key={i === active ? `on-${active}` : 'off'} />
          </span>
        ))}
      </p>
      {!still && (
        <div className="mt-5 flex gap-1.5">
          {LINES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show headline ${i + 1}`}
              onClick={() => setActive(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? 'w-6 bg-violet-600' : 'w-1.5 bg-slate-300 hover:bg-violet-300'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Words({ line, animate }) {
  const words = [...line.lead.split(' ').map((w) => [w, false]), ...line.punch.split(' ').map((w) => [w, true])]
  return words.map(([w, punch], i) => (
    <React.Fragment key={i}>
      <span
        className={`inline-block ${animate ? 'headline-word' : ''} ${
          punch ? 'bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-500 bg-clip-text pb-1 text-transparent' : ''
        }`}
        style={animate ? { animationDelay: `${i * 70}ms` } : undefined}
      >
        {w}
      </span>{' '}
    </React.Fragment>
  ))
}
