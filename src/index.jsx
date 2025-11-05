import React from "react"
import ReactDOM from "react-dom/client"
import { HashRouter } from "react-router-dom"     // 👈 use hash router here
import App from "./App"

ReactDOM.createRoot(document.getElementById("root")).render(
  <HashRouter>
    <App />
  </HashRouter>
)
