import WaitlistForm from './WaitlistForm.jsx'
import styles from './MonthInReview.module.css'

// Who appears on the sheet: one of PACK's own approved trip looks plus a cast of
// people in their own clothes. Entries with `video` play a short loop (filmed on
// white, cut out), the rest are still cutouts. Most stand in one day; `tall` ones
// take two.
// d = laptop box on the 7 x 4 calendar, m = phone box on the 3 x 8 sheet.
// a = where the figure stands across its box.
const LOOKS = [
  { src: 'mei', label: 'new york, a day out',           d: { c: 4, r: 1, a: 'center' }, m: { c: 1, r: 1 } },
  { src: 'tunde', video: true, label: 'london, dinner', d: { c: 7, r: 1, a: 'center' },     m: { c: 3, r: 1 } },
  { src: 'paris_0', video: true, tall: true, label: 'paris, day one',
    d: { c: 5, r: 2, a: 'center' }, m: { c: 1, r: 4 } },
  { src: 'sofia', video: true, tall: true, label: 'copenhagen, lunch',
    d: { c: 1, r: 3, a: 'center' }, m: { c: 3, r: 6 } },
  { src: 'kenji', label: 'lisbon, gallery day',         d: { c: 3, r: 3, a: 'center' },     m: { c: 2, r: 7 } },
  { src: 'margaret', label: 'kyoto, a slow morning',    d: { c: 2, r: 4, a: 'flex-end' },   m: { c: 1, r: 6 } },
  { src: 'layla', label: 'rome, old town',              d: { c: 4, r: 4, a: 'center' },     m: { c: 1, r: 8 } },
  { src: 'amara', video: true, label: 'amalfi, by the water', d: { c: 7, r: 4, a: 'center' }, m: { c: 3, r: 8 } },
]

// The pieces behind the Paris look, straight from that approved trip outfit.
// x / y / h (or w) place each cutout on the flat lay, in percent of the box.
const BREAKDOWN = {
  title: 'paris, day one',
  note: '5 pieces · 1.5 kg · all from one closet',
  pieces: [
    { src: 'cotton_dress', name: 'cotton dress', x: 4, y: 2, h: 72 },
    { src: 'daily_wear_bag', name: 'daily wear bag', x: 50, y: 0, h: 32 },
    { src: 'sunglasses', name: 'sunglasses', x: 52, y: 40, w: 34 },
    { src: 'leather_boots', name: 'leather boots', x: 38, y: 54, h: 34 },
    { src: 'hand_watch', name: 'hand watch', x: 78, y: 62, h: 22 },
  ],
}

// The text block and the flat lay, on each sheet
const AREAS = {
  intro: { d: { c: 1, r: 1, cs: 3, rs: 2 }, m: { c: 1, r: 2, cs: 3, rs: 2 } },
  breakdown: { d: { c: 6, r: 2, cs: 2, rs: 2 }, m: { c: 2, r: 4, cs: 2, rs: 2 } },
}

const GRID = { d: { cols: 7, rows: 4 }, m: { cols: 3, rows: 8 } }
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

// Boxes that read as one: text and the flat lay hide every date under them,
// a two-day figure keeps its first date.
const MERGED = [
  ...Object.values(AREAS).map((area) => ({ ...area, hideDates: true })),
  ...LOOKS.filter((look) => look.tall).map(({ d, m }) => ({ d: { ...d, cs: 1, rs: 2 }, m: { ...m, cs: 1, rs: 2 } })),
]

function areaAt(c, r, size) {
  return MERGED.find(({ [size]: a }) => c >= a.c && c < a.c + a.cs && r >= a.r && r < a.r + a.rs)
}

// Cells under one area merge into a single clean block: no crease between them
function edges({ c, r }, size) {
  const area = areaAt(c, r, size)
  return {
    covered: Boolean(area) && (area.hideDates || c !== area[size].c || r !== area[size].r),
    openRight: Boolean(area) && areaAt(c + 1, r, size) === area,
    openBottom: Boolean(area) && areaAt(c, r + 1, size) === area,
  }
}

function areaStyle({ d, m }) {
  return {
    '--c': d.c, '--r': d.r, '--cs': d.cs || 1, '--rs': d.rs || 1,
    '--mc': m.c, '--mr': m.r, '--mcs': m.cs || 1, '--mrs': m.rs || 1,
  }
}

