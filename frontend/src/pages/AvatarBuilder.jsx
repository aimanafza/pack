import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/index.js'
import api from '../utils/api.js'
import styles from './AvatarBuilder.module.css'

const TOTAL_STEPS = 5

export default function AvatarBuilder() {
  const user = useStore((s) => s.user)
  const existingAvatar = user?.avatar

  // If avatar exists, show the update hub; otherwise run the 5-step build flow
  if (existingAvatar?.base_url) {
    return <UpdateAvatar avatar={existingAvatar} />
  }
  return <BuildAvatar />
}

// ─── Build flow (new avatar, 5 steps) ────────────────────────────────────────

function BuildAvatar({ defaultAppearance, defaultFitProfile, defaultPreferences, startAtStep = 1 }) {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(startAtStep)

  const [photoUrls, setPhotoUrls] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [confirmedAppearance, setConfirmedAppearance] = useState(defaultAppearance || null)
  const [fitProfile, setFitProfile] = useState(defaultFitProfile || null)
  const [avatarPreferences, setAvatarPreferences] = useState(defaultPreferences || null)

  function goBack() {
    if (currentStep > 1) setCurrentStep((s) => s - 1)
    else navigate('/profile/build-avatar')
  }

  function handleStep1Complete({ photo_urls, analysis: a }) {
    setPhotoUrls(photo_urls)
    setAnalysis(a)
    setCurrentStep(2)
  }

  function handleStep2Complete(appearance) {
    setConfirmedAppearance(appearance)
    setCurrentStep(3)
  }

  function handleStep3Complete(fit) {
    setFitProfile(fit)
    setCurrentStep(4)
  }

  function handleStep4Complete(prefs) {
    setAvatarPreferences(prefs)
    setCurrentStep(5)
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={goBack} type="button">← Back</button>
        <span className={styles.stepIndicator}>STEP {currentStep} OF {TOTAL_STEPS}</span>
        <div className={styles.topBarSpacer} />
      </div>
      <div className={styles.content}>
        {currentStep === 1 && <StepUpload onNext={handleStep1Complete} />}
        {currentStep === 2 && <StepConfirm analysis={analysis} defaultValues={confirmedAppearance} onNext={handleStep2Complete} />}
        {currentStep === 3 && <StepFitProfile defaultValues={fitProfile} onNext={handleStep3Complete} />}
        {currentStep === 4 && <StepPreferences analysis={analysis} defaultValues={avatarPreferences} onNext={handleStep4Complete} />}
        {currentStep === 5 && (
          <StepGenerate
            photoUrls={photoUrls}
            appearance={confirmedAppearance}
            fitProfile={fitProfile}
            preferences={avatarPreferences}
          />
        )}
      </div>
    </div>
  )
}

// ─── Update hub (existing avatar) ────────────────────────────────────────────

function UpdateAvatar({ avatar }) {
  const navigate = useNavigate()
  // mode: null | 'quick' | 'edit' | 'fresh'
  const [mode, setMode] = useState(null)

  if (mode === 'fresh') {
    return (
      <BuildAvatar
        defaultAppearance={avatar.appearance}
        defaultFitProfile={avatar.fit_profile}
        defaultPreferences={avatar.preferences}
        startAtStep={1}
      />
    )
  }

  if (mode === 'quick') {
    return <QuickRegenerate avatar={avatar} onBack={() => setMode(null)} />
  }

  if (mode === 'edit') {
    return <EditDetails avatar={avatar} onBack={() => setMode(null)} />
  }

  // Hub
  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate('/profile')} type="button">← Back</button>
        <span className={styles.stepIndicator}>UPDATE YOUR AVATAR</span>
        <div className={styles.topBarSpacer} />
      </div>
      <div className={styles.content}>
        <div className={styles.updateWrap}>
          <img src={avatar.base_url} alt="Your avatar" className={styles.updateAvatarImg} />

          <div className={styles.updateOptions}>
            {/* Quick regenerate */}
            <div className={styles.updateOption}>
              <div className={styles.updateOptionHeader}>
                <p className={styles.updateOptionTitle}>QUICK REGENERATE</p>
                <p className={styles.updateOptionDesc}>Keep everything the same, just try again</p>
              </div>
              <button className={styles.btnPrimary} onClick={() => setMode('quick')} type="button">
                Quick regenerate →
              </button>
            </div>

            {/* Edit details */}
            <div className={styles.updateOption}>
              <div className={styles.updateOptionHeader}>
                <p className={styles.updateOptionTitle}>EDIT DETAILS</p>
                <p className={styles.updateOptionDesc}>Change something specific</p>
              </div>
              <button className={styles.btnPrimary} onClick={() => setMode('edit')} type="button">
                Edit details →
              </button>
            </div>

            {/* Start fresh */}
            <div className={styles.updateOption}>
              <div className={styles.updateOptionHeader}>
                <p className={styles.updateOptionTitle}>START FRESH</p>
                <p className={styles.updateOptionDesc}>Rebuild from new photos</p>
                <p className={styles.updateOptionMeta}>Takes about 3 minutes</p>
              </div>
              <button className={styles.btnGhost} onClick={() => setMode('fresh')} type="button">
                Start full rebuild →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Quick Regenerate ─────────────────────────────────────────────────────────

