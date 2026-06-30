import React, { useState } from 'react';
import { 
  Megaphone, 
  ThumbsUp, 
  MessageSquare, 
  Calendar, 
  User, 
  AlertCircle, 
  Info, 
  Sparkles,
  Plus,
  Send,
  Heart
} from 'lucide-react';
import { OrgId } from '../types';

interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  role: string;
  date: string;
  type: 'urgent' | 'info' | 'event';
  likes: number;
  likedByUser: boolean;
}

interface AnnouncementsViewProps {
  activeOrgId: OrgId;
  addToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

export default function AnnouncementsView({ activeOrgId, addToast }: AnnouncementsViewProps) {
  const [announcementsData, setAnnouncementsData] = useState<Record<OrgId, Announcement[]>>({
    ngo: [
      {
        id: 'ngo-a1',
        title: 'Campagne de vaccination validée par le Ministère',
        content: 'Le Ministère de la Santé du Mali a validé notre planning révisé pour la campagne de vaccination et de distribution nutritionnelle à Mopti. Nous commençons officiellement la semaine prochaine !',
        author: 'Fatoumata Traoré',
        role: 'Directrice de Projet',
        date: 'Il y a 2 heures',
        type: 'urgent',
        likes: 18,
        likedByUser: false,
      },
      {
        id: 'ngo-a2',
        title: 'Forage Kayes : convention de San approuvée',
        content: 'Le conseil municipal de San a validé la concession foncière gratuite pour l\'implantation du forage profond. C\'est une étape cruciale franchie grâce à Amadou Sidibé !',
        author: 'Amadou Sidibé',
        role: 'Responsable Relations Publiques',
        date: 'Hier',
        type: 'event',
        likes: 12,
        likedByUser: false,
      }
    ],
    hotel: [
      {
        id: 'hotel-a1',
        title: 'Arrivée de la délégation CEDEAO ce soir',
        content: 'La première vague de ministres de l\'UEMOA arrive ce soir à 18h00. Toutes les équipes de réception et de service en salle doivent être en tenue de gala de prestige.',
        author: 'Ephrem Codjia',
        role: 'Directeur d\'Événements',
        date: 'Il y a 3 heures',
        type: 'urgent',
        likes: 24,
        likedByUser: false,
      },
      {
        id: 'hotel-a2',
        title: 'Partenariat Allada officiellement signé !',
        content: 'Le Chef Koffi a signé le contrat d\'achat 100% direct avec la coopérative agricole. Les premiers paniers bio arrivent demain matin pour garnir nos buffets.',
        author: 'Chef Koffi',
        role: 'Chef Exécutif',
        date: 'Hier',
        type: 'event',
        likes: 15,
        likedByUser: false,
      }
    ],
    agency: [
      {
        id: 'agency-a1',
        title: 'Pitch Orange Money : Succès total !',
        content: 'Le client a validé notre axe publicitaire "Afro-optimiste" ciblant les jeunes entrepreneurs. Félicitations à toute l\'équipe pour cette victoire majeure !',
        author: 'Aminata Bamba',
        role: 'Directrice Conseil',
        date: 'Il y a 1 heure',
        type: 'event',
        likes: 35,
        likedByUser: false,
      },
      {
        id: 'agency-a2',
        title: 'Migration collective Figma terminée',
        content: 'Tous nos comptes créatifs ont été fusionnés sur l\'espace Figma Enterprise de l\'agence. Pensez à vérifier vos invitations par email.',
        author: 'Marc Kouadio',
        role: 'Lead UI/UX Designer',
        date: 'Il y a 2 jours',
        type: 'info',
        likes: 8,
        likedByUser: false,
      }
    ],
    restaurant: [
      {
        id: 'rest-a1',
        title: 'Menu de la Tabaski validé en brigade',
        content: 'Le Chef Moussa a finalisé les fiches techniques du menu spécial méchoui et grillades d\'agneau d\'Afrique de l\'Ouest. Les réservations sont officiellement ouvertes !',
        author: 'Chef Moussa',
        role: 'Chef de Cuisine',
        date: 'Il y a 4 heures',
        type: 'event',
        likes: 16,
        likedByUser: false,
      },
      {
        id: 'rest-a2',
        title: 'Rupture de Thiof réglée par le mérou noir',
        content: 'Devant la flambée des tarifs d\'importation, nous servons désormais le mérou noir frais issu de la pêche artisanale locale de Soumbédioune. Retours clients fantastiques !',
        author: 'Ibrahima Ndiaye',
        role: 'Directeur d\'Approvisionnement',
        date: 'Hier',
        type: 'urgent',
        likes: 11,
        likedByUser: false,
      }
    ]
  });

  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<'urgent' | 'info' | 'event'>('info');

  const activeAnnouncements = announcementsData[activeOrgId] || [];

  // Like Toggle Function
  const handleLike = (id: string) => {
    setAnnouncementsData(prev => {
      const list = prev[activeOrgId] || [];
      const updatedList = list.map(item => {
        if (item.id === id) {
          const nextLiked = !item.likedByUser;
          const nextCount = nextLiked ? item.likes + 1 : item.likes - 1;
          
          if (nextLiked) {
            addToast(`Vous avez aimé l'annonce !`, "success");
          }
          return {
            ...item,
            likedByUser: nextLiked,
            likes: nextCount
          };
        }
        return item;
      });

      return {
        ...prev,
        [activeOrgId]: updatedList
      };
    });
  };

  // Publish Announcement
  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      addToast("Veuillez remplir le titre et le contenu.", "error");
      return;
    }

