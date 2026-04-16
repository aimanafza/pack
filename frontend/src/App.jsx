import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useStore from './store/index.js'
import PageWrapper from './components/layout/PageWrapper.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'

import LandingPage from './pages/LandingPage.jsx'
import AuthPage from './pages/AuthPage.jsx'
import OnboardingPage from './pages/OnboardingPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import WardrobePage from './pages/WardrobePage.jsx'
import TripsPage from './pages/TripsPage.jsx'
import NewTripPage from './pages/NewTripPage.jsx'
import TripDetailPage from './pages/TripDetailPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import StyleDNAPage from './pages/StyleDNAPage.jsx'
import PackingPage from './pages/PackingPage.jsx'
import SwipeReviewPage from './pages/SwipeReviewPage.jsx'
import WardrobeItemDetailPage from './pages/WardrobeItemDetailPage.jsx'
import AvatarBuilder from './pages/AvatarBuilder.jsx'
import RegisterPage from './pages/RegisterPage.jsx'

function PrivateRoute({ children }) {
  const token = useStore((s) => s.token)
  return token ? children : <Navigate to="/auth" replace />
}

// Authenticated pages that use the sidebar layout
function WithLayout({ children }) {
  return (
    <PrivateRoute>
      <PageWrapper>{children}</PageWrapper>
    </PrivateRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth" element={<AuthPage />} />
        {/* Onboarding: full screen, no sidebar, private */}
        <Route
          path="/onboarding"
          element={<PrivateRoute><OnboardingPage /></PrivateRoute>}
        />
        <Route path="/dashboard" element={<WithLayout><DashboardPage /></WithLayout>} />
        <Route path="/wardrobe" element={<WithLayout><WardrobePage /></WithLayout>} />
        <Route path="/wardrobe/:item_id" element={<WithLayout><WardrobeItemDetailPage /></WithLayout>} />
        <Route path="/trips" element={<WithLayout><TripsPage /></WithLayout>} />
        <Route path="/trips/new" element={<WithLayout><NewTripPage /></WithLayout>} />
        <Route path="/trips/:id" element={<WithLayout><TripDetailPage /></WithLayout>} />
        <Route path="/profile" element={<WithLayout><ProfilePage /></WithLayout>} />
        <Route path="/profile/style-dna" element={<WithLayout><StyleDNAPage /></WithLayout>} />
        <Route path="/profile/build-avatar" element={<PrivateRoute><AvatarBuilder /></PrivateRoute>} />
        {/* Swipe review + packing: no sidebar, distraction-free full-width */}
        <Route path="/trips/:id/review" element={<PrivateRoute><SwipeReviewPage /></PrivateRoute>} />
        <Route path="/trips/:id/pack" element={<PrivateRoute><PackingPage /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