function QuickRegenerate({ avatar, onBack }) {
  const navigate = useNavigate()
  const updateUser = useStore((s) => s.updateUser)
  const [feedback, setFeedback] = useState('')
  const [extraFiles, setExtraFiles] = useState([null, null, null])
  const [extraPreviews, setExtraPreviews] = useState([null, null, null])
  const extraRefs = [useRef(null), useRef(null), useRef(null)]
  const [generating, setGenerating] = useState(false)
  const [uploadingExtras, setUploadingExtras] = useState(false)
  const [error, setError] = useState('')
  const [variations, setVariations] = useState([])
  const [generationPrompt, setGenerationPrompt] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [showSatisfaction, setShowSatisfaction] = useState(false)
  const [saving, setSaving] = useState(false)

  function handleExtraFileChange(i, file) {
    if (!file) return
    const files = [...extraFiles]; files[i] = file
    const previews = [...extraPreviews]; previews[i] = URL.createObjectURL(file)
    setExtraFiles(files); setExtraPreviews(previews)
  }

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    let photoUrls = avatar.variation_urls?.length ? [] : []
    // Use the generation prompt as seed for previous_prompt, no new photo analysis
    // We'll just pass the saved appearance/fit/prefs and existing photo data

    // Upload any extra photos first
    if (extraFiles.some(Boolean)) {
      setUploadingExtras(true)
      try {
        const fd = new FormData()
        extraFiles.forEach((f, i) => { if (f) fd.append(`extra_${i}`, f) })
        const { data } = await api.post('/api/v1/users/me/avatar/upload-refs', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        photoUrls = data.data.photo_urls
      } catch { setError('Photo upload failed.'); setGenerating(false); setUploadingExtras(false); return }
      setUploadingExtras(false)
    }

    try {
      const { data } = await api.post('/api/v1/users/me/avatar/generate', {
        photo_urls: photoUrls,
        appearance: avatar.appearance,
        fit_profile: avatar.fit_profile,
        preferences: avatar.preferences,
        feedback: feedback.trim() || null,
        previous_prompt: avatar.generation_prompt || null,
      })
      setVariations(data.data.variation_urls)
      setGenerationPrompt(data.data.generation_prompt)
    } catch (err) {
      setError(err.response?.data?.detail || 'Generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (selectedIdx === null) return
    setSaving(true)
    try {
      const { data } = await api.patch('/api/v1/users/me/avatar/save', {
        chosen_url: variations[selectedIdx],
        variation_urls: variations,
        generation_prompt: generationPrompt,
        fit_profile: avatar.fit_profile,
        appearance: avatar.appearance,
        preferences: avatar.preferences,
      })
      updateUser({ avatar: { ...avatar, base_url: data.data.base_url } })
      navigate('/profile')
    } catch (err) {
      setError(err.response?.data?.detail || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  if (generating) return <LoadingScreen />

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack} type="button">← Back</button>
        <span className={styles.stepIndicator}>QUICK REGENERATE</span>
        <div className={styles.topBarSpacer} />
      </div>
      <div className={styles.content}>
        <div className={styles.stepWrap}>
          {variations.length === 0 ? (
            <>
              <h1 className={styles.heading}>Quick regenerate</h1>
              <p className={styles.subheading}>Keep everything the same, just try again. Optionally add new photos or feedback.</p>

              <div className={styles.prefSection}>
                <p className={styles.prefSectionLabel}>ADD NEW PHOTOS</p>
                <p className={styles.extraPhotosSubtext}>Optional. Close-up face shots work best.</p>
                <p className={styles.photoTips}>
                  Tips for better results:<br />
                  → Close-up face shot, looking directly at camera<br />
                  → No sunglasses, good even lighting<br />
                  → Multiple angles help — front, slight side
                </p>
                <div className={styles.uploadZonesRow}>
                  {[0, 1, 2].map((i) => (
                    <ExtraUploadZone key={i} label={`PHOTO ${i + 1}`} preview={extraPreviews[i]} inputRef={extraRefs[i]} onChange={(f) => handleExtraFileChange(i, f)} />
                  ))}
                </div>
              </div>

              <div className={styles.prefSection}>
                <p className={styles.prefSectionLabel}>FEEDBACK</p>
                <textarea
                  className={styles.feedbackTextarea}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Optional — e.g. 'make the hair darker', 'I look too stiff'"
                  rows={3}
                />
              </div>

              {error && <p className={styles.errorMsg}>{error}</p>}
              <div className={styles.btnRow}>
                <button className={styles.btnPrimary} onClick={handleGenerate} type="button" disabled={uploadingExtras}>
                  {uploadingExtras ? 'Uploading...' : 'Regenerate →'}
                </button>
                <button className={styles.cancelLink} onClick={() => navigate('/profile')} type="button">Cancel</button>
              </div>
            </>
          ) : (
            <>
              <h1 className={styles.heading}>Choose your avatar</h1>
              <p className={styles.subheading}>Select the one that looks most like you.</p>
              <div className={styles.variationsRow}>
                {variations.map((url, i) => (
                  <button key={url} type="button" className={`${styles.variationCard} ${selectedIdx === i ? styles.variationCardSelected : ''}`} onClick={() => { setSelectedIdx(i); setShowSatisfaction(true) }}>
                    <img src={url} alt={`Variation ${i + 1}`} className={styles.variationImg} />
                  </button>
                ))}
              </div>
              {showSatisfaction && (
                <div className={styles.satisfactionGate}>
                  <p className={styles.satisfactionQuestion}>Happy with this?</p>
                  <div className={styles.satisfactionActions}>
                    <button className={styles.btnPrimary} onClick={handleSave} type="button" disabled={saving}>{saving ? 'Saving...' : 'Yes, save my avatar'}</button>
                    <button className={styles.btnGhost} onClick={() => { setVariations([]); setSelectedIdx(null); setShowSatisfaction(false) }} type="button">Try again</button>
                  </div>
                </div>
              )}
              {error && <p className={styles.errorMsg}>{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Edit Details ─────────────────────────────────────────────────────────────

function EditDetails({ avatar, onBack }) {
  const navigate = useNavigate()
  const updateUser = useStore((s) => s.updateUser)
  const saved = avatar.appearance || {}
  const savedFit = avatar.fit_profile || {}
  const savedPrefs = avatar.preferences || {}

  // Appearance fields
  const [hairColor, setHairColor] = useState(saved.hair_color || '')
  const [hairStyle, setHairStyle] = useState([saved.hair_texture, saved.hair_length].filter(Boolean).join(', '))
  const [hijab, setHijab] = useState(saved.hijab || false)

  // Fit profile
  const [fit, setFit] = useState({
    shirt_size: savedFit.shirt_size || '',
    waist_size: savedFit.waist_size || '',
    dress_size: savedFit.dress_size || '',
    height: savedFit.height || '',
    inseam: savedFit.inseam || '',
  })

  // Vibe + makeup
  const [vibe, setVibe] = useState(savedPrefs.vibe || '')
  const [makeup, setMakeup] = useState(savedPrefs.makeup || '')

  // Features
  const [glasses, setGlasses] = useState((savedPrefs.features_to_preserve || []).includes('glasses'))
  const [tattoos, setTattoos] = useState((savedPrefs.features_to_preserve || []).includes('tattoos'))
  const [piercings, setPiercings] = useState((savedPrefs.features_to_preserve || []).includes('piercings'))

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [variations, setVariations] = useState([])
  const [generationPrompt, setGenerationPrompt] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [showSatisfaction, setShowSatisfaction] = useState(false)
  const [saving, setSaving] = useState(false)

  function toggleFit(field, value) {
    setFit((p) => ({ ...p, [field]: p[field] === value ? '' : value }))
  }

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    const featuresPreserve = []
    if (glasses) featuresPreserve.push('glasses')
    if (tattoos) featuresPreserve.push('tattoos')
    if (piercings) featuresPreserve.push('piercings')

    const hairParts = hairStyle.split(',').map((s) => s.trim())
    const newAppearance = {
      ...saved,
      hair_color: hairColor,
      hair_texture: hairParts[0] || saved.hair_texture || '',
      hair_length: hairParts[1] || saved.hair_length || '',
      hijab,
    }
    const newPreferences = { ...savedPrefs, vibe, makeup, features_to_preserve: featuresPreserve }

    try {
      const { data } = await api.post('/api/v1/users/me/avatar/generate', {
        photo_urls: [],
        appearance: newAppearance,
        fit_profile: fit,
        preferences: newPreferences,
        feedback: null,
        previous_prompt: avatar.generation_prompt || null,
      })
      setVariations(data.data.variation_urls)
      setGenerationPrompt(data.data.generation_prompt)
    } catch (err) {
      setError(err.response?.data?.detail || 'Generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (selectedIdx === null) return
    setSaving(true)
    const featuresPreserve = []
    if (glasses) featuresPreserve.push('glasses')
    if (tattoos) featuresPreserve.push('tattoos')
    if (piercings) featuresPreserve.push('piercings')
    const hairParts = hairStyle.split(',').map((s) => s.trim())
    const newAppearance = { ...saved, hair_color: hairColor, hair_texture: hairParts[0] || '', hair_length: hairParts[1] || '', hijab }
    const newPreferences = { ...savedPrefs, vibe, makeup, features_to_preserve: featuresPreserve }

    try {
      const { data } = await api.patch('/api/v1/users/me/avatar/save', {
        chosen_url: variations[selectedIdx],
        variation_urls: variations,
        generation_prompt: generationPrompt,
        fit_profile: fit,
        appearance: newAppearance,
        preferences: newPreferences,
      })
      updateUser({ avatar: { ...avatar, base_url: data.data.base_url } })
      navigate('/profile')
    } catch (err) {
      setError(err.response?.data?.detail || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  if (generating) return <LoadingScreen />

  if (variations.length > 0) {
    return (
      <div className={styles.page}>
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => setVariations([])} type="button">← Back</button>
          <span className={styles.stepIndicator}>CHOOSE YOUR AVATAR</span>
          <div className={styles.topBarSpacer} />
        </div>
        <div className={styles.content}>
          <div className={styles.stepWrap}>
            <h1 className={styles.heading}>Choose your avatar</h1>
            <p className={styles.subheading}>Select the one that looks most like you.</p>
            <div className={styles.variationsRow}>
              {variations.map((url, i) => (
                <button key={url} type="button" className={`${styles.variationCard} ${selectedIdx === i ? styles.variationCardSelected : ''}`} onClick={() => { setSelectedIdx(i); setShowSatisfaction(true) }}>
                  <img src={url} alt={`Variation ${i + 1}`} className={styles.variationImg} />
                </button>
              ))}
            </div>
            {showSatisfaction && (
              <div className={styles.satisfactionGate}>
                <p className={styles.satisfactionQuestion}>Happy with this?</p>
                <div className={styles.satisfactionActions}>
                  <button className={styles.btnPrimary} onClick={handleSave} type="button" disabled={saving}>{saving ? 'Saving...' : 'Yes, save my avatar'}</button>
                  <button className={styles.btnGhost} onClick={() => { setVariations([]); setSelectedIdx(null); setShowSatisfaction(false) }} type="button">Try again</button>
                </div>
              </div>
            )}
            {error && <p className={styles.errorMsg}>{error}</p>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack} type="button">← Back</button>
        <span className={styles.stepIndicator}>EDIT DETAILS</span>
        <div className={styles.topBarSpacer} />
      </div>
      <div className={styles.content}>
        <div className={styles.stepWrap}>
          <h1 className={styles.heading}>Edit your details</h1>
          <p className={styles.subheading}>Change something specific and regenerate.</p>

          {/* Hair */}
          <div className={styles.prefSection}>
            <p className={styles.prefSectionLabel}>HAIR</p>
            <div className={styles.prefFieldRow}>
              <div className={styles.prefField}>
                <label className={styles.prefFieldLabel}>Hair color</label>
                <input className={styles.prefInput} value={hairColor} onChange={(e) => setHairColor(e.target.value)} placeholder="e.g. dark brown" />
              </div>
              <div className={styles.prefField}>
                <label className={styles.prefFieldLabel}>Hair style</label>
                <input className={styles.prefInput} value={hairStyle} onChange={(e) => setHairStyle(e.target.value)} placeholder="e.g. wavy, shoulder-length" />
              </div>
            </div>
            <label className={styles.toggleRow}>
              <span className={styles.toggleLabel}>Head covering</span>
              <button type="button" className={`${styles.toggleBtn} ${hijab ? styles.toggleBtnOn : ''}`} onClick={() => setHijab((v) => !v)} aria-pressed={hijab}>
                <span className={styles.toggleKnob} />
              </button>
            </label>
          </div>

          {/* Fit profile */}
          <div className={styles.prefSection}>
            <p className={styles.prefSectionLabel}>FIT PROFILE</p>
            <div className={styles.fitSections}>
              {Object.entries(FIT_OPTIONS).map(([field, options]) => (
                <div key={field} className={styles.fitSection}>
                  <p className={styles.fitSectionLabel}>{FIT_LABELS[field]}</p>
                  <div className={styles.pillGroup}>
                    {options.map((opt) => (
                      <button key={opt} type="button" className={`${styles.pill} ${fit[field] === opt ? styles.pillActive : ''}`} onClick={() => toggleFit(field, opt)}>{opt}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vibe */}
          <div className={styles.prefSection}>
            <p className={styles.prefSectionLabel}>AVATAR VIBE</p>
            <div className={styles.vibeOptions}>
              {VIBE_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" className={`${styles.vibeOption} ${vibe === opt.value ? styles.vibeOptionActive : ''}`} onClick={() => setVibe(opt.value)}>
                  <span className={styles.vibeOptionLabel}>{opt.label}</span>
                  <span className={styles.vibeOptionDesc}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Makeup */}
          <div className={styles.prefSection}>
            <p className={styles.prefSectionLabel}>MAKEUP</p>
            <div className={styles.pillGroup}>
              {MAKEUP_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" className={`${styles.pill} ${makeup === opt.value ? styles.pillActive : ''}`} onClick={() => setMakeup(makeup === opt.value ? '' : opt.value)}>{opt.label}</button>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className={styles.prefSection}>
            <p className={styles.prefSectionLabel}>FEATURES TO PRESERVE</p>
            <div className={styles.checkboxGroup}>
              <label className={styles.checkboxRow}><input type="checkbox" checked={glasses} onChange={(e) => setGlasses(e.target.checked)} className={styles.checkbox} /><span className={styles.checkboxLabel}>Glasses</span></label>
              <label className={styles.checkboxRow}><input type="checkbox" checked={tattoos} onChange={(e) => setTattoos(e.target.checked)} className={styles.checkbox} /><span className={styles.checkboxLabel}>Visible tattoos</span></label>
              <label className={styles.checkboxRow}><input type="checkbox" checked={piercings} onChange={(e) => setPiercings(e.target.checked)} className={styles.checkbox} /><span className={styles.checkboxLabel}>Piercings</span></label>
            </div>
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}
          <div className={styles.btnRow}>
            <button className={styles.btnPrimary} onClick={handleGenerate} type="button" disabled={!vibe}>
              Regenerate with changes →
            </button>
            <button className={styles.cancelLink} onClick={() => navigate('/profile')} type="button">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Step 1: Photo Upload ─────────────────────────────────────────────────────

function UploadZone({ label, hint, preview, inputRef, onChange }) {
  return (
    <div className={styles.uploadZoneWrap}>
      <div
        className={`${styles.uploadZone} ${preview ? styles.uploadZoneHasImage : ''}`}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        aria-label={`Upload ${label} photo`}
      >
        {preview ? (
          <img src={preview} alt={label} className={styles.uploadZonePreview} />
        ) : (
          <span className={styles.uploadZonePlaceholder}>+</span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className={styles.hiddenInput}
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
      </div>
      <span className={styles.uploadZoneLabel}>{label}</span>
      <span className={styles.uploadZoneHint}>{hint}</span>
    </div>
  )
}

function StepUpload({ onNext }) {
  const [photos, setPhotos] = useState({ front: null, angle: null, side: null })
  const [previews, setPreviews] = useState({ front: null, angle: null, side: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const frontRef = useRef(null)
  const angleRef = useRef(null)
  const sideRef = useRef(null)

  function handleFileChange(slot, file) {
    if (!file) return
    setPhotos((p) => ({ ...p, [slot]: file }))
    setPreviews((p) => ({ ...p, [slot]: URL.createObjectURL(file) }))
  }

  async function handleAnalyse() {
    if (!photos.front) return
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('front', photos.front)
      if (photos.angle) fd.append('angle', photos.angle)
      if (photos.side) fd.append('side', photos.side)

      const { data } = await api.post('/api/v1/users/me/avatar/analyse', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onNext(data.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Analysis failed. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.stepWrap}>
      <h1 className={styles.heading}>Let's build your avatar</h1>
      <p className={styles.subheading}>Upload 1–3 photos. Front-facing, good lighting.</p>

      <div className={styles.uploadZonesRow}>
        <UploadZone label="FRONT" hint="Required" preview={previews.front} inputRef={frontRef} onChange={(f) => handleFileChange('front', f)} />
        <UploadZone label="3/4 ANGLE" hint="Optional" preview={previews.angle} inputRef={angleRef} onChange={(f) => handleFileChange('angle', f)} />
        <UploadZone label="SIDE" hint="Optional" preview={previews.side} inputRef={sideRef} onChange={(f) => handleFileChange('side', f)} />
      </div>

      {error && <p className={styles.errorMsg}>{error}</p>}

      <button className={styles.btnPrimary} onClick={handleAnalyse} type="button" disabled={!photos.front || loading}>
        {loading ? 'Analysing...' : 'Analyse my photos →'}
      </button>
    </div>
  )
}

// ─── Step 2: Confirm appearance ───────────────────────────────────────────────

const CONFIRM_CARDS = [
  { key: 'hair', label: 'HAIR', getValue: (a) => [a.hair_color, a.hair_texture, a.hair_length].filter(Boolean).join(', ') },
  { key: 'skin_tone', label: 'SKIN TONE', getValue: (a) => a.skin_tone },
  { key: 'body_silhouette', label: 'BODY SILHOUETTE', getValue: (a) => a.body_silhouette },
  { key: 'face_shape', label: 'FACE SHAPE', getValue: (a) => a.face_shape },
  { key: 'notable_features', label: 'NOTABLE FEATURES', getValue: (a) => a.notable_features },
]

function ConfirmCard({ label, value, confirmed, onConfirm, onEdit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function handleSave() {
    if (draft.trim()) {
      onEdit(draft.trim())
      setEditing(false)
    }
  }

  return (
    <div className={`${styles.confirmCard} ${confirmed ? styles.confirmCardDone : ''}`}>
      <p className={styles.confirmCardLabel}>{label}</p>
      {editing ? (
        <div className={styles.confirmCardEditRow}>
          <input className={styles.confirmCardInput} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSave()} autoFocus />
          <button className={styles.confirmCardSave} onClick={handleSave} type="button">Save</button>
        </div>
      ) : (
        <p className={styles.confirmCardValue}>{value}</p>
      )}
      {!confirmed && !editing && (
        <div className={styles.confirmCardActions}>
          <button className={styles.confirmCardBtnConfirm} onClick={onConfirm} type="button">Looks right ✓</button>
          <button className={styles.confirmCardBtnEdit} onClick={() => { setDraft(value); setEditing(true) }} type="button">Edit</button>
        </div>
      )}
      {confirmed && <p className={styles.confirmCardCheck}>✓ confirmed</p>}
    </div>
  )
}

function StepConfirm({ analysis, onNext }) {
  const initialValues = CONFIRM_CARDS.reduce((acc, card) => {
    acc[card.key] = analysis ? card.getValue(analysis) : ''
    return acc
  }, {})

  const [values, setValues] = useState(initialValues)
  const [confirmed, setConfirmed] = useState({})
  const allConfirmed = CONFIRM_CARDS.every((c) => confirmed[c.key])

  function handleEdit(key, newVal) {
    setValues((p) => ({ ...p, [key]: newVal }))
    setConfirmed((p) => ({ ...p, [key]: false }))
  }

  function handleContinue() {
    const hairParts = (values.hair || '').split(',').map((s) => s.trim())
    onNext({
      hair_color: hairParts[0] || '',
      hair_texture: hairParts[1] || '',
      hair_length: hairParts[2] || '',
      skin_tone: values.skin_tone || '',
      face_shape: values.face_shape || '',
      body_silhouette: values.body_silhouette || '',
      notable_features: values.notable_features || '',
      hijab: false,
    })
  }

  return (
    <div className={styles.stepWrap}>
      <h1 className={styles.heading}>Is this you?</h1>
      <p className={styles.subheading}>Confirm or adjust before we build your avatar.</p>
      <div className={styles.confirmCardsGrid}>
        {CONFIRM_CARDS.map((card) => (
          <ConfirmCard
            key={card.key}
            label={card.label}
            value={values[card.key] || ''}
            confirmed={!!confirmed[card.key]}
            onConfirm={() => setConfirmed((p) => ({ ...p, [card.key]: true }))}
            onEdit={(v) => handleEdit(card.key, v)}
          />
        ))}
      </div>
      <button className={styles.btnPrimary} onClick={handleContinue} type="button" disabled={!allConfirmed}>
        Continue →
      </button>
    </div>
  )
}

// ─── Step 3: Fit Profile ──────────────────────────────────────────────────────

const FIT_OPTIONS = {
  shirt_size: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  waist_size: ['24', '26', '28', '30', '32', '34', '36+'],
  dress_size: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  height: ["Under 5'2", "5'2–5'5", "5'5–5'8", "5'8–5'11", "6'+"],
  inseam: ['Short', 'Regular', 'Long'],
}
const FIT_LABELS = { shirt_size: 'SHIRT SIZE', waist_size: 'TROUSER WAIST', dress_size: 'DRESS SIZE', height: 'HEIGHT', inseam: 'INSEAM' }

function StepFitProfile({ onNext }) {
  const [fit, setFit] = useState({ shirt_size: '', waist_size: '', dress_size: '', height: '', inseam: '' })
  function toggle(field, value) {
    setFit((p) => ({ ...p, [field]: p[field] === value ? '' : value }))
  }
  return (
    <div className={styles.stepWrap}>
      <h1 className={styles.heading}>Your fit profile</h1>
      <p className={styles.subheading}>Helps us get proportions right — like a tailor would.</p>
      <div className={styles.fitSections}>
        {Object.entries(FIT_OPTIONS).map(([field, options]) => (
          <div key={field} className={styles.fitSection}>
            <p className={styles.fitSectionLabel}>{FIT_LABELS[field]}</p>
            <div className={styles.pillGroup}>
              {options.map((opt) => (
                <button key={opt} type="button" className={`${styles.pill} ${fit[field] === opt ? styles.pillActive : ''}`} onClick={() => toggle(field, opt)}>{opt}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button className={styles.btnPrimary} onClick={() => onNext(fit)} type="button">Continue →</button>
    </div>
  )
}

// ─── Step 4: Avatar Preferences ──────────────────────────────────────────────

const VIBE_OPTIONS = [
  { value: 'realistic', label: 'REALISTIC', desc: 'Looks exactly like my photos' },
  { value: 'polished', label: 'POLISHED', desc: 'Still me, slightly editorial' },
  { value: 'idealized', label: 'IDEALIZED', desc: 'My best self, fashion week ready' },
]
const MAKEUP_OPTIONS = [
  { value: 'no_makeup', label: 'No makeup / natural' },
  { value: 'everyday', label: 'Everyday makeup — light, subtle' },
  { value: 'full_glam', label: 'Full glam — editorial, bold' },
  { value: 'match_photos', label: 'Match my photos' },
]

function StepPreferences({ analysis, onNext }) {
  const [hairColor, setHairColor] = useState(analysis?.hair_color || '')
  const [hairStyle, setHairStyle] = useState([analysis?.hair_texture, analysis?.hair_length].filter(Boolean).join(', '))
  const [hijab, setHijab] = useState(false)
  const [glasses, setGlasses] = useState(false)
  const [tattoos, setTattoos] = useState(false)
  const [tattooDescription, setTattooDescription] = useState('')
  const [piercings, setPiercings] = useState(false)
  const [otherFeatures, setOtherFeatures] = useState('')
  const [vibe, setVibe] = useState('')
  const [makeup, setMakeup] = useState('')

  function handleBuild() {
    const featuresPreserve = []
    if (glasses) featuresPreserve.push('glasses')
    if (tattoos) featuresPreserve.push('tattoos')
    if (piercings) featuresPreserve.push('piercings')
    if (otherFeatures.trim()) featuresPreserve.push(otherFeatures.trim())
    onNext({ hair_color_override: hairColor, hair_style_override: hairStyle, hijab, glasses, tattoos, tattoo_description: tattooDescription, piercings, other_features: otherFeatures, features_to_preserve: featuresPreserve, vibe, makeup })
  }

  return (
    <div className={styles.stepWrap}>
      <h1 className={styles.heading}>Customise your avatar</h1>
      <p className={styles.subheading}>Your avatar is realistic — but it's your ideal.</p>

      <div className={styles.prefSection}>
        <p className={styles.prefSectionLabel}>HAIR</p>
        <div className={styles.prefFieldRow}>
          <div className={styles.prefField}>
            <label className={styles.prefFieldLabel}>Hair color</label>
            <input className={styles.prefInput} value={hairColor} onChange={(e) => setHairColor(e.target.value)} placeholder="e.g. dark brown" />
          </div>
          <div className={styles.prefField}>
            <label className={styles.prefFieldLabel}>Hair style</label>
            <input className={styles.prefInput} value={hairStyle} onChange={(e) => setHairStyle(e.target.value)} placeholder="e.g. wavy, shoulder-length" />
          </div>
        </div>
        <label className={styles.toggleRow}>
          <span className={styles.toggleLabel}>I wear hijab</span>
          <button type="button" className={`${styles.toggleBtn} ${hijab ? styles.toggleBtnOn : ''}`} onClick={() => setHijab((v) => !v)} aria-pressed={hijab}>
            <span className={styles.toggleKnob} />
          </button>
        </label>
      </div>

      <div className={styles.prefSection}>
        <p className={styles.prefSectionLabel}>FEATURES TO PRESERVE</p>
        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxRow}><input type="checkbox" checked={glasses} onChange={(e) => setGlasses(e.target.checked)} className={styles.checkbox} /><span className={styles.checkboxLabel}>Glasses</span></label>
          <label className={styles.checkboxRow}><input type="checkbox" checked={tattoos} onChange={(e) => setTattoos(e.target.checked)} className={styles.checkbox} /><span className={styles.checkboxLabel}>Visible tattoos</span></label>
          {tattoos && <input className={styles.prefInput} value={tattooDescription} onChange={(e) => setTattooDescription(e.target.value)} placeholder="Describe your tattoos" />}
          <label className={styles.checkboxRow}><input type="checkbox" checked={piercings} onChange={(e) => setPiercings(e.target.checked)} className={styles.checkbox} /><span className={styles.checkboxLabel}>Piercings</span></label>
        </div>
        <input className={styles.prefInput} value={otherFeatures} onChange={(e) => setOtherFeatures(e.target.value)} placeholder="Other: anything else to preserve" />
      </div>

      <div className={styles.prefSection}>
        <p className={styles.prefSectionLabel}>AVATAR VIBE</p>
        <div className={styles.vibeOptions}>
          {VIBE_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" className={`${styles.vibeOption} ${vibe === opt.value ? styles.vibeOptionActive : ''}`} onClick={() => setVibe(opt.value)}>
              <span className={styles.vibeOptionLabel}>{opt.label}</span>
              <span className={styles.vibeOptionDesc}>{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.prefSection}>
        <p className={styles.prefSectionLabel}>MAKEUP</p>
        <div className={styles.pillGroup}>
          {MAKEUP_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" className={`${styles.pill} ${makeup === opt.value ? styles.pillActive : ''}`} onClick={() => setMakeup(makeup === opt.value ? '' : opt.value)}>{opt.label}</button>
          ))}
        </div>
      </div>

      <button className={styles.btnPrimary} onClick={handleBuild} type="button" disabled={!vibe}>
        Build my avatar →
      </button>
    </div>
  )
}

// ─── Step 5: Generation + selection ──────────────────────────────────────────

const LOADING_LINES = [
  'Studying your features...',
  'Calibrating proportions...',
  'Styling your base look...',
  'Almost ready...',
]

function LoadingScreen() {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx((i) => (i + 1) % LOADING_LINES.length)
        setVisible(true)
      }, 400)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className={styles.loadingScreen}>
      <p className={`${styles.loadingText} ${visible ? styles.loadingTextVisible : styles.loadingTextHidden}`}>
        {LOADING_LINES[idx]}
      </p>
    </div>
  )
}

// Small reusable upload zone for the extra photo slots
function ExtraUploadZone({ label, preview, inputRef, onChange }) {
  return (
    <div className={styles.uploadZoneWrap}>
      <div
        className={`${styles.uploadZone} ${preview ? styles.uploadZoneHasImage : ''}`}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        aria-label={`Upload extra photo ${label}`}
      >
        {preview
          ? <img src={preview} alt={label} className={styles.uploadZonePreview} />
          : <span className={styles.uploadZonePlaceholder}>+</span>
        }
        <input ref={inputRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={(e) => onChange(e.target.files?.[0] || null)} />
      </div>
      <span className={styles.uploadZoneLabel}>{label}</span>
    </div>
  )
}

function StepGenerate({ photoUrls, appearance, fitProfile, preferences }) {
  const navigate = useNavigate()
  const updateUser = useStore((s) => s.updateUser)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [variations, setVariations] = useState([])
  const [generationPrompt, setGenerationPrompt] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(null)

  // Active photo URLs — starts as original, may grow with extra uploads
  const [activePhotoUrls, setActivePhotoUrls] = useState(photoUrls)

  // Regenerate flow mode: null | 'feedback' | 'doesnt_look_like_me'
  const [regenMode, setRegenMode] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [previousPrompt, setPreviousPrompt] = useState('')

  // Extra photo uploads
  const [extraFiles, setExtraFiles] = useState([null, null, null])
  const [extraPreviews, setExtraPreviews] = useState([null, null, null])
  const [uploadingExtras, setUploadingExtras] = useState(false)
  const extraRefs = [useRef(null), useRef(null), useRef(null)]

  // Satisfaction gate
  const [showSatisfaction, setShowSatisfaction] = useState(false)
  const [saving, setSaving] = useState(false)

  // Auto-generate on mount
  useEffect(() => {
    generate(photoUrls, null, null)
  }, [])

  async function generate(urls, feedbackText, prevPrompt) {
    setLoading(true)
    setError('')
    setVariations([])
    setSelectedIdx(null)
    setShowSatisfaction(false)
    setRegenMode(null)

    try {
      const { data } = await api.post('/api/v1/users/me/avatar/generate', {
        photo_urls: urls,
        appearance,
        fit_profile: fitProfile,
        preferences,
        feedback: feedbackText || null,
        previous_prompt: prevPrompt || null,
      })
      setVariations(data.data.variation_urls)
      setGenerationPrompt(data.data.generation_prompt)
      setPreviousPrompt(data.data.generation_prompt)
    } catch (err) {
      setError(err.response?.data?.detail || 'Generation failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleSelectVariation(i) {
    setSelectedIdx(i)
    setShowSatisfaction(true)
    setRegenMode(null)
  }

  function handleExtraFileChange(i, file) {
    if (!file) return
    const files = [...extraFiles]
    const previews = [...extraPreviews]
    files[i] = file
    previews[i] = URL.createObjectURL(file)
    setExtraFiles(files)
    setExtraPreviews(previews)
  }

  async function handleSubmitRegen() {
    let combinedUrls = activePhotoUrls

    // Upload any extra photos first
    const hasExtras = extraFiles.some(Boolean)
    if (hasExtras) {
      setUploadingExtras(true)
      try {
        const fd = new FormData()
        extraFiles.forEach((file, i) => { if (file) fd.append(`extra_${i}`, file) })
        const { data } = await api.post('/api/v1/users/me/avatar/upload-refs', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        combinedUrls = [...activePhotoUrls, ...data.data.photo_urls].slice(0, 6)
        setActivePhotoUrls(combinedUrls)
        // Clear extra slots
        setExtraFiles([null, null, null])
        setExtraPreviews([null, null, null])
      } catch {
        setError('Failed to upload photos. Try again.')
        setUploadingExtras(false)
        return
      }
      setUploadingExtras(false)
    }

    await generate(combinedUrls, feedback.trim() || null, previousPrompt)
  }

  async function handleSave() {
    if (selectedIdx === null) return
    setSaving(true)
    try {
      const { data } = await api.patch('/api/v1/users/me/avatar/save', {
        chosen_url: variations[selectedIdx],
        variation_urls: variations,
        generation_prompt: generationPrompt,
        fit_profile: fitProfile,
        appearance,
        preferences,
      })
      updateUser({ avatar: { base_url: data.data.base_url } })
      navigate('/profile')
    } catch (err) {
      setError(err.response?.data?.detail || 'Save failed. Try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingScreen />

  if (error && variations.length === 0) {
    return (
      <div className={styles.stepWrap}>
        <h1 className={styles.heading}>Something went wrong</h1>
        <p className={styles.errorMsg}>{error}</p>
        <button className={styles.btnPrimary} onClick={() => generate(activePhotoUrls, null, null)} type="button">Try again</button>
      </div>
    )
  }

  const canSubmitRegen = regenMode === 'doesnt_look_like_me'
    ? extraFiles.some(Boolean) || feedback.trim()
    : feedback.trim()

  return (
    <div className={styles.stepWrap}>
      <h1 className={styles.heading}>Choose your avatar</h1>
      <p className={styles.subheading}>Select the one that looks most like you.</p>

      <div className={styles.variationsRow}>
        {variations.map((url, i) => (
          <button
            key={url}
            type="button"
            className={`${styles.variationCard} ${selectedIdx === i ? styles.variationCardSelected : ''}`}
            onClick={() => handleSelectVariation(i)}
          >
            <img src={url} alt={`Avatar variation ${i + 1}`} className={styles.variationImg} />
          </button>
        ))}
      </div>

      {/* Satisfaction gate */}
      {showSatisfaction && !regenMode && (
        <div className={styles.satisfactionGate}>
          <p className={styles.satisfactionQuestion}>Happy with this?</p>
          <div className={styles.satisfactionActions}>
            <button className={styles.btnPrimary} onClick={handleSave} type="button" disabled={saving}>
              {saving ? 'Saving...' : 'Yes, save my avatar'}
            </button>
            <button className={styles.btnGhost} onClick={() => { setRegenMode('feedback'); setShowSatisfaction(false); setFeedback('') }} type="button">
              Make one more change
            </button>
          </div>
        </div>
      )}

      {/* Regenerate panel */}
      {regenMode && (
        <div className={styles.feedbackWrap}>

          {/* Mode switcher */}
          <div className={styles.regenModeRow}>
            <button
              type="button"
              className={`${styles.regenModeBtn} ${regenMode === 'feedback' ? styles.regenModeBtnActive : ''}`}
              onClick={() => setRegenMode('feedback')}
            >
              Make a change
            </button>
            <button
              type="button"
              className={`${styles.regenModeBtn} ${regenMode === 'doesnt_look_like_me' ? styles.regenModeBtnActive : ''}`}
              onClick={() => setRegenMode('doesnt_look_like_me')}
            >
              This doesn't look like me
            </button>
          </div>

          {/* Extra photo upload section — visible in doesnt_look_like_me mode */}
          {regenMode === 'doesnt_look_like_me' && (
            <div className={styles.extraPhotosSection}>
              <p className={styles.feedbackLabel}>Upload clearer photos to help</p>
              <p className={styles.extraPhotosSubtext}>Close-up face shots work best. Look directly at the camera, good lighting.</p>
              <p className={styles.photoTips}>
                Tips for better results:<br />
                → Close-up face shot, looking directly at camera<br />
                → No sunglasses, good even lighting<br />
                → Multiple angles help — front, slight side
              </p>
              <div className={styles.uploadZonesRow}>
                {[0, 1, 2].map((i) => (
                  <ExtraUploadZone
                    key={i}
                    label={`PHOTO ${i + 1}`}
                    preview={extraPreviews[i]}
                    inputRef={extraRefs[i]}
                    onChange={(f) => handleExtraFileChange(i, f)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Feedback textarea — always shown in regen panel */}
          <p className={styles.feedbackLabel}>
            {regenMode === 'doesnt_look_like_me' ? 'Anything else to adjust?' : 'What should we change?'}
          </p>
          <textarea
            className={styles.feedbackTextarea}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={regenMode === 'doesnt_look_like_me'
              ? "e.g. 'make the hair darker and curlier', 'my nose is more prominent'"
              : "e.g. 'apply some everyday makeup so I don't look washed out', 'make my hair look curlier', 'I look too stiff'"
            }
            rows={3}
          />

          <button
            className={styles.btnPrimary}
            onClick={handleSubmitRegen}
            type="button"
            disabled={!canSubmitRegen || uploadingExtras}
          >
            {uploadingExtras ? 'Uploading photos...' : 'Regenerate →'}
          </button>
        </div>
      )}

      {/* Initial regenerate prompt — no panel open, no satisfaction gate */}
      {!showSatisfaction && !regenMode && variations.length > 0 && (
        <div className={styles.regenPromptRow}>
          <button className={styles.btnGhost} onClick={() => { setRegenMode('feedback'); setFeedback('') }} type="button">
            Make a change →
          </button>
          <button className={styles.btnGhost} onClick={() => { setRegenMode('doesnt_look_like_me'); setFeedback('') }} type="button">
            This doesn't look like me →
          </button>
        </div>
      )}

      {error && <p className={styles.errorMsg}>{error}</p>}
    </div>
  )
}
