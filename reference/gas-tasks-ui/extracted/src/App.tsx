import { useState, useEffect } from 'react';
import { 
  Menu, 
  X, 
  Brain, 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  Info,
  ShieldCheck
} from 'lucide-react';
import { OrgId, PendingAction, MemoryItem, DocItem, Organization } from './types';
import { MOCK_DATA, ORGANIZATIONS } from './data/mockData';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import ChatView from './components/ChatView';
import MemoryView from './components/MemoryView';
import DocumentsView from './components/DocumentsView';
import ProjectsView from './components/ProjectsView';
import AnnouncementsView from './components/AnnouncementsView';
import TeamView from './components/TeamView';
import SettingsView from './components/SettingsView';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

export default function App() {
  // Navigation & Org Switching States
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeOrgId, setActiveOrgId] = useState<OrgId>('ngo');
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Dynamic profile state for the organizations
  const [organizations, setOrganizations] = useState<Organization[]>(ORGANIZATIONS);

  // Core Data States - initialized from Mock Data and kept in memory to allow real-time edits
  const [pendingActions, setPendingActions] = useState<Record<OrgId, PendingAction[]>>(() => {
    const initial: Record<OrgId, PendingAction[]> = { ngo: [], hotel: [], agency: [], restaurant: [] };
    organizations.forEach(org => {
      initial[org.id] = [...(MOCK_DATA[org.id]?.pendingActions || [])];
    });
    return initial;
  });

  const [memories, setMemories] = useState<Record<OrgId, MemoryItem[]>>(() => {
    const initial: Record<OrgId, MemoryItem[]> = { ngo: [], hotel: [], agency: [], restaurant: [] };
    organizations.forEach(org => {
      initial[org.id] = [...(MOCK_DATA[org.id]?.memories || [])];
    });
    return initial;
  });

  const [documents, setDocuments] = useState<Record<OrgId, DocItem[]>>(() => {
    const initial: Record<OrgId, DocItem[]> = { ngo: [], hotel: [], agency: [], restaurant: [] };
    organizations.forEach(org => {
      initial[org.id] = [...(MOCK_DATA[org.id]?.documents || [])];
    });
    return initial;
  });

  // Global Toast State
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Find Active Org object
  const activeOrg = organizations.find(org => org.id === activeOrgId) || organizations[0];

  // Sync dark mode class with container
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Render active view based on tab state
  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            activeOrgId={activeOrgId}
            kpis={MOCK_DATA[activeOrgId]?.kpis || []}
            activities={MOCK_DATA[activeOrgId]?.activities || []}
            pendingActions={pendingActions[activeOrgId] || []}
            setPendingActions={setPendingActions}
            addToast={addToast}
          />
        );
      case 'chat':
        return (
          <ChatView
            activeOrgId={activeOrgId}
            documents={documents[activeOrgId] || []}
            addToast={addToast}
          />
        );
      case 'memory':
        return (
          <MemoryView
            activeOrgId={activeOrgId}
            memories={memories[activeOrgId] || []}
            setMemories={setMemories}
            addToast={addToast}
          />
        );
      case 'documents':
        return (
          <DocumentsView
            activeOrgId={activeOrgId}
            documents={documents[activeOrgId] || []}
            setDocuments={setDocuments}
            setActiveTab={setActiveTab}
            addToast={addToast}
          />
        );
      case 'projets':
        return (
          <ProjectsView
            activeOrgId={activeOrgId}
            addToast={addToast}
          />
        );
      case 'annonces':
        return (
          <AnnouncementsView
            activeOrgId={activeOrgId}
            addToast={addToast}
          />
        );
      case 'equipe':
        return (
          <TeamView
            activeOrgId={activeOrgId}
            addToast={addToast}
          />
        );
      case 'settings':
        return (
          <SettingsView
            activeOrgId={activeOrgId}
            organizations={organizations}
            setOrganizations={setOrganizations}
            addToast={addToast}
          />
        );
      default:
        return (
          <div className="p-8 text-center bg-white dark:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Écran en construction</h3>
            <p className="text-xs text-slate-500 mt-1">Cet écran de l'application est en cours de déploiement.</p>
          </div>
        );
    }
  };

  // Human-readable titles for headers
  const getTabHeaderTitle = () => {
    switch(activeTab) {
      case 'dashboard': return 'Tableau de bord';
      case 'chat': return 'Assistant IA Brainy';
      case 'memory': return 'Mémoire d\'Équipe';
      case 'documents': return 'Bibliothèque de Documents';
      case 'projets': return 'Projets & Tâches';
      case 'annonces': return 'Annonces d\'Équipe';
      case 'equipe': return 'Membres d\'Équipe';
      case 'settings': return 'Paramètres';
      default: return 'TeamBrain';
    }
  };

  return (
    <div className={`min-h-screen flex text-slate-800 dark:text-slate-100 font-sans transition-colors duration-250 bg-slate-50 dark:bg-slate-900`}>
      
      {/* Sidebar - Collapsible navigation & Switcher */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeOrgId={activeOrgId}
        setActiveOrgId={setActiveOrgId}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        organizations={organizations}
      />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Responsive Header for Mobile & Tablet */}
        <header className="flex items-center justify-between px-4 py-3 bg-slate-900 text-slate-100 border-b border-slate-800 shrink-0 lg:px-6 lg:bg-white lg:dark:bg-slate-900 lg:text-slate-950 lg:dark:text-white lg:border-slate-200 lg:dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button 
              id="mobile-sidebar-toggle-btn"
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white lg:hidden hover:bg-slate-800 focus:outline-hidden"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5.5 h-5.5" />
            </button>
            
            <div>
              <h1 className="text-sm lg:text-base font-extrabold tracking-tight text-slate-100 lg:text-slate-900 lg:dark:text-white flex items-center gap-1.5">
                {getTabHeaderTitle()}
              </h1>
              <p className="hidden sm:block text-[10px] text-slate-400 lg:text-slate-500 font-medium mt-0.5">
                {activeOrg.name} — {activeOrg.tagline}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 rounded-md">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              Mode Admin
            </div>
            
            <div className={`w-7.5 h-7.5 rounded-full ${activeOrg.avatar} text-white font-bold text-xs flex items-center justify-center shadow-xs border border-slate-700/50`}>
              {activeOrg.name.charAt(0)}
            </div>
          </div>
        </header>

        {/* Scrollable View Wrapper */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto h-full">
            {renderActiveView()}
          </div>
        </main>
      </div>

      {/* Toast Manager Overlay (Bottom Right) */}
      <div className="fixed bottom-4 right-4 z-55 space-y-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div 
            key={t.id}
            className={`p-3.5 rounded-lg border shadow-xl flex items-start gap-3 pointer-events-auto animate-in slide-in-from-bottom-5 duration-200
              ${t.type === 'success' 
                ? 'bg-emerald-50 dark:bg-slate-900 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-400' 
                : t.type === 'error'
                ? 'bg-rose-50 dark:bg-slate-900 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-400'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-indigo-500/30 text-slate-800 dark:text-indigo-300'}`}
          >
            <div className="shrink-0 mt-0.5">
              {t.type === 'success' && <CheckCircle className="w-4.5 h-4.5 text-emerald-500" />}
              {t.type === 'error' && <AlertCircle className="w-4.5 h-4.5 text-rose-500" />}
              {t.type === 'info' && <Info className="w-4.5 h-4.5 text-indigo-500 dark:text-indigo-400" />}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold leading-relaxed">
                {t.message}
              </p>
            </div>

            <button 
              id={`close-toast-${t.id}`}
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
