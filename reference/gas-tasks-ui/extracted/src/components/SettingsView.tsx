import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  ToggleLeft, 
  ToggleRight, 
  Sparkles, 
  Building, 
  WifiOff, 
  ShieldCheck, 
  BellRing,
  Trash2
} from 'lucide-react';
import { OrgId, Organization } from '../types';

interface SettingsViewProps {
  activeOrgId: OrgId;
  organizations: Organization[];
  setOrganizations: React.Dispatch<React.SetStateAction<Organization[]>>;
  addToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

export default function SettingsView({ 
  activeOrgId, 
  organizations, 
  setOrganizations, 
  addToast 
}: SettingsViewProps) {
  const currentOrg = organizations.find(o => o.id === activeOrgId);

  // Profile Form States
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');

  // Preferences States (Switches)
  const [liveSync, setLiveSync] = useState(true);
  const [autoIndexing, setAutoIndexing] = useState(true);
  const [offlineOptimization, setOfflineOptimization] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Sync state with active organization changes
  useEffect(() => {
    if (currentOrg) {
      setName(currentOrg.name);
      setTagline(currentOrg.tagline);
      setIndustry(currentOrg.industry);
      setLocation(currentOrg.location);
    }
  }, [activeOrgId, currentOrg]);

  // Handle Save Profile
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !tagline.trim()) {
      addToast("Le nom et le slogan sont obligatoires", "error");
      return;
    }

    setOrganizations(prev => 
      prev.map(org => {
        if (org.id === activeOrgId) {
          return {
            ...org,
            name,
            tagline,
            industry,
            location
          };
        }
        return org;
      })
    );

    addToast(`Paramètres de l'organisation "${name}" enregistrés !`, "success");
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      
      {/* Settings Header */}
      <div className="p-6 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-500 animate-spin-slow" />
          Paramètres Généraux
        </h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Configurez le profil de votre organisation, ajustez l'indexation IA et optimisez les performances réseau.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Organization Profile Edit (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            Identité de la structure
          </span>

          <form 
            onSubmit={handleSaveProfile}
            className="p-6 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
          >
            {/* Org Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                Nom de l'Organisation *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom officiel de votre structure"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            {/* Slogan / Tagline */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Slogan d'Équipe / Mission *</label>
              <input
                type="text"
                required
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="ex: Sécuriser l'accès à l'eau potable..."
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            {/* Row: Industry & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Secteur d'activité</label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="ex: NGO, Hôtellerie, Agence..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Siège Social / Géolocalisation</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="ex: Bamako, Mali"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            </div>

            {/* Submit save button */}
            <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Enregistrer le profil
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Preferences, Switches, Offline & Security Options (1/3 width) */}
        <div className="space-y-6">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            Préférences système
          </span>

          <div className="p-6 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            
            {/* Preference: Live Synchronization */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1">
                  <BellRing className="w-3.5 h-3.5 text-slate-400" />
                  Synchronisation Directe
                </h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">Permet la mise à jour des activités et notifications d'équipe en continu.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLiveSync(!liveSync);
                  addToast(liveSync ? "Synchronisation directe désactivée" : "Synchronisation directe activée", "info");
                }}
                className="text-indigo-600 dark:text-indigo-400 focus:outline-hidden cursor-pointer shrink-0"
              >
                {liveSync ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9 text-slate-300 dark:text-slate-750" />}
              </button>
            </div>

            {/* Preference: Auto AI Indexing */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  Indexation Auto IA
                </h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">Génère automatiquement des résumés d'équipe à chaque document téléversé.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAutoIndexing(!autoIndexing);
                  addToast(autoIndexing ? "Indexation sémantique IA désactivée" : "Indexation sémantique IA activée", "info");
                }}
                className="text-indigo-600 dark:text-indigo-400 focus:outline-hidden cursor-pointer shrink-0"
              >
                {autoIndexing ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9 text-slate-300 dark:text-slate-755" />}
              </button>
            </div>

            {/* Preference: Offline Optimization */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1">
                  <WifiOff className="w-3.5 h-3.5 text-slate-400" />
                  Optimisation Hors-Ligne
                </h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">Idéal pour les zones rurales à faible connectivité. Compresse l'usage des données.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOfflineOptimization(!offlineOptimization);
                  addToast(offlineOptimization ? "Optimisation bas débit désactivée" : "Optimisation bas débit (basse bande passante) activée !", "success");
                }}
                className="text-indigo-600 dark:text-indigo-400 focus:outline-hidden cursor-pointer shrink-0"
              >
                {offlineOptimization ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9 text-slate-300 dark:text-slate-755" />}
              </button>
            </div>

            {/* Preference: Inbound Notifications */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  Sécurité d'Accès
                </h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">Exige une double signature pour l'approbation des notes de frais financières.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNotificationsEnabled(!notificationsEnabled);
                  addToast(notificationsEnabled ? "Double signature de sécurité désactivée" : "Double signature de sécurité activée", "info");
                }}
                className="text-indigo-600 dark:text-indigo-400 focus:outline-hidden cursor-pointer shrink-0"
              >
                {notificationsEnabled ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9 text-slate-300 dark:text-slate-755" />}
              </button>
            </div>

            {/* Danger Zone */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => addToast("La réinitialisation complète de la mémoire d'équipe exige des privilèges de super-admin.", "error")}
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/15 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Réinitialiser la mémoire
              </button>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
