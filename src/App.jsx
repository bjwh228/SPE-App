import { useCallback, useEffect, useState } from "react"
import { supabase } from "./supabaseClient"
import { Auth } from "@supabase/auth-ui-react"
import { ThemeSupa } from "@supabase/auth-ui-shared"
import { Routes, Route, Navigate } from "react-router-dom"
import CompleteProfile from "./CompleteProfile"
import LandingPage from "./LandingPage"
import "./App.css"

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileComplete, setProfileComplete] = useState(null)

  const handleSignOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error("Error signing out:", err)
    } finally {
      setSession(null)
      setProfileComplete(null)
    }
  }, [])

  // ---- initialize & listen for session changes without logging out on refresh ----
  useEffect(() => {
    let isMounted = true
    const hasWindow = typeof window !== "undefined"
    const hash = hasWindow ? window.location.hash : ""
    const isSignupRedirect = hasWindow && hash.includes("type=signup")

    const syncSession = async (incomingSession) => {
      try {
        let nextSession = incomingSession ?? null
        if (nextSession) {
          const expiresAt = nextSession.expires_at
          const now = Math.floor(Date.now() / 1000)

          if (expiresAt && expiresAt < now) {
            await supabase.auth.signOut()
            nextSession = null
          }
        }

        if (isMounted) setSession(nextSession)
      } catch (err) {
        console.error("Error syncing session:", err)
        if (isMounted) setSession(null)
      }
    }

    const initializeSession = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        await syncSession(data.session ?? null)

        if (isSignupRedirect && hasWindow) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search)
        }
      } catch (err) {
        console.error("Error initializing session:", err)
        if (isMounted) setSession(null)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initializeSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session)
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  // ---- profile check ----
  useEffect(() => {
    const checkProfile = async () => {
      if (!session) {
        setProfileComplete(null)
        return
      }

      setProfileComplete(null)

      const columnSelection = "name, age, sex, baseline_hr, baseline_bp_systolic, baseline_bp_diastolic"
      const { data, error } = await supabase
        .from("Users")
        .select(columnSelection)
        .eq("id", session.user.id)
        .maybeSingle()

      if (error && error.code === "42703") {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("Users")
          .select("name, age, sex, baseline_hr")
          .eq("id", session.user.id)
          .maybeSingle()

        if (fallbackError && fallbackError.code !== "PGRST116") {
          console.error("Error checking profile:", fallbackError.message)
          return
        }

        if (!fallbackData) {
          setProfileComplete(false)
          return
        }

        setProfileComplete(Boolean(fallbackData.name && fallbackData.age && fallbackData.sex && fallbackData.baseline_hr))
        return
      }

      if (error && error.code !== "PGRST116") {
        console.error("Error checking profile:", error.message)
        return
      }

      if (!data) {
        setProfileComplete(false)
        return
      }

      setProfileComplete(Boolean(data.name && data.age && data.sex && data.baseline_hr))
    }

    checkProfile()
  }, [session])

  // ---- loading indicator ----
  if (loading) return <div className="loading">Loading...</div>

  // ---- not logged in ----
  if (!session) {
    return (
      <div className="app-layout">
        <div className="app-header">
          <img src="/CS499.png" alt="CS499 Logo" className="app-logo" />
          <div className="app-header-title">Stress Performance Evaluation App</div>
        </div>
        <div className="app-content auth-container">
          <Routes>
            <Route path="*" element={<Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} />} />
          </Routes>
        </div>
      </div>
    )
  }

  if (profileComplete === null) return <div className="loading">Loading profile...</div>

  // ---- logged in ----
  return (
    <div className="app-layout">
      <div className="app-header">
        <img src="/CS499.png" alt="CS499 Logo" className="app-logo" />
        <div className="app-header-title">Stress Performance Evaluation App</div>
        <button className="logout-button" type="button" onClick={handleSignOut}>
          Log Out
        </button>
      </div>
      <div className="app-content">
        <Routes>
          <Route
            path="/complete-profile"
            element={profileComplete ? <Navigate to="/landing" replace /> : <CompleteProfile />}
          />
          <Route
            path="/landing"
            element={profileComplete ? <LandingPage session={session} /> : <Navigate to="/complete-profile" replace />}
          />
          {/* catch all */}
          <Route
            path="*"
            element={<Navigate to={profileComplete ? "/landing" : "/complete-profile"} replace />}
          />
        </Routes>
      </div>
    </div>
  )
}
