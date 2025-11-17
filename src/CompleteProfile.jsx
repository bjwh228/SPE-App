import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "./supabaseClient"

export default function CompleteProfile() {
  const [name, setName] = useState("")
  const [age, setAge] = useState("")
  const [sex, setSex] = useState("")
  const [baselineHr, setBaselineHr] = useState("")
  const [baselineBpSystolic, setBaselineBpSystolic] = useState("")
  const [baselineBpDiastolic, setBaselineBpDiastolic] = useState("")
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

    const payload = {
      name,
      age: parseInt(age, 10),
      sex,
      baseline_hr: parseInt(baselineHr, 10),
      baseline_bp_systolic: parseInt(baselineBpSystolic, 10),
      baseline_bp_diastolic: parseInt(baselineBpDiastolic, 10),
    }

    const { error } = await supabase.from("Users").update(payload).eq("id", session.user.id)

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
        <p className="complete-profile-note">
          Please finish this form when you are in a calm environment and can capture accurate heart rate and blood pressure
          readings.
        </p>

        <input className="profile-input" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required />

        <input
          className="profile-input"
          type="number"
          placeholder="Age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          min="1"
          required
        />

        <select className="profile-input" value={sex} onChange={(e) => setSex(e.target.value)} required>
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
          min="1"
          required
        />

        <div className="baseline-bp-row">
          <input
            className="profile-input"
            type="number"
            placeholder="Baseline BP - Systolic (e.g., 120)"
            value={baselineBpSystolic}
            onChange={(e) => setBaselineBpSystolic(e.target.value)}
            min="1"
            required
          />
          <input
            className="profile-input"
            type="number"
            placeholder="Baseline BP - Diastolic (e.g., 80)"
            value={baselineBpDiastolic}
            onChange={(e) => setBaselineBpDiastolic(e.target.value)}
            min="1"
            required
          />
        </div>

        {error && <p className="profile-error">{error}</p>}

        <button type="submit" disabled={saving} className="profile-submit-button">
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </form>
    </div>
  )
}
