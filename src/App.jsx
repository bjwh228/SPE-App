import { useEffect, useState } from "react"
import { supabase } from "./supabaseClient"
import { Auth } from "@supabase/auth-ui-react"
import { ThemeSupa } from "@supabase/auth-ui-shared"
import { Routes, Route, Navigate } from "react-router-dom"
import CompleteProfile from "./CompleteProfile"
import LandingPage from "./LandingPage"

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileComplete, setProfileComplete] = useState(false)
  const [hasProfile, setHasProfile] = useState(false)

  // ---- session listener ----
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setLoading(false)
    }
    getSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // ---- profile check ----
  useEffect(() => {
    const checkProfile = async () => {
      if (!session) {
        // no user yet
        setHasProfile(false)
        setProfileComplete(false)
        return
      }

      const { data, error } = await supabase
        .from("Users")
        .select("name, age, sex")
        .eq("id", session.user.id)
        .maybeSingle()

      if (error && error.code !== "PGRST116") {
        console.error("Error checking profile:", error.message)
        return
      }

      if (!data) {
        setHasProfile(false)
        setProfileComplete(false)
        return
      }

      setHasProfile(true)
      setProfileComplete(Boolean(data.name && data.age && data.sex))
    }

    checkProfile()
  }, [session])

  // ---- loading indicator ----
  if (loading) return <div>Loading...</div>

  // ---- not logged in ----
  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} />
      </div>
    )
  }

  // ---- logged in ----
  return (
    <Routes>
      <Route path="/complete-profile" element={<CompleteProfile />} />
      <Route path="/landing" element={<LandingPage />} />
      {/* catch all */}
      <Route
        path="*"
        element={
          !hasProfile ? (
            <Navigate to="/complete-profile" replace />
          ) : profileComplete ? (
            <Navigate to="/landing" replace />
          ) : (
            <Navigate to="/complete-profile" replace />
          )
        }
      />
    </Routes>
  )
}
