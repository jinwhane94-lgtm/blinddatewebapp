import { HashRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ApplyPage from './pages/ApplyPage'
import ManagerLoginPage from './pages/ManagerLoginPage'
import ManagerDashboardPage from './pages/ManagerDashboardPage'
import LikesPage from './pages/LikesPage'
import DevPage from './pages/DevPage'
import UserAuthPage from './pages/UserAuthPage'
import ProfilesPage from './pages/ProfilesPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/apply" element={<ApplyPage />} />
        <Route path="/profiles" element={<ProfilesPage />} />
        <Route path="/login" element={<UserAuthPage key="login" mode="login" />} />
        <Route path="/signup" element={<UserAuthPage key="signup" mode="signup" />} />
        <Route path="/manager/login" element={<ManagerLoginPage />} />
        <Route path="/manager/dashboard" element={<ManagerDashboardPage />} />
        <Route path="/manager/requests" element={<ManagerDashboardPage reviewRequests />} />
        <Route path="/likes" element={<LikesPage />} />
        <Route path="/dev" element={<DevPage />} />
      </Routes>
    </HashRouter>
  )
}
