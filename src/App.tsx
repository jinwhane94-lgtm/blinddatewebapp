import { HashRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ApplyPage from './pages/ApplyPage'
import ManagerLoginPage from './pages/ManagerLoginPage'
import ManagerDashboardPage from './pages/ManagerDashboardPage'
import DevPage from './pages/DevPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/apply" element={<ApplyPage />} />
        <Route path="/manager/login" element={<ManagerLoginPage />} />
        <Route path="/manager/dashboard" element={<ManagerDashboardPage />} />
        <Route path="/dev" element={<DevPage />} />
      </Routes>
    </HashRouter>
  )
}
