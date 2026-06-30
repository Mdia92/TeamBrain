import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Brain, 
  CheckCircle, 
  ShieldAlert, 
  AlertTriangle,
  Lightbulb,
  X,
  Sparkles,
  Award,
  Filter,
  Calendar,
  Grid
} from 'lucide-react';
import { OrgId, MemoryItem, MemoryType } from '../types';

interface MemoryViewProps {
  activeOrgId: OrgId;
  memories: MemoryItem[];
  setMemories: React.Dispatch<React.SetStateAction<Record<OrgId, MemoryItem[]>>>;
  addToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

export default function MemoryView({
  activeOrgId,
  memories,
  setMemories,
  addToast
}: MemoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | MemoryType>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Memory Form State
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<MemoryType>('decision');
  const [newDesc, setNewDesc] = useState('');
  const [newStrength, setNewStrength] = useState(4);
  const [newCategory, setNewCategory] = useState('');
  const [newTags, setNewTags] = useState('');

  // Filtering Logic
  const filteredMemories = memories.filter(item => {
    const matchesSearch = 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = selectedType === 'all' || item.type === selectedType;

    return matchesSearch && matchesType;
  });

  const handleCreateMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim() || !newCategory.trim()) {
      addToast("Veuillez remplir tous les champs obligatoires.", "error");
      return;
    }

    const tagsArray = newTags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const newMemory: MemoryItem = {
      id: `mem-custom-${Date.now()}`,
      type: newType,
      title: newTitle,
      description: newDesc,
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
      strength: newStrength,
      category: newCategory,
      tags: tagsArray.length > 0 ? tagsArray : [newCategory]
    };

    setMemories(prev => ({
      ...prev,
      [activeOrgId]: [newMemory, ...(prev[activeOrgId] || [])]
    }));

    addToast(`Mémoire enregistrée : "${newTitle}"`, "success");
    setShowAddModal(false);

