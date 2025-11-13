import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "./supabaseClient"

export default function CompleteProfile() {
  const [name, setName] = useState("")
  const [age, setAge] = useState("")
  const [sex, setSex] = useState("")
  const [baselineHr, setBaselineHr] = useState("") // 👈 new state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const { error } = await supabase
      .from("Users")
      .update({
        name,
        age: parseInt(age, 10),
        sex,
        baseline_hr: parseInt(baselineHr, 10), // 👈 include new field
      })
      .eq("id", session.user.id)

    setSaving(false)

    if (error) {
      console.error(error)
      setError("Error saving profile: " + error.message)
    } else {
      navigate("/landing")
    }
  }

  return (
    <div className="complete-profile-container">
      <form onSubmit={handleSubmit} className="complete-profile-form">
        <h1 className="complete-profile-title">Complete Your Profile</h1>

        <input
          className="profile-input"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="profile-input"
          type="number"
          placeholder="Age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          required
        />
        <select
          className="profile-input"
          value={sex}
          onChange={(e) => setSex(e.target.value)}
          required
        >
          <option value="">Select sex</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </select>

        <input
          className="profile-input"
          type="number"
          placeholder="Baseline Heart Rate (bpm)"
          value={baselineHr}
          onChange={(e) => setBaselineHr(e.target.value)}
          required
        />

        {error && <p className="profile-error">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="profile-submit-button"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </form>
    </div>
  )
}
