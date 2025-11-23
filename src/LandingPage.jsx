import { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "./supabaseClient"

const TABS = [
  { id: "sessions", label: "Sessions" },
  { id: "interventions", label: "Interventions" },
  { id: "planner", label: "Plan Event" },
  { id: "profile", label: "Update Profile" },
]

const INTERVENTION_FORM_DEFAULT = {
  name: "",
  category: "",
  description: "",
}

const SESSION_FORM_DEFAULT = {
  session_name: "",
  stressor_type: "",
  session_date: "",
  duration: "",
  notes: "",
}

const SESSION_METRICS_DEFAULT = {
  sessionId: "",
  session_hr: "",
  session_bp_systolic: "",
  session_bp_diastolic: "",
  score: "",
}

const PROFILE_FORM_DEFAULT = {
  name: "",
  age: "",
  sex: "",
  baseline_hr: "",
  baseline_bp_systolic: "",
  baseline_bp_diastolic: "",
}

export default function LandingPage({ session }) {
  const userId = session?.user?.id

  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const [activeTab, setActiveTab] = useState("sessions")

  const [interventions, setInterventions] = useState([])
  const [sessions, setSessions] = useState([])

  const [interventionForm, setInterventionForm] = useState(INTERVENTION_FORM_DEFAULT)
  const [sessionForm, setSessionForm] = useState(SESSION_FORM_DEFAULT)
  const [sessionMetricsForm, setSessionMetricsForm] = useState(SESSION_METRICS_DEFAULT)
  const [profileForm, setProfileForm] = useState(PROFILE_FORM_DEFAULT)

  const [interventionError, setInterventionError] = useState(null)
  const [sessionError, setSessionError] = useState(null)
  const [sessionMetricsStatus, setSessionMetricsStatus] = useState(null)
  const [planStatus, setPlanStatus] = useState(null)
  const [profileStatus, setProfileStatus] = useState(null)

  const [savingIntervention, setSavingIntervention] = useState(false)
  const [savingSession, setSavingSession] = useState(false)
  const [updatingSessionMetrics, setUpdatingSessionMetrics] = useState(false)
  const [assigningPlan, setAssigningPlan] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  // Default to user-scoped; will fall back if user_id is missing on the table
  // Interventions table in this schema has no user_id column; default false and enable only if available
  const [supportsUserScopedInterventions, setSupportsUserScopedInterventions] = useState(false)
  const [supportsSessionMetrics, setSupportsSessionMetrics] = useState(true)

  const [planSelection, setPlanSelection] = useState({
    sessionId: "",
    interventionId: "",
    notes: "",
  })

  const loadProfile = useCallback(async () => {
    if (!userId) return

    setProfileLoading(true)
    const selection = "name, baseline_hr, age, sex, baseline_bp_systolic, baseline_bp_diastolic"
    const { data, error } = await supabase
      .from("Users")
      .select(selection)
      .eq("id", userId)
      .maybeSingle()

    if (error && error.code === "42703") {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("Users")
        .select("name, baseline_hr, age, sex")
        .eq("id", userId)
        .maybeSingle()

      if (fallbackError) {
        console.error("Error loading profile:", fallbackError.message)
        setProfile(null)
      } else {
        setProfile(fallbackData)
      }
      setProfileLoading(false)
      return
    }

    if (error) {
      console.error("Error loading profile:", error.message)
      setProfile(null)
    } else {
      setProfile(data)
    }

    setProfileLoading(false)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    loadProfile()
  }, [userId, loadProfile])

  useEffect(() => {
    if (!profile) return
    setProfileForm({
      name: profile.name ?? "",
      age: profile.age ? String(profile.age) : "",
      sex: profile.sex ?? "",
      baseline_hr: profile.baseline_hr ? String(profile.baseline_hr) : "",
      baseline_bp_systolic: profile.baseline_bp_systolic ? String(profile.baseline_bp_systolic) : "",
      baseline_bp_diastolic: profile.baseline_bp_diastolic ? String(profile.baseline_bp_diastolic) : "",
    })
  }, [profile])

  const fetchInterventions = useCallback(async () => {
    if (!userId) return

    let query = supabase.from("Interventions").select("*").order("intervention_id", { ascending: false })
    if (supportsUserScopedInterventions) {
      query = query.eq("user_id", userId)
    }

    const { data, error } = await query

    if (error) {
      const shouldFallback =
        supportsUserScopedInterventions &&
        (error.code === "42703" ||
          error.code === "PGRST116" ||
          error.code === "400" ||
          error.code === 400 ||
          error.message?.toLowerCase().includes("user_id") ||
          error.details?.toLowerCase().includes("user_id") ||
          error.hint?.toLowerCase().includes("user_id"))

      if (shouldFallback) {
        setSupportsUserScopedInterventions(false)

        const { data: fallbackData, error: fallbackError } = await supabase
          .from("Interventions")
          .select("*")
          .order("intervention_id", { ascending: false })

        if (fallbackError) {
          console.error("Error loading interventions (fallback):", fallbackError.message)
          return
        }

        setInterventions(fallbackData ?? [])
        return
      }
      console.error("Error loading interventions:", error.message || error)
      return
    }

    setInterventions(data ?? [])
  }, [userId, supportsUserScopedInterventions])

  const fetchSessions = useCallback(async () => {
    if (!userId) return

    const { data, error } = await supabase
      .from("Sessions")
      .select("*")
      .eq("user_id", userId)
      .order("session_date", { ascending: true })

    if (error) {
      console.error("Error loading sessions:", error.message)
      return
    }

    setSessions(data ?? [])
  }, [userId])

  useEffect(() => {
    if (!userId) return

    fetchInterventions()
    fetchSessions()
  }, [userId, fetchInterventions, fetchSessions])

  const handleInterventionInput = (field, value) => {
    setInterventionForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSessionInput = (field, value) => {
    setSessionForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSessionMetricsInput = (field, value) => {
    setSessionMetricsForm((prev) => ({ ...prev, [field]: value }))
  }

  const handlePlanInput = (field, value) => {
    setPlanSelection((prev) => ({ ...prev, [field]: value }))
  }

  const handleProfileInput = (field, value) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleInterventionSubmit = async (event) => {
    event.preventDefault()
    if (!userId) return

    setSavingIntervention(true)
    setInterventionError(null)

    const attemptInsert = async (includeUserId) => {
      const payload = {
        name: interventionForm.name.trim(),
        category: interventionForm.category.trim() || null,
        description: interventionForm.description.trim() || null,
      }

      if (includeUserId) {
        payload.user_id = userId
      }

      return supabase.from("Interventions").insert(payload)
    }

    let { error } = await attemptInsert(supportsUserScopedInterventions)

    if (error && supportsUserScopedInterventions) {
      const missingUserIdColumn =
        error.code === "42703" ||
        error.code === "PGRST116" ||
        error.message?.toLowerCase().includes("user_id") ||
        error.details?.toLowerCase().includes("user_id") ||
        error.code === "400" ||
        error.code === 400

      if (missingUserIdColumn) {
        setSupportsUserScopedInterventions(false)
        ;({ error } = await attemptInsert(false))
      }
    }

    if (error) {
      setInterventionError(error.message)
    } else {
      setInterventionForm(INTERVENTION_FORM_DEFAULT)
      await fetchInterventions()
    }

    setSavingIntervention(false)
  }

  const handleSessionSubmit = async (event) => {
    event.preventDefault()
    if (!userId) return

    setSavingSession(true)
    setSessionError(null)

    const payload = {
      user_id: userId,
      session_name: sessionForm.session_name.trim() || null,
      stressor_type: sessionForm.stressor_type.trim() || null,
      session_date: sessionForm.session_date || null,
      duration: sessionForm.duration ? parseInt(sessionForm.duration, 10) : null,
      notes: sessionForm.notes.trim() || null,
    }

    const { data: newSessions, error } = await supabase.from("Sessions").insert(payload).select().limit(1)

    if (error) {
      setSessionError(error.message)
    } else {
      setSessionForm(SESSION_FORM_DEFAULT)
      if (newSessions?.length) {
        setSessions((prev) => [...prev, ...newSessions])
      }
      await fetchSessions()
    }

    setSavingSession(false)
  }

  const handlePlanSubmit = async (event) => {
    event.preventDefault()
    setPlanStatus(null)

    const selectedSession = sessions.find((item) => String(item.id) === planSelection.sessionId)
    const selectedIntervention = interventions.find(
      (item) => String(item.intervention_id) === planSelection.interventionId,
    )

    if (!selectedSession || !selectedIntervention) {
      setPlanStatus({ type: "error", message: "Select both a session and an intervention to continue." })
      return
    }

    setAssigningPlan(true)

    const planTextLines = [`Planned intervention: ${selectedIntervention.name}`]
    if (planSelection.notes.trim()) {
      planTextLines.push(`Plan notes: ${planSelection.notes.trim()}`)
    }

    const combinedNotes = selectedSession.notes
      ? `${selectedSession.notes}\n\n${planTextLines.join("\n")}`
      : planTextLines.join("\n")

    const { error } = await supabase
      .from("Sessions")
      .update({ notes: combinedNotes })
      .eq("id", selectedSession.id)

    if (error) {
      setPlanStatus({ type: "error", message: error.message })
    } else {
      setPlanStatus({
        type: "success",
        message: "Plan saved to the selected session. You can review it in the session notes.",
      })
      setPlanSelection({ sessionId: "", interventionId: "", notes: "" })
      await fetchSessions()
    }

    setAssigningPlan(false)
  }

  const handleSessionMetricsSubmit = async (event) => {
    event.preventDefault()
    setSessionMetricsStatus(null)

    if (!sessionMetricsForm.sessionId) {
      setSessionMetricsStatus({ type: "error", message: "Select a session to record vitals." })
      return
    }

    if (!supportsSessionMetrics) {
      setSessionMetricsStatus({
        type: "error",
        message: "Add session_hr, session_bp_systolic, session_bp_diastolic, and score columns to Sessions before logging session information.",
      })
      return
    }

    const sessionId = sessionMetricsForm.sessionId
    if (!sessionId) {
      setSessionMetricsStatus({ type: "error", message: "Could not determine which session to update." })
      return
    }

    setUpdatingSessionMetrics(true)

    const payload = {
      session_hr: sessionMetricsForm.session_hr ? parseInt(sessionMetricsForm.session_hr, 10) : null,
      session_bp_systolic: sessionMetricsForm.session_bp_systolic
        ? parseInt(sessionMetricsForm.session_bp_systolic, 10)
        : null,
      session_bp_diastolic: sessionMetricsForm.session_bp_diastolic
        ? parseInt(sessionMetricsForm.session_bp_diastolic, 10)
        : null,
      score: sessionMetricsForm.score ? parseFloat(sessionMetricsForm.score) : null,
    }

    const attemptUpdate = async (includeUserFilter) => {
      let query = supabase.from("Sessions").update(payload).eq("id", sessionId)
      if (includeUserFilter) {
        query = query.eq("user_id", userId)
      }
      return query.select("*")
    }

    let { data: updatedSessions, error } = await attemptUpdate(true)

    // If nothing updated or update rejected, retry without user_id filter (older rows may not have user_id populated)
    if (
      (!error && (!updatedSessions || updatedSessions.length === 0)) ||
      (error && (error.code === "406" || error.code === 406 || error.code === "400" || error.code === 400))
    ) {
      ;({ data: updatedSessions, error } = await attemptUpdate(false))
    }

    if (error) {
      if (error.code === "42703") {
        setSupportsSessionMetrics(false)
        setSessionMetricsStatus({
          type: "error",
          message: "Your Sessions table is missing required columns (session_hr, session_bp, or score). Please add them, then try again.",
        })
      } else {
        setSessionMetricsStatus({
          type: "error",
          message: error.message || "Unable to save vitals. Check your RLS policy on Sessions for updates.",
        })
      }
    } else {
      // Update succeeded; PostgREST may return no rows if SELECT policy is stricter than UPDATE policy.
      setSessionMetricsStatus({ type: "success", message: "Session information saved. Compare vitals against your baseline later." })
      const updatedSession = updatedSessions?.[0]
      if (updatedSession) {
        setSessions((prev) =>
          prev.map((sessionItem) => (sessionItem.id === updatedSession.id ? updatedSession : sessionItem)),
        )
      }
      setSessionMetricsForm(SESSION_METRICS_DEFAULT)
      await fetchSessions()
    }

    setUpdatingSessionMetrics(false)
  }

  const handleProfileSubmit = async (event) => {
    event.preventDefault()
    if (!userId) return

    setSavingProfile(true)
    setProfileStatus(null)

    const payload = {
      name: profileForm.name.trim() || null,
      age: profileForm.age ? parseInt(profileForm.age, 10) : null,
      sex: profileForm.sex || null,
      baseline_hr: profileForm.baseline_hr ? parseInt(profileForm.baseline_hr, 10) : null,
      baseline_bp_systolic: profileForm.baseline_bp_systolic ? parseInt(profileForm.baseline_bp_systolic, 10) : null,
      baseline_bp_diastolic: profileForm.baseline_bp_diastolic ? parseInt(profileForm.baseline_bp_diastolic, 10) : null,
    }

    const { error } = await supabase.from("Users").update(payload).eq("id", userId)

    if (error) {
      setProfileStatus({ type: "error", message: error.message })
    } else {
      setProfileStatus({ type: "success", message: "Profile updated successfully." })
      await loadProfile()
    }

    setSavingProfile(false)
  }

  const upcomingSessions = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return sessions
      .filter((sessionItem) => {
        if (!sessionItem.session_date) return true
        const date = new Date(sessionItem.session_date)
        date.setHours(0, 0, 0, 0)
        return date >= today
      })
      .sort((a, b) => {
        const aValue = a.session_date ? new Date(a.session_date).getTime() : Number.POSITIVE_INFINITY
        const bValue = b.session_date ? new Date(b.session_date).getTime() : Number.POSITIVE_INFINITY
        return aValue - bValue
      })
  }, [sessions])

  const pastSessions = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return sessions
      .filter((sessionItem) => {
        if (!sessionItem.session_date) return false
        const date = new Date(sessionItem.session_date)
        date.setHours(0, 0, 0, 0)
        return date < today
      })
      .sort((a, b) => {
        const aValue = a.session_date ? new Date(a.session_date).getTime() : 0
        const bValue = b.session_date ? new Date(b.session_date).getTime() : 0
        return bValue - aValue
      })
  }, [sessions])

  const renderNoData = (message) => <p className="empty-state">{message}</p>

  const formatDate = (value) => {
    if (!value) return "Date TBD"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "Date TBD"
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  }

  const hasValue = (value) => value !== null && value !== undefined && value !== ""

  const hasSessionVitals = (sessionItem) =>
    hasValue(sessionItem.session_hr) ||
    hasValue(sessionItem.session_bp_systolic) ||
    hasValue(sessionItem.session_bp_diastolic)

  const renderSessionVitals = (sessionItem) => {
    const hasVitals = hasSessionVitals(sessionItem)
    const hasScore = hasValue(sessionItem.score)
    
    if (!hasVitals && !hasScore) return null

    const hrText = hasValue(sessionItem.session_hr) ? `${sessionItem.session_hr} bpm` : null

    const hasSystolic = hasValue(sessionItem.session_bp_systolic)
    const hasDiastolic = hasValue(sessionItem.session_bp_diastolic)

    const bpText =
      hasSystolic || hasDiastolic
        ? `${hasSystolic ? sessionItem.session_bp_systolic : "?"}/${hasDiastolic ? sessionItem.session_bp_diastolic : "?"} mmHg`
        : null

    return (
      <div className="data-card__vitals">
        <p className="data-card__eyebrow">Session information</p>
        <div className="data-card__vitals-values">
          {hrText && <span className="pill">HR: {hrText}</span>}
          {bpText && <span className="pill">BP: {bpText}</span>}
          {hasScore && <span className="pill">Score: {sessionItem.score}/100</span>}
        </div>
      </div>
    )
  }

  const renderSessionsTab = () => (
    <>
      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Log a Stress Session</h3>
            <p>Capture the details for upcoming or past stress-inducing events.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleSessionSubmit}>
          <label className="form-field">
            <span>Session Name</span>
            <input
              type="text"
              value={sessionForm.session_name}
              onChange={(e) => handleSessionInput("session_name", e.target.value)}
              placeholder="Midterm #2"
              required
            />
          </label>
          <label className="form-field">
            <span>Stressor Type</span>
            <input
              type="text"
              value={sessionForm.stressor_type}
              onChange={(e) => handleSessionInput("stressor_type", e.target.value)}
              placeholder="Exam, presentation, audition..."
            />
          </label>
          <label className="form-field">
            <span>Session Date</span>
            <input
              type="date"
              value={sessionForm.session_date}
              onChange={(e) => handleSessionInput("session_date", e.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span>Duration (minutes)</span>
            <input
              type="number"
              min="1"
              value={sessionForm.duration}
              onChange={(e) => handleSessionInput("duration", e.target.value)}
              placeholder="60"
            />
          </label>
          <label className="form-field form-field--full">
            <span>Notes</span>
            <textarea
              rows={3}
              value={sessionForm.notes}
              onChange={(e) => handleSessionInput("notes", e.target.value)}
              placeholder="Anything noteworthy about preparation, mindset, or results."
            />
          </label>
          {sessionError && <p className="form-error form-field--full">{sessionError}</p>}
          <p className="helper-text form-field--full">
            Schedule the session now; you can log the measured vitals afterward below.
          </p>
          <div className="form-actions form-field--full">
            <button className="primary-button" type="submit" disabled={savingSession}>
              {savingSession ? "Saving session..." : "Save Session"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <h3>Upcoming Sessions</h3>
          <p>Keep an eye on what’s next so you can line up the right intervention.</p>
        </div>
        {upcomingSessions.length === 0
          ? renderNoData("No upcoming sessions yet. Add one above to get started.")
          : (
              <ul className="data-list">
                {upcomingSessions.map((item) => (
                  <li key={item.id} className="data-card">
                    <div className="data-card__header">
                      <div>
                        <h4>{item.session_name || "Untitled session"}</h4>
                        <p>{item.stressor_type || "General stressor"}</p>
                      </div>
                      <span className="pill">{formatDate(item.session_date)}</span>
                    </div>
                    <div className="data-card__meta">
                      {item.duration ? <span>{item.duration} min</span> : <span>Duration TBD</span>}
                      {hasValue(item.session_hr) && <span>Stress HR: {item.session_hr} bpm</span>}
                      {hasValue(item.session_bp_systolic) && hasValue(item.session_bp_diastolic) && (
                        <span>
                          Stress BP: {item.session_bp_systolic}/{item.session_bp_diastolic} mmHg
                        </span>
                      )}
                    </div>
                    {renderSessionVitals(item)}
                    {item.notes && <p className="data-card__body">{item.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <h3>Past Sessions</h3>
          <p>Review previous events to see how interventions impacted your stress.</p>
        </div>
        {pastSessions.length === 0
          ? renderNoData("Once a session date passes, it will show up here.")
          : (
              <ul className="data-list">
                {pastSessions.map((item) => (
                  <li key={item.id} className="data-card">
                    <div className="data-card__header">
                      <div>
                        <h4>{item.session_name || "Untitled session"}</h4>
                        <p>{item.stressor_type || "General stressor"}</p>
                      </div>
                      <span className="pill pill--muted">{formatDate(item.session_date)}</span>
                    </div>
                    <div className="data-card__meta">
                      {item.duration ? <span>{item.duration} min</span> : <span>Duration TBD</span>}
                      {hasValue(item.session_hr) && <span>Stress HR: {item.session_hr} bpm</span>}
                      {hasValue(item.session_bp_systolic) && hasValue(item.session_bp_diastolic) && (
                        <span>
                          Stress BP: {item.session_bp_systolic}/{item.session_bp_diastolic} mmHg
                        </span>
                      )}
                    </div>
                    {renderSessionVitals(item)}
                    {item.notes && <p className="data-card__body">{item.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Record Past Session Information</h3>
            <p>After the event, capture the measured heart rate, blood pressure, and your performance score.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleSessionMetricsSubmit}>
          <label className="form-field">
            <span>Select Session</span>
            <select
              value={sessionMetricsForm.sessionId}
              onChange={(e) => handleSessionMetricsInput("sessionId", e.target.value)}
              required
            >
              <option value="">Choose a session</option>
              {sessions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.session_name || "Untitled session"} • {formatDate(item.session_date)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Stress Heart Rate (bpm)</span>
            <input
              type="number"
              min="1"
              value={sessionMetricsForm.session_hr}
              onChange={(e) => handleSessionMetricsInput("session_hr", e.target.value)}
              placeholder="e.g., 105"
              required
            />
          </label>
          <label className="form-field">
            <span>Stress BP - Systolic</span>
            <input
              type="number"
              min="1"
              value={sessionMetricsForm.session_bp_systolic}
              onChange={(e) => handleSessionMetricsInput("session_bp_systolic", e.target.value)}
              placeholder="e.g., 130"
              required
            />
          </label>
          <label className="form-field">
            <span>Stress BP - Diastolic</span>
            <input
              type="number"
              min="1"
              value={sessionMetricsForm.session_bp_diastolic}
              onChange={(e) => handleSessionMetricsInput("session_bp_diastolic", e.target.value)}
              placeholder="e.g., 82"
              required
            />
          </label>
          <label className="form-field">
            <span>Performance Score (1-100)</span>
            <input
              type="number"
              min="1"
              max="100"
              step="0.1"
              value={sessionMetricsForm.score}
              onChange={(e) => handleSessionMetricsInput("score", e.target.value)}
              placeholder="e.g., 85.5"
            />
          </label>
          {sessionMetricsStatus && (
            <p
              className={`form-feedback form-field--full ${
                sessionMetricsStatus.type === "error" ? "form-error" : "form-success"
              }`}
            >
              {sessionMetricsStatus.message}
            </p>
          )}
          <div className="form-actions form-field--full">
            <button className="primary-button" type="submit" disabled={updatingSessionMetrics || sessions.length === 0}>
              {updatingSessionMetrics ? "Saving information..." : "Save Session Information"}
            </button>
          </div>
        </form>
        <p className="helper-text">Log the session first, then come back with your wearable readings and performance score.</p>
      </section>
    </>
  )

  const renderInterventionsTab = () => (
    <>
      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Track Interventions</h3>
            <p>Document the strategies you’re testing so you can compare results.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleInterventionSubmit}>
          <label className="form-field">
            <span>Name</span>
            <input
              type="text"
              value={interventionForm.name}
              onChange={(e) => handleInterventionInput("name", e.target.value)}
              placeholder="Guided meditation"
              required
            />
          </label>
          <label className="form-field">
            <span>Category</span>
            <input
              type="text"
              value={interventionForm.category}
              onChange={(e) => handleInterventionInput("category", e.target.value)}
              placeholder="Breathing, movement, journaling..."
            />
          </label>
          <label className="form-field form-field--full">
            <span>Description</span>
            <textarea
              rows={3}
              value={interventionForm.description}
              onChange={(e) => handleInterventionInput("description", e.target.value)}
              placeholder="When and how you apply this intervention."
            />
          </label>
          {interventionError && <p className="form-error form-field--full">{interventionError}</p>}
          <div className="form-actions form-field--full">
            <button className="primary-button" type="submit" disabled={savingIntervention}>
              {savingIntervention ? "Saving intervention..." : "Save Intervention"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <h3>Your Interventions</h3>
          <p>Compare which ones feel most supportive before stressful events.</p>
        </div>
        {interventions.length === 0
          ? renderNoData("Add an intervention to see it listed here.")
          : (
              <ul className="data-list">
                {interventions.map((item) => (
                  <li key={item.intervention_id} className="data-card">
                    <div className="data-card__header">
                      <div>
                        <h4>{item.name}</h4>
                        <p>{item.category || "Uncategorized"}</p>
                      </div>
                    </div>
                    {item.description && <p className="data-card__body">{item.description}</p>}
                  </li>
                ))}
              </ul>
            )}
      </section>
    </>
  )

  const renderPlannerTab = () => (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <h3>Plan Your Next Stress Event</h3>
          <p>Select an upcoming session and the intervention you’ll rely on.</p>
        </div>
      </div>
      <form className="form-grid" onSubmit={handlePlanSubmit}>
        <label className="form-field">
          <span>Upcoming Session</span>
          <select
            value={planSelection.sessionId}
            onChange={(e) => handlePlanInput("sessionId", e.target.value)}
            required
          >
            <option value="">Select a session</option>
            {upcomingSessions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.session_name || "Untitled session"} • {formatDate(item.session_date)}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Intervention</span>
          <select
            value={planSelection.interventionId}
            onChange={(e) => handlePlanInput("interventionId", e.target.value)}
            required
          >
            <option value="">Select an intervention</option>
            {interventions.map((item) => (
              <option key={item.intervention_id} value={item.intervention_id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field form-field--full">
          <span>Preparation Notes (optional)</span>
          <textarea
            rows={3}
            value={planSelection.notes}
            onChange={(e) => handlePlanInput("notes", e.target.value)}
            placeholder="Add reminders or measurements you want to capture."
          />
        </label>
        {planStatus && (
          <p className={`form-feedback form-field--full ${planStatus.type === "error" ? "form-error" : "form-success"}`}>
            {planStatus.message}
          </p>
        )}
        <div className="form-actions form-field--full">
          <button
            className="primary-button"
            type="submit"
            disabled={assigningPlan || interventions.length === 0 || upcomingSessions.length === 0}
          >
            {assigningPlan ? "Saving plan..." : "Assign Intervention"}
          </button>
        </div>
      </form>
      {upcomingSessions.length === 0 && (
        <p className="helper-text">Add at least one upcoming session to start planning interventions.</p>
      )}
      {interventions.length === 0 && (
        <p className="helper-text">Log an intervention first so you can attach it to an event.</p>
      )}
    </section>
  )

  const renderProfileTab = () => (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <h3>Update Profile</h3>
          <p>Adjust your demographics or baseline vitals any time.</p>
        </div>
      </div>
      <form className="form-grid" onSubmit={handleProfileSubmit}>
        <label className="form-field">
          <span>Full Name</span>
          <input type="text" value={profileForm.name} onChange={(e) => handleProfileInput("name", e.target.value)} required />
        </label>
        <label className="form-field">
          <span>Age</span>
          <input
            type="number"
            min="1"
            value={profileForm.age}
            onChange={(e) => handleProfileInput("age", e.target.value)}
            required
          />
        </label>
        <label className="form-field">
          <span>Sex</span>
          <select value={profileForm.sex} onChange={(e) => handleProfileInput("sex", e.target.value)} required>
            <option value="">Select sex</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="form-field">
          <span>Baseline Heart Rate (bpm)</span>
          <input
            type="number"
            min="1"
            value={profileForm.baseline_hr}
            onChange={(e) => handleProfileInput("baseline_hr", e.target.value)}
            required
          />
        </label>
        <label className="form-field">
          <span>Baseline BP - Systolic</span>
          <input
            type="number"
            min="1"
            value={profileForm.baseline_bp_systolic}
            onChange={(e) => handleProfileInput("baseline_bp_systolic", e.target.value)}
            required
          />
        </label>
        <label className="form-field">
          <span>Baseline BP - Diastolic</span>
          <input
            type="number"
            min="1"
            value={profileForm.baseline_bp_diastolic}
            onChange={(e) => handleProfileInput("baseline_bp_diastolic", e.target.value)}
            required
          />
        </label>
        {profileStatus && (
          <p className={`form-feedback form-field--full ${profileStatus.type === "error" ? "form-error" : "form-success"}`}>
            {profileStatus.message}
          </p>
        )}
        <div className="form-actions form-field--full">
          <button className="primary-button" type="submit" disabled={savingProfile}>
            {savingProfile ? "Saving profile..." : "Save Changes"}
          </button>
        </div>
      </form>
    </section>
  )

  return (
    <div className="landing-shell">
      <aside className="landing-sidebar">
        <div className="sidebar-profile">
          <p className="sidebar-eyebrow">Welcome back</p>
          <h2>{profileLoading ? "Loading..." : profile?.name || "Athlete"}</h2>
          <p className="sidebar-baseline">
            Baseline HR: <span>{profile?.baseline_hr ? `${profile.baseline_hr} bpm` : "Not recorded"}</span>
          </p>
          <p className="sidebar-baseline">
            Baseline BP:{" "}
            <span>
              {profile?.baseline_bp_systolic && profile?.baseline_bp_diastolic
                ? `${profile.baseline_bp_systolic}/${profile.baseline_bp_diastolic} mmHg`
                : "Not recorded"}
            </span>
          </p>
        </div>

        <nav className="landing-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`landing-nav-button ${activeTab === tab.id ? "landing-nav-button--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-tip">
          <p>
            Track each event and the intervention you choose. Over time, you’ll spot which strategies keep your stress
            in check.
          </p>
        </div>
      </aside>

      <main className="landing-main">
        {activeTab === "sessions" && renderSessionsTab()}
        {activeTab === "interventions" && renderInterventionsTab()}
        {activeTab === "planner" && renderPlannerTab()}
        {activeTab === "profile" && renderProfileTab()}
      </main>
    </div>
  )
}
