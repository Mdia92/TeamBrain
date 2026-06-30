import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  MapPin, 
  Award, 
  Sparkles,
  X,
  CheckCircle,
  UserCheck,
  Building
} from 'lucide-react';
import { OrgId } from '../types';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  location: string;
  status: 'actif' | 'deplacement' | 'conge';
  email: string;
  phone: string;
  avatar: string; // Initials
  score: number; // Contribution count
}

interface TeamViewProps {
  activeOrgId: OrgId;
  addToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

export default function TeamView({ activeOrgId, addToast }: TeamViewProps) {
  // Mock Directory Data organized by Org ID
  const [teamData, setTeamData] = useState<Record<OrgId, TeamMember[]>>({
    ngo: [
      { id: 'ngo-tm1', name: 'Fatoumata Traoré', role: 'Directrice de Projet', location: 'Bamako, Mali', status: 'actif', email: 'f.traore@visionsahel.org', phone: '+223 76 54 32 10', avatar: 'FT', score: 88 },
      { id: 'ngo-tm2', name: 'Ousmane Diallo', role: 'Superviseur Logistique', location: 'Mopti, Mali', status: 'actif', email: 'o.diallo@visionsahel.org', phone: '+223 66 12 45 89', avatar: 'OD', score: 74 },
      { id: 'ngo-tm3', name: 'Mariam Koné', role: 'Nutritionniste de Zone', location: 'Ségou, Mali', status: 'deplacement', email: 'm.kone@visionsahel.org', phone: '+223 79 33 22 11', avatar: 'MK', score: 62 },
      { id: 'ngo-tm4', name: 'Kadidia Dembélé', role: 'Relais Sanitaire', location: 'San, Mali', status: 'conge', email: 'k.dembele@visionsahel.org', phone: '+223 60 88 77 66', avatar: 'KD', score: 50 },
      { id: 'ngo-tm5', name: 'Amadou Sidibé', role: 'Relations Publiques', location: 'Kayes, Mali', status: 'actif', email: 'a.sidibe@visionsahel.org', phone: '+223 71 44 55 66', avatar: 'AS', score: 45 }
    ],
    hotel: [
      { id: 'hotel-tm1', name: 'Chantal Agon', role: 'Gouvernante Générale', location: 'Cotonou, Bénin', status: 'actif', email: 'c.agon@azalai-cotonou.com', phone: '+229 97 12 34 56', avatar: 'CA', score: 92 },
      { id: 'hotel-tm2', name: 'Ephrem Codjia', role: 'Directeur d\'Événements', location: 'Cotonou, Bénin', status: 'actif', email: 'e.codjia@azalai-cotonou.com', phone: '+229 95 66 77 88', avatar: 'EC', score: 78 },
      { id: 'hotel-tm3', name: 'Chef Koffi', role: 'Chef Exécutif', location: 'Cotonou, Bénin', status: 'actif', email: 'koffi.chef@azalai-cotonou.com', phone: '+229 90 44 33 22', avatar: 'CK', score: 65 },
      { id: 'hotel-tm4', name: 'Ablaye Sène', role: 'Chef Sommelier', location: 'Porto-Novo, Bénin', status: 'deplacement', email: 'a.sene@azalai-cotonou.com', phone: '+229 96 11 22 33', avatar: 'AS', score: 54 },
      { id: 'hotel-tm5', name: 'Awa Diop', role: 'Directrice Générale', location: 'Cotonou, Bénin', status: 'actif', email: 'a.diop@azalai-cotonou.com', phone: '+229 91 55 66 77', avatar: 'AD', score: 85 }
    ],
    agency: [
      { id: 'agency-tm1', name: 'Yasmine Sylla', role: 'Directrice Artistique', location: 'Abidjan, Côte d\'Ivoire', status: 'actif', email: 'y.sylla@delta-agency.ci', phone: '+225 07 45 88 99', avatar: 'YS', score: 95 },
      { id: 'agency-tm2', name: 'Marc Kouadio', role: 'Lead UI/UX Designer', location: 'Abidjan, Côte d\'Ivoire', status: 'actif', email: 'm.kouadio@delta-agency.ci', phone: '+225 05 12 34 78', avatar: 'MK', score: 82 },
      { id: 'agency-tm3', name: 'Aminata Bamba', role: 'Directrice Conseil', location: 'Bouaké, Côte d\'Ivoire', status: 'deplacement', email: 'a.bamba@delta-agency.ci', phone: '+225 01 99 88 77', avatar: 'AB', score: 70 },
      { id: 'agency-tm4', name: 'Koffi Mensah', role: 'Monteur & Motion Designer', location: 'Abidjan, Côte d\'Ivoire', status: 'actif', email: 'k.mensah@delta-agency.ci', phone: '+225 07 22 33 44', avatar: 'KM', score: 48 }
    ],
    restaurant: [
      { id: 'rest-tm1', name: 'Chef Moussa', role: 'Chef de Cuisine', location: 'Dakar, Sénégal', status: 'actif', email: 'chef.moussa@bistrodakar.sn', phone: '+221 77 123 45 67', avatar: 'CM', score: 98 },
      { id: 'rest-tm2', name: 'Ibrahima Ndiaye', role: 'Responsable Approvisionnement', location: 'Rufisque, Sénégal', status: 'actif', email: 'i.ndiaye@bistrodakar.sn', phone: '+221 70 888 22 11', avatar: 'IN', score: 80 },
      { id: 'rest-tm3', name: 'Khadija Sow', role: 'Maître d\'Hôtel', location: 'Dakar, Sénégal', status: 'actif', email: 'k.sow@bistrodakar.sn', phone: '+221 76 555 44 33', avatar: 'KS', score: 64 },
      { id: 'rest-tm4', name: 'Babacar Fall', role: 'Chef de Partie Froid', location: 'Dakar, Sénégal', status: 'conge', email: 'b.fall@bistrodakar.sn', phone: '+221 77 222 99 88', avatar: 'BF', score: 52 }
    ]
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Member Form State
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('');
  const [newMemberLocation, setNewMemberLocation] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');

  const activeMembers = teamData[activeOrgId] || [];

  // Filtering
  const filteredMembers = activeMembers.filter(member => 
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Add Member
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberRole.trim() || !newMemberEmail.trim()) {
      addToast("Veuillez remplir les champs obligatoires", "error");
      return;
    }

    // Initials helper
    const initials = newMemberName
      .split(' ')
      .map(n => n.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'M';

    const createdMember: TeamMember = {
      id: `tm-${Date.now()}`,
      name: newMemberName,
      role: newMemberRole,
      location: newMemberLocation || 'Dakar, Sénégal',
      status: 'actif',
      email: newMemberEmail,
      phone: newMemberPhone || '+221 77 000 00 00',
      avatar: initials,
      score: 10
    };

    setTeamData(prev => ({
      ...prev,
      [activeOrgId]: [...(prev[activeOrgId] || []), createdMember]
    }));

    addToast(`Membre invité avec succès : ${newMemberName}`, 'success');
    setShowAddModal(false);

    // Reset Form
    setNewMemberName('');
    setNewMemberRole('');
    setNewMemberLocation('');
    setNewMemberEmail('');
    setNewMemberPhone('');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      
      {/* Search and Action Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-6 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            Annuaire et Membres d'Équipe
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Gérez les accès, affectez les rôles opérationnels et suivez l'implication dans la mémoire d'équipe.</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              id="team-search-bar"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, rôle..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <button
            id="open-invite-member-btn"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Inviter un Membre
          </button>
        </div>
      </div>

      {/* Members Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {filteredMembers.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Aucun membre trouvé</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Essayez d'ajuster votre recherche ou invitez un nouveau collaborateur.</p>
          </div>
        ) : (
          filteredMembers.map((member) => (
            <div 
              key={member.id}
              id={`member-card-${member.id}`}
              onClick={() => setSelectedMember(member)}
              className="p-5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl hover:shadow-md hover:scale-[1.01] transition-all duration-200 flex flex-col justify-between cursor-pointer group relative overflow-hidden"
            >
              {/* Card top elements */}
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {/* Initials Avatar */}
                    <div className="w-11 h-11 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-extrabold text-sm flex items-center justify-center border border-indigo-100 dark:border-indigo-500/20 shadow-xs">
                      {member.avatar}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {member.name}
                      </h3>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{member.role}</p>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize shrink-0
                    ${member.status === 'actif' 
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/20' 
                      : member.status === 'deplacement'
                      ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300/20'}`}
                  >
                    {member.status === 'actif' ? 'En ligne' : member.status === 'deplacement' ? 'Terrain' : 'Congé'}
                  </span>
                </div>

                {/* Info block */}
                <div className="space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{member.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{member.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{member.phone}</span>
                  </div>
                </div>
              </div>

              {/* Card Bottom: Indexations count score */}
              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] font-bold text-slate-400">
                <span className="flex items-center gap-1 font-mono">
                  <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  Score d'indexation IA
                </span>
                <span className="text-slate-700 dark:text-slate-300 font-mono">
                  {member.score} contributions
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Member Profile Drawer Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative overflow-hidden animate-in zoom-in-95 duration-150">
            <button 
              onClick={() => setSelectedMember(null)}
              className="absolute right-4 top-4 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-755 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Visual Header */}
            <div className="flex flex-col items-center text-center space-y-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white font-extrabold text-lg flex items-center justify-center shadow-md">
                {selectedMember.avatar}
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-none">{selectedMember.name}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">{selectedMember.role}</p>
              </div>

              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider
                ${selectedMember.status === 'actif' 
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/20' 
                  : selectedMember.status === 'deplacement'
                  ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300/20'}`}
              >
                {selectedMember.status === 'actif' ? 'Disponible (En ligne)' : selectedMember.status === 'deplacement' ? 'Sur le terrain (GPS)' : 'Hors ligne'}
              </span>
            </div>

            {/* Details Directory */}
            <div className="space-y-3.5 py-5 text-xs text-slate-600 dark:text-slate-300">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Détails de contact</span>
              
              <div className="flex items-center gap-3">
                <MapPin className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                <span className="font-semibold">{selectedMember.location}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                <a href={`mailto:${selectedMember.email}`} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">{selectedMember.email}</a>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                <a href={`tel:${selectedMember.phone}`} className="font-semibold hover:underline">{selectedMember.phone}</a>
              </div>
              <div className="flex items-center gap-3">
                <Building className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                <span className="font-semibold">ID Membre : <span className="font-mono text-[11px] text-slate-400">{selectedMember.id}</span></span>
              </div>
            </div>

            {/* AI Summary Section of Member Activity */}
            <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-150 dark:border-indigo-500/15">
              <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                Rapport d'activité IA :
              </span>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed mt-1.5 italic">
                {selectedMember.name} a indexé {selectedMember.score} documents et décisions majeures. C'est l'un des piliers opérationnels clés de la structure.
              </p>
            </div>

            <button
              onClick={() => setSelectedMember(null)}
              className="w-full mt-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Fermer la fiche
            </button>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative overflow-hidden animate-in zoom-in-95 duration-150">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-755 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <UserCheck className="w-5 h-5 text-indigo-500" />
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Inviter un nouveau collaborateur</h3>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nom complet *</label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="ex: Aminata Touré"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              {/* Operational Role */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Poste opérationnel *</label>
                <input
                  type="text"
                  required
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  placeholder="ex: Adjointe Technique, Secrétaire de bord"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              {/* Location */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Localisation</label>
                <input
                  type="text"
                  value={newMemberLocation}
                  onChange={(e) => setNewMemberLocation(e.target.value)}
                  placeholder="ex: Bamako, Dakar, Abidjan..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              {/* Row: Contact fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Email *</label>
                  <input
                    type="email"
                    required
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="nom@entreprise.com"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Téléphone</label>
                  <input
                    type="text"
                    value={newMemberPhone}
                    onChange={(e) => setNewMemberPhone(e.target.value)}
                    placeholder="ex: +221 77 111 22 33"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center gap-2 justify-end pt-3 border-t border-slate-150 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  Envoyer l'invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
