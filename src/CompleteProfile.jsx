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
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-semibold text-center">Complete Your Profile</h1>

        <input
          className="border p-2 w-full rounded"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="border p-2 w-full rounded"
          type="number"
          placeholder="Age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          required
        />
        <select
          className="border p-2 w-full rounded"
          value={sex}
          onChange={(e) => setSex(e.target.value)}
          required
        >
          <option value="">Select sex</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </select>

        {/* 👇 new Baseline HR field */}
        <input
          className="border p-2 w-full rounded"
          type="number"
          placeholder="Baseline Heart Rate (bpm)"
          value={baselineHr}
          onChange={(e) => setBaselineHr(e.target.value)}
          required
        />

        {error && <p className="text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </form>
    </div>
  )
}
