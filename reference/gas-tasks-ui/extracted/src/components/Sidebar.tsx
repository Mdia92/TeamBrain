import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Layers, 
  MessageSquare, 
  Brain, 
  Folder, 
  Settings, 
  Users, 
  Map, 
  Bell, 
  Sun, 
  Moon, 
  Building2, 
  Check, 
  Sparkles,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { Organization, OrgId } from '../types';
import { ORGANIZATIONS } from '../data/mockData';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeOrgId: OrgId;
  setActiveOrgId: (id: OrgId) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  organizations: Organization[];
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  activeOrgId,
  setActiveOrgId,
  darkMode,
  setDarkMode,
  sidebarOpen,
  setSidebarOpen,
  organizations
}: SidebarProps) {
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    travail: false,
    communication: false,
    intelligence: false,
    admin: false,
  });

  const activeOrg = organizations.find(o => o.id === activeOrgId) || organizations[0];

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const handleOrgChange = (id: OrgId) => {
    setActiveOrgId(id);
    setOrgDropdownOpen(false);
  };

  const menuItems = {
    travail: [
      { id: 'dashboard', label: 'Tableau de bord', icon: Layers, screen: 'dashboard' },
      { id: 'projets', label: 'Projets & Tâches', icon: Zap, screen: 'projets' },
    ],
    communication: [
      { id: 'chat', label: 'Chat IA Assistant', icon: MessageSquare, screen: 'chat' },
      { id: 'annonces', label: 'Annonces d\'Équipe', icon: Bell, screen: 'annonces' },
    ],
    intelligence: [
      { id: 'memory', label: 'Mémoire Collective', icon: Brain, screen: 'memory' },
      { id: 'documents', label: 'Bibliothèque Docs', icon: Folder, screen: 'documents' },
    ],
    admin: [
      { id: 'equipe', label: 'Membres d\'Équipe', icon: Users, screen: 'equipe' },
      { id: 'settings', label: 'Paramètres', icon: Settings, screen: 'settings' },
    ]
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 flex flex-col w-72 h-full bg-slate-900 text-slate-100 border-r border-slate-800 transition-transform duration-300 lg:static lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Top Org Switcher Section */}
        <div className="relative p-4 border-b border-slate-800">
          <button 
            id="org-switcher-btn"
            onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
            className="flex items-center justify-between w-full p-2 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-750 transition-all duration-200 text-left focus:outline-hidden"
          >
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-8 h-8 rounded-md font-bold text-white shadow-sm ${activeOrg.avatar}`}>
                {activeOrg.name.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <h2 className="text-sm font-semibold truncate text-slate-100">{activeOrg.name}</h2>
                <p className="text-xs text-slate-400 truncate">{activeOrg.location}</p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${orgDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Org Selector Dropdown */}
          {orgDropdownOpen && (
            <div className="absolute left-4 right-4 top-16 z-50 mt-1 py-1 rounded-lg bg-slate-850 border border-slate-750 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                Changer d'organisation
              </div>
              {organizations.map((org) => (
                <button
                  key={org.id}
                  id={`org-select-${org.id}`}
                  onClick={() => handleOrgChange(org.id)}
                  className={`flex items-center justify-between w-full px-3 py-2.5 text-left hover:bg-slate-800 transition-colors ${org.id === activeOrgId ? 'bg-slate-800/60' : ''}`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`flex items-center justify-center w-7 h-7 rounded-sm font-bold text-xs text-white shrink-0 ${org.avatar}`}>
                      {org.name.charAt(0)}
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs font-semibold text-slate-200 truncate">{org.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{org.tagline}</div>
                    </div>
                  </div>
                  {org.id === activeOrgId && (
                    <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Brand Header */}
        <div className="flex items-center gap-2 px-6 py-4 bg-slate-950/40">
          <div className="p-1.5 rounded-md bg-indigo-600/20 border border-indigo-500/30">
            <Brain className="w-5 h-5 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-amber-300 bg-clip-text text-transparent">TeamBrain</span>
            <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest">Afrique</span>
          </div>
        </div>

        {/* Scrollable Navigation Area */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          
          {/* Group 1: Travail */}
          <div>
            <button 
              id="group-travail-btn"
              onClick={() => toggleGroup('travail')}
              className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase hover:text-slate-200 transition-colors"
            >
              <span>Travail</span>
              {collapsedGroups.travail ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {!collapsedGroups.travail && (
              <div className="mt-1.5 space-y-0.5">
                {menuItems.travail.map(item => {
                  const isActive = activeTab === item.screen;
                  return (
                    <button
                      key={item.id}
                      id={`nav-${item.id}`}
                      onClick={() => {
                        setActiveTab(item.screen);
                        setSidebarOpen(false);
                      }}
                      className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 group
                        ${isActive 
                          ? 'bg-indigo-600 text-white font-semibold shadow-xs shadow-indigo-600/25' 
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                    >
                      <item.icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Group 2: Communication */}
          <div>
            <button 
              id="group-communication-btn"
              onClick={() => toggleGroup('communication')}
              className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase hover:text-slate-200 transition-colors"
            >
              <span>Communication</span>
              {collapsedGroups.communication ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {!collapsedGroups.communication && (
              <div className="mt-1.5 space-y-0.5">
                {menuItems.communication.map(item => {
                  const isActive = activeTab === item.screen;
                  return (
                    <button
                      key={item.id}
                      id={`nav-${item.id}`}
                      onClick={() => {
                        setActiveTab(item.screen);
                        setSidebarOpen(false);
                      }}
                      className={`flex items-center justify-between w-full px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 group
                        ${isActive 
                          ? 'bg-indigo-600 text-white font-semibold shadow-xs shadow-indigo-600/25' 
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <item.icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.id === 'chat' && (
                        <span className="flex items-center justify-center h-4 px-1.5 text-[9px] font-bold text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 rounded-full">
                          LIVE
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Group 3: Intelligence */}
          <div>
            <button 
              id="group-intelligence-btn"
              onClick={() => toggleGroup('intelligence')}
              className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase hover:text-slate-200 transition-colors"
            >
              <span>Intelligence</span>
              {collapsedGroups.intelligence ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {!collapsedGroups.intelligence && (
              <div className="mt-1.5 space-y-0.5">
                {menuItems.intelligence.map(item => {
                  const isActive = activeTab === item.screen;
                  return (
                    <button
                      key={item.id}
                      id={`nav-${item.id}`}
                      onClick={() => {
                        setActiveTab(item.screen);
                        setSidebarOpen(false);
                      }}
                      className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 group
                        ${isActive 
                          ? 'bg-indigo-600 text-white font-semibold shadow-xs shadow-indigo-600/25' 
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                    >
                      <item.icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Group 4: Administration */}
          <div>
            <button 
              id="group-admin-btn"
              onClick={() => toggleGroup('admin')}
              className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase hover:text-slate-200 transition-colors"
            >
              <span>Administration</span>
              {collapsedGroups.admin ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {!collapsedGroups.admin && (
              <div className="mt-1.5 space-y-0.5">
                {menuItems.admin.map(item => {
                  const isActive = activeTab === item.screen;
                  return (
                    <button
                      key={item.id}
                      id={`nav-${item.id}`}
                      onClick={() => {
                        setActiveTab(item.screen);
                        setSidebarOpen(false);
                      }}
                      className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 group
                        ${isActive 
                          ? 'bg-indigo-600 text-white font-semibold shadow-xs shadow-indigo-600/25' 
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                    >
                      <item.icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </nav>

        {/* Bottom User Area */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between gap-2">
            
            {/* User Profile Card */}
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-indigo-500/10 border-2 border-slate-700 font-bold text-indigo-300 text-sm shrink-0">
                AD
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-semibold text-slate-200 truncate">Amadou Diallo</div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                  <ShieldCheck className="w-3 h-3 text-indigo-400 shrink-0" />
                  Administrateur
                </div>
              </div>
            </div>

            {/* Light / Dark Mode Toggle */}
            <button
              id="theme-toggle-btn"
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={darkMode ? "Passer en mode clair" : "Passer en mode sombre"}
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            </button>
            
          </div>
        </div>
      </aside>
    </>
  );
}
