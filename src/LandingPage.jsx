import { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "./supabaseClient"

const TABS = [
  { id: "sessions", label: "Sessions" },
  { id: "interventions", label: "Interventions" },
  { id: "planner", label: "Plan Event" },
]

const INTERVENTION_FORM_DEFAULT = {
  name: "",
  category: "",
  description: "",
  active: true,
}

const SESSION_FORM_DEFAULT = {
  session_name: "",
  stressor_type: "",
  session_date: "",
  duration: "",
  notes: "",
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

  const [interventionError, setInterventionError] = useState(null)
  const [sessionError, setSessionError] = useState(null)
  const [planStatus, setPlanStatus] = useState(null)

  const [savingIntervention, setSavingIntervention] = useState(false)
  const [savingSession, setSavingSession] = useState(false)
  const [assigningPlan, setAssigningPlan] = useState(false)

  const [supportsUserScopedInterventions, setSupportsUserScopedInterventions] = useState(true)

  const [planSelection, setPlanSelection] = useState({
    sessionId: "",
    interventionId: "",
    notes: "",
  })

  useEffect(() => {
    if (!userId) return

    const loadProfile = async () => {
      setProfileLoading(true)
      const { data, error } = await supabase
        .from("Users")
        .select("name, baseline_hr")
        .eq("id", userId)
        .maybeSingle()

      if (error) {
        console.error("Error loading profile:", error.message)
      } else {
        setProfile(data)
      }

      setProfileLoading(false)
    }

    loadProfile()
  }, [userId])

  const fetchInterventions = useCallback(async () => {
    if (!userId) return

    let query = supabase.from("Interventions").select("*").order("intervention_id", { ascending: false })
    if (supportsUserScopedInterventions) {
      query = query.eq("user_id", userId)
    }

    const { data, error } = await query

    if (error) {
      if (error.code === "42703" && supportsUserScopedInterventions) {
        // user_id column missing, refetch without it
        setSupportsUserScopedInterventions(false)
        return
      }
      console.error("Error loading interventions:", error.message)
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

  const handlePlanInput = (field, value) => {
    setPlanSelection((prev) => ({ ...prev, [field]: value }))
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
        active: interventionForm.active,
      }

      if (includeUserId) {
        payload.user_id = userId
      }

      return supabase.from("Interventions").insert(payload)
    }

    let { error } = await attemptInsert(supportsUserScopedInterventions)

    if (error && supportsUserScopedInterventions && error.code === "42703") {
      setSupportsUserScopedInterventions(false)
      ;({ error } = await attemptInsert(false))
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

    const { error } = await supabase.from("Sessions").insert(payload)

    if (error) {
      setSessionError(error.message)
    } else {
      setSessionForm(SESSION_FORM_DEFAULT)
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
                    </div>
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
                    </div>
                    {item.notes && <p className="data-card__body">{item.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
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
          <label className="form-field form-field--full checkbox-field">
            <input
              type="checkbox"
              checked={interventionForm.active}
              onChange={(e) => handleInterventionInput("active", e.target.checked)}
            />
            <span>Currently using this intervention</span>
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
                      <span className={`pill ${item.active ? "pill--success" : "pill--muted"}`}>
                        {item.active ? "Active" : "Paused"}
                      </span>
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

  return (
    <div className="landing-shell">
      <aside className="landing-sidebar">
        <div className="sidebar-profile">
          <p className="sidebar-eyebrow">Welcome back</p>
          <h2>{profileLoading ? "Loading..." : profile?.name || "Athlete"}</h2>
          <p className="sidebar-baseline">
            Baseline HR: <span>{profile?.baseline_hr ? `${profile.baseline_hr} bpm` : "Not recorded"}</span>
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
      </main>
    </div>
  )
}