// One fold-line cell per day, placed explicitly so rows can grow with the text
function Day({ i }) {
  const d = { c: (i % 7) + 1, r: Math.floor(i / 7) + 1 }
  const m = { c: (i % 3) + 1, r: Math.floor(i / 3) + 1 }
  const onPhone = m.r <= GRID.m.rows
  const de = edges(d, 'd')
  const me = edges(m, 'm')
  const classes = [
    styles.day,
    (d.c === GRID.d.cols || de.openRight) && styles.lastColD,
    (d.r === GRID.d.rows || de.openBottom) && styles.lastRowD,
    (m.c === GRID.m.cols || me.openRight) && styles.lastColM,
    (m.r === GRID.m.rows || me.openBottom) && styles.lastRowM,
    !onPhone && styles.laptopOnly,
    de.covered && styles.hideDateD,
    onPhone && me.covered && styles.hideDateM,
  ].filter(Boolean).join(' ')
  return <span className={classes} style={areaStyle({ d, m })}>{String(i + 1).padStart(2, '0')}</span>
}

export default function MonthInReview() {
  const month = new Date().toLocaleString('en', { month: 'long' }).toLowerCase()
  // People who ask for less motion get the still cutouts instead of the clips
  const stillOnly = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <section className={styles.sheet} aria-labelledby="month-in-review-title">
      <div className={styles.inner}>
        <header className={styles.top}>
          <span>// {month}, dressed</span>
          <span>a month in review</span>
        </header>

        <div className={styles.weekdays} aria-hidden="true">
          {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
        </div>

        <div className={styles.calendar}>
          {Array.from({ length: GRID.d.cols * GRID.d.rows }, (_, i) => <Day key={i} i={i} />)}

          <div className={styles.intro} style={areaStyle(AREAS.intro)}>
            <h1 id="month-in-review-title" className={styles.headline}>
              Every look this month, from clothes you already own.
            </h1>
            <p className={styles.body}>
              PACK learns your wardrobe once, then styles your days and packs your trips from it.
              You see each look on you before you get dressed.
            </p>
            <WaitlistForm variant="inline" />
          </div>

          {LOOKS.map((look, i) => {
            const moving = look.video && !stillOnly
            const d = { ...look.d, rs: look.tall ? 2 : 1 }
            const m = { ...look.m, rs: look.tall ? 2 : 1 }
            return (
              <figure
                key={look.src}
                className={[styles.look, moving && styles.clip].filter(Boolean).join(' ')}
                style={{ ...areaStyle({ d, m }), '--a': look.d.a, '--delay': `${i * -1.3}s` }}
              >
                <div className={styles.figure}>
                  {moving ? (
                    <video
                      src={`/landing/looks/${look.src}.mp4`}
                      poster={`/landing/looks/${look.src}.webp`}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      aria-label={`PACK look: ${look.label}`}
                    />
                  ) : (
                    <img src={`/landing/looks/${look.src}.webp`} alt={`PACK look: ${look.label}`} />
                  )}
                </div>
                <figcaption className={styles.caption}>( {i + 1} ) {look.label}</figcaption>
              </figure>
            )
          })}

          <figure className={styles.breakdown} style={areaStyle(AREAS.breakdown)}>
            <figcaption className={styles.breakdownTitle}>
              <span>// the pieces</span>
              <span>{BREAKDOWN.title}</span>
            </figcaption>
            <div className={styles.flatLay}>
              {BREAKDOWN.pieces.map((piece) => (
                <img
                  key={piece.src}
                  src={`/landing/items/${piece.src}.webp`}
                  alt={piece.name}
                  className={styles.piece}
                  style={{
                    '--x': `${piece.x}%`, '--y': `${piece.y}%`,
                    ...(piece.w ? { width: `${piece.w}%` } : { height: `${piece.h}%` }),
                  }}
                />
              ))}
            </div>
            <p className={styles.pieceList}>
              {BREAKDOWN.pieces.map((piece, i) => (
                <span key={piece.src}>( {String.fromCharCode(97 + i)} ) {piece.name}</span>
              ))}
            </p>
            <p className={styles.breakdownNote}>{BREAKDOWN.note}</p>
          </figure>
        </div>
      </div>
    </section>
  )
}
