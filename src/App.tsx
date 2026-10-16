import { useState } from 'react';
import { supabase, type ChatRoom } from '@/lib/supabase';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import AuthPage from '@/pages/AuthPage';
import Layout, { type Page } from '@/components/Layout';
import HomePage from '@/pages/HomePage';
import ChatPage from '@/pages/ChatPage';
import MessagesPage from '@/pages/MessagesPage';
import { DirectMessageProvider } from '@/context/DirectMessageContext';
import CollegesPage from '@/pages/CollegesPage';
import EventsPage from '@/pages/EventsPage';
import GalleryPage from '@/pages/GalleryPage';
import AdminPage from '@/pages/AdminPage';
import ProfilePage from '@/pages/ProfilePage';
import CommunityPage from '@/pages/CommunityPage';
import CampusHubPage from '@/pages/CampusHubPage';
import PlannerPage from '@/pages/PlannerPage';
import CollaboratePage from '@/pages/CollaboratePage';
import StudentGrowthPage from '@/pages/StudentGrowthPage';
import CampusPlusPage from '@/pages/CampusPlusPage';
import { AIStudyToolsPage, PersonalizedDashboardPage, CareerCoachPage, CampusNavigatorPage, TutoringPage, ProjectHubPage, CampusHelpdeskPage, AdminAnalyticsPage } from '@/pages/StudentToolsPages';
import { GraduationCap, Loader2 } from 'lucide-react';

function AppContent() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [page, setPage] = useState<Page>('home');
  const [guideHidden, setGuideHidden] = useState(false);
  const [roomToOpen, setRoomToOpen] = useState<string | null>(null);
  const [dmTarget, setDmTarget] = useState<string | null>(null); // someone to open a direct message with

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-brand-500 mx-auto" />
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <AuthPage />;
  }

  // Redirect non-admins away from admin page
  const effectivePage = (page === 'admin' || page === 'analytics') && profile.role === 'student' ? 'home' : page;

  // New people get the guide once (choose college, get verified, join a room). Closing or finishing it ends it.
  const endGuide = async () => {
    setGuideHidden(true);
    await supabase.from('profiles').update({ onboarding_done: true }).eq('id', profile.id);
    refreshProfile();
  };
  const finishGuide = (room?: ChatRoom) => {
    endGuide();
    if (room) setRoomToOpen(room.id);
    setPage('chat');
  };

  return (
    <DirectMessageProvider onOpen={(userId) => { setDmTarget(userId); setPage('messages'); }}>
    <Layout currentPage={effectivePage} onPageChange={setPage}>
      {!profile.onboarding_done && !guideHidden && <OnboardingWizard onClose={endGuide} onFinish={finishGuide} />}
      {effectivePage === 'home' && <HomePage onNavigate={setPage} />}
      {effectivePage === 'chat' && <ChatPage initialRoomId={roomToOpen} onInitialRoomHandled={() => setRoomToOpen(null)} />}
      {effectivePage === 'messages' && <MessagesPage targetUserId={dmTarget} onTargetHandled={() => setDmTarget(null)} />}
      {effectivePage === 'colleges' && <CollegesPage />}
      {effectivePage === 'events' && <EventsPage />}
      {effectivePage === 'gallery' && <GalleryPage />}
      {effectivePage === 'admin' && <AdminPage />}
      {effectivePage === 'profile' && <ProfilePage />}
      {effectivePage === 'community' && <CommunityPage />}
      {effectivePage === 'hub' && <CampusHubPage />}
      {effectivePage === 'planner' && <PlannerPage />}
      {effectivePage === 'collaborate' && <CollaboratePage />}
      {effectivePage === 'growth' && <StudentGrowthPage onNavigate={setPage} />}
      {effectivePage === 'campusplus' && <CampusPlusPage onNavigate={setPage} />}
      {effectivePage === 'studydesk' && <AIStudyToolsPage />}
      {effectivePage === 'personalized' && <PersonalizedDashboardPage />}
      {effectivePage === 'careercoach' && <CareerCoachPage />}
      {effectivePage === 'navigator' && <CampusNavigatorPage />}
      {effectivePage === 'tutoring' && <TutoringPage />}
      {effectivePage === 'projecthub' && <ProjectHubPage />}
      {effectivePage === 'helpdesk' && <CampusHelpdeskPage />}
      {effectivePage === 'analytics' && <AdminAnalyticsPage />}
    </Layout>
    </DirectMessageProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
