import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import './styles/karsa.css' // desain Karsa yang disepakati (28 Nov 2026)
import { ECOSYSTEM_NAME_FULL } from './config/ecosystem'

document.title = `${ECOSYSTEM_NAME_FULL} · Dashboard Pusat`

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