    const createdAnn: Announcement = {
      id: `ann-${Date.now()}`,
      title: newTitle,
      content: newContent,
      author: 'Amadou Diallo',
      role: 'Administrateur',
      date: 'À l\'instant',
      type: newType,
      likes: 0,
      likedByUser: false
    };

    setAnnouncementsData(prev => ({
      ...prev,
      [activeOrgId]: [createdAnn, ...(prev[activeOrgId] || [])]
    }));

    addToast(`Annonce publiée : "${newTitle}"`, 'success');
    
    // Reset Form
    setNewTitle('');
    setNewContent('');
    setNewType('info');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      
      {/* Search and Layout Header */}
      <div className="p-6 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-indigo-500" />
          Annonces d'Équipe et Bulletins
        </h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Partagez les décisions majeures, les victoires de projets et les directives de coordination en temps réel.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Feed of announcements (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            Fil de discussion interne ({activeAnnouncements.length} annonces)
          </span>

          {activeAnnouncements.map((ann) => (
            <div 
              key={ann.id}
              className={`p-5 rounded-xl border bg-white dark:bg-slate-850 shadow-xs transition-all duration-200 relative group hover:shadow-md
                ${ann.type === 'urgent' 
                  ? 'border-rose-200 dark:border-rose-500/20 bg-rose-50/10 dark:bg-rose-500/5' 
                  : ann.type === 'event'
                  ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-500/5'
                  : 'border-slate-200 dark:border-slate-800'}`}
            >
              {/* Top Row: Type and Date */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border
                  ${ann.type === 'urgent' 
                    ? 'bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200/20' 
                    : ann.type === 'event'
                    ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/20'
                    : 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200/20'}`}
                >
                  {ann.type === 'urgent' ? 'Urgent' : ann.type === 'event' ? 'Événement' : 'Information'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">{ann.date}</span>
              </div>

              {/* Title & Content */}
              <div className="mt-3">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {ann.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-2 whitespace-pre-line">
                  {ann.content}
                </p>
              </div>

              {/* Author and Like Controls Footer */}
              <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-[10px] text-slate-600 dark:text-slate-300">
                    {ann.author.charAt(0)}
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-700 dark:text-slate-200 leading-none">{ann.author}</span>
                    <span className="text-[9px] text-slate-400 leading-none mt-0.5 block">{ann.role}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    id={`like-btn-${ann.id}`}
                    onClick={() => handleLike(ann.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer hover:scale-105
                      ${ann.likedByUser 
                        ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300/30 text-rose-600 dark:text-rose-400' 
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'}`}
                  >
                    <Heart className={`w-3.5 h-3.5 shrink-0 ${ann.likedByUser ? 'fill-rose-500 text-rose-500 animate-pulse' : ''}`} />
                    <span>{ann.likes} Likes</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right column: Create announcement form (1/3 width) */}
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block mb-4">
            Publier une directive
          </span>

          <form 
            onSubmit={handlePublish}
            className="p-5 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
          >
            {/* Title */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Titre de l'annonce *</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="ex: Lancement de la campagne ou réunion de crise"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            {/* Type Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Catégorie</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['info', 'urgent', 'event'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewType(type)}
                    className={`py-1.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer uppercase tracking-wider
                      ${newType === type
                        ? type === 'urgent'
                          ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500'
                          : type === 'event'
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500'
                          : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                  >
                    {type === 'urgent' ? 'Urgent' : type === 'event' ? 'Évent' : 'Info'}
                  </button>
                ))}
              </div>
            </div>

            {/* Content text */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Contenu du message *</label>
              <textarea
                required
                rows={5}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Rédigez votre bulletin d'équipe..."
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 resize-none"
              />
            </div>

            {/* Submit btn */}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <Megaphone className="w-4 h-4" />
              Publier l'annonce
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}