    // Reset Form
    setNewTitle('');
    setNewType('decision');
    setNewDesc('');
    setNewStrength(4);
    setNewCategory('');
    setNewTags('');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      
      {/* Search and Action Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-6 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        
        {/* Semantic Search input */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            id="memory-search-bar"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par sémantique ou mots-clés (ex: forage, budget, Allada...)"
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>

        {/* Filter Quick Tags & Add Action */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              id="filter-mem-all"
              onClick={() => setSelectedType('all')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer
                ${selectedType === 'all' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Tous
            </button>
            <button
              id="filter-mem-decision"
              onClick={() => setSelectedType('decision')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer
                ${selectedType === 'decision' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Décisions
            </button>
            <button
              id="filter-mem-commitment"
              onClick={() => setSelectedType('commitment')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer
                ${selectedType === 'commitment' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Engagements
            </button>
            <button
              id="filter-mem-pattern"
              onClick={() => setSelectedType('pattern')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer
                ${selectedType === 'pattern' 
                  ? 'bg-amber-500 text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Patterns (Alerte)
            </button>
          </div>

          <button
            id="add-memory-btn"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Consigner
          </button>
        </div>

      </div>

      {/* Main Timeline Section */}
      <div className="relative">
        
        {/* Timeline central dashed line */}
        <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-dashed border-l border-slate-200 dark:border-slate-800 transform md:-translate-x-1/2 z-0" />

        <div className="space-y-8 relative z-10">
          {filteredMemories.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
              <Brain className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Aucune mémoire correspondante</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Essayez un autre mot-clé ou réinitialisez vos filtres.</p>
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 rounded-md transition-colors"
                >
                  Effacer la recherche
                </button>
              )}
            </div>
          ) : (
            filteredMemories.map((item, idx) => {
              const isPattern = item.type === 'pattern';
              const isDecision = item.type === 'decision';
              const isCommitment = item.type === 'commitment';

              // Alternate left/right on desktop
              const isLeft = idx % 2 === 0;

              return (
                <div 
                  key={item.id} 
                  className={`flex flex-col md:flex-row gap-4 w-full md:items-start
                    ${isLeft ? 'md:flex-row-reverse' : ''}`}
                >
                  
                  {/* Left Side spacer on desktop */}
                  <div className="hidden md:block md:w-1/2" />

                  {/* Circle Timeline Indicator */}
                  <div className={`absolute left-2 md:left-1/2 md:-translate-x-1/2 top-1.5 w-4.5 h-4.5 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center shadow-xs shrink-0 z-20
                    ${isPattern ? 'bg-amber-500 shadow-amber-500/50' : ''}
                    ${isDecision ? 'bg-indigo-600 shadow-indigo-600/50' : ''}
                    ${isCommitment ? 'bg-emerald-500 shadow-emerald-500/50' : ''}
                  `} />

                  {/* Card Content container (50% width on desktop) */}
                  <div className="w-full md:w-1/2 pl-10 md:pl-0 md:px-6">
                    
                    {/* Visual Card wrapper */}
                    <div className={`p-5 rounded-xl border transition-all duration-300 relative group hover:shadow-md hover:scale-[1.01]
                      ${isPattern 
                        ? 'bg-amber-50/70 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20' 
                        : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800'}`}
                    >
                      
                      {/* Top Category Tag + Date Row */}
                      <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] font-bold text-slate-400">
                        <span className={`px-2.5 py-0.5 rounded-full border uppercase tracking-wider
                          ${isPattern 
                            ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/20' 
                            : isDecision
                            ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200/20'
                            : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/20'}`}
                        >
                          {isPattern ? 'Pattern Détecté' : isDecision ? 'Décision' : 'Engagement'}
                        </span>
                        
                        <span className="flex items-center gap-1 font-mono text-slate-400">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          {item.date}
                        </span>
                      </div>

                      {/* Title & Category info */}
                      <div className="mt-2">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono tracking-widest uppercase">
                          {item.category}
                        </span>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mt-0.5">
                          {item.title}
                        </h3>
                      </div>

                      {/* Main Paragraph details */}
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-2">
                        {item.description}
                      </p>

                      {/* Footer: Strength Dots & Tag chips */}
                      <div className="flex items-center justify-between gap-4 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                        
                        {/* Tags */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {item.tags.map((tag, tIdx) => (
                            <span 
                              key={tIdx} 
                              className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[9px] font-bold font-mono text-slate-500 dark:text-slate-400"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>

                        {/* Verification Strength */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
                            Validation :
                          </span>
                          <div className="flex gap-1" title={`Indice de fiabilité : ${item.strength}/5`}>
                            {[...Array(5)].map((_, i) => (
                              <div 
                                key={i} 
                                className={`w-1.5 h-1.5 rounded-full transition-all duration-300
                                  ${i < item.strength 
                                    ? isPattern 
                                      ? 'bg-amber-500 shadow-xs shadow-amber-500' 
                                      : isDecision
                                      ? 'bg-indigo-600 shadow-xs shadow-indigo-600'
                                      : 'bg-emerald-500 shadow-xs shadow-emerald-500'
                                    : 'bg-slate-200 dark:bg-slate-700'}`}
                              />
                            ))}
                          </div>
                        </div>

                      </div>

                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Memory Modal Overlay */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative overflow-hidden animate-in zoom-in-95 duration-150">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Plus className="w-5 h-5 text-indigo-500" />
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Consigner dans la mémoire</h3>
            </div>

            <form onSubmit={handleCreateMemory} className="space-y-4">
              
              {/* Type selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Type de capture</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewType('decision')}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer
                      ${newType === 'decision'
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500' 
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
                  >
                    Décision
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewType('commitment')}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer
                      ${newType === 'commitment'
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500' 
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
                  >
                    Engagement
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewType('pattern')}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer
                      ${newType === 'pattern'
                        ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500' 
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
                  >
                    Pattern (Alerte)
                  </button>
                </div>
              </div>

              {/* Title Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Titre de la mémoire *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="ex: Choix du fournisseur de poisson ou arbitrage nappe"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              {/* Description textarea */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Détails de l'arbitrage *</label>
                <textarea
                  required
                  rows={4}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Détaillez le pourquoi, l'impact sur l'équipe et les accords trouvés..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 resize-none"
                />
              </div>

              {/* Category & Tags Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Catégorie *</label>
                  <input
                    type="text"
                    required
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="ex: Logistique, Recettes"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tags (séparés par virgule)</label>
                  <input
                    type="text"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    placeholder="tag1, tag2"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
              </div>

              {/* Strength Dots Selector */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Force de la décision (Fiabilité)</label>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setNewStrength(val)}
                        className={`w-5 h-5 rounded-full font-mono text-[9px] font-bold flex items-center justify-center border transition-all cursor-pointer
                          ${val <= newStrength 
                            ? 'bg-indigo-600 text-white border-indigo-600' 
                            : 'border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 hover:border-slate-300'}`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">
                    {newStrength === 5 ? 'Vérifié par tous les comités' : newStrength >= 3 ? 'Consensus fort' : 'Accord informel'}
                  </span>
                </div>
              </div>

              {/* Actions Footer */}
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
                  Consigner la décision
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
