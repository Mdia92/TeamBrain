import React, { useState, useRef } from 'react';
import { 
  FileText, 
  MapPin, 
  Volume2, 
  Users, 
  Download, 
  Plus, 
  Search, 
  UploadCloud, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  File,
  X,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { OrgId, DocItem, DocType } from '../types';

interface DocumentsViewProps {
  activeOrgId: OrgId;
  documents: DocItem[];
  setDocuments: React.Dispatch<React.SetStateAction<Record<OrgId, DocItem[]>>>;
  setActiveTab: (tab: string) => void;
  addToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

export default function DocumentsView({
  activeOrgId,
  documents,
  setDocuments,
  setActiveTab,
  addToast
}: DocumentsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'all' | DocType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File filter logic
  const filteredDocs = documents.filter(doc => {
    const matchesSearch = 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.author.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTab = activeSubTab === 'all' || doc.type === activeSubTab;

    return matchesSearch && matchesTab;
  });

  // Handle drag and drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUploadedFile(e.target.files[0]);
    }
  };

  const handleUploadedFile = (file: File) => {
    setIsAnalyzing(true);
    addToast(`Réception de "${file.name}"... Analyse IA en cours.`, "info");

    // Simulate AI parsing of the uploaded file
    setTimeout(() => {
      const isAudio = file.type.startsWith('audio/') || file.name.endsWith('.mp3') || file.name.endsWith('.wav') || file.name.endsWith('.m4a');
      const isRapport = file.name.toLowerCase().includes('rapport') || file.name.toLowerCase().includes('terrain') || file.name.toLowerCase().includes('gps');
      const isReunion = file.name.toLowerCase().includes('reunion') || file.name.toLowerCase().includes('meeting') || file.name.toLowerCase().includes('compte-rendu');

      let detectedType: DocType = 'document';
      if (isAudio) detectedType = 'audio';
      else if (isRapport) detectedType = 'rapport';
      else if (isReunion) detectedType = 'reunion';

      const sizeStr = (file.size / (1024 * 1024)).toFixed(1) + " MB";
      const cleanedTitle = file.name.replace(/\.[^/.]+$/, ""); // strip extension

      let aiSummary = `L'IA a lu ce document de ${file.type || 'type indéfini'}. Il contient des mémos d'équipe, des données opérationnelles et un récapitulatif des tâches.`;
      let gps: string | undefined = undefined;

      // Organization contextual details
      if (activeOrgId === 'ngo') {
        if (detectedType === 'rapport') {
          gps = "14.5012° N, 12.1124° W (Ségou, ML)";
          aiSummary = `Rapport d'activité communautaire analysant l'accès à l'eau potable dans le secteur Ségou. L'IA a indexé 3 recommandations clés pour les infrastructures.`;
        } else if (detectedType === 'audio') {
          aiSummary = "Note vocale enregistrée sur le terrain concernant la logistique vaccinale de Ségou. L'IA a extrait l'accord verbal avec le relais de santé.";
        }
      } else if (activeOrgId === 'hotel') {
        if (detectedType === 'rapport') {
          gps = "6.3530° N, 2.4410° E (Cotonou, BJ)";
          aiSummary = "Inspection d'état de la climatisation centrale et entretien thermique du pôle banquet. 2 incidents électriques relevés.";
        }
      } else if (activeOrgId === 'restaurant') {
        if (detectedType === 'rapport') {
          gps = "14.6937° N, 17.4441° W (Dakar, SN)";
          aiSummary = "Bon de livraison poissonnerie et calibrage des produits de mer frais du Chef Moussa.";
        }
      }

      const newDoc: DocItem = {
        id: `doc-uploaded-${Date.now()}`,
        title: cleanedTitle,
        type: detectedType,
        date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
        summary: aiSummary,
        size: sizeStr === "0.0 MB" ? "1.4 MB" : sizeStr,
        author: "Amadou Diallo",
        gpsLocation: gps
      };

      setDocuments(prev => ({
        ...prev,
        [activeOrgId]: [newDoc, ...(prev[activeOrgId] || [])]
      }));

      setIsAnalyzing(false);
      addToast(`Fichier "${file.name}" classé et indexé avec succès dans la bibliothèque !`, "success");
    }, 2500);
  };

  const getDocIcon = (type: DocType) => {
    switch(type) {
      case 'document':
        return <FileText className="w-5 h-5 text-indigo-500" />;
      case 'rapport':
        return <MapPin className="w-5 h-5 text-emerald-500" />;
      case 'reunion':
        return <Users className="w-5 h-5 text-amber-500" />;
      case 'audio':
        return <Volume2 className="w-5 h-5 text-indigo-400" />;
    }
  };

  const getDocTypeLabel = (type: DocType) => {
    switch(type) {
      case 'document': return 'Document PDF';
      case 'rapport': return 'Rapport Terrain';
      case 'reunion': return 'Réunion / PV';
      case 'audio': return 'Note Vocale';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      
      {/* Drag & Drop Upload Zone at top */}
      <div 
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full p-8 rounded-xl border-2 border-dashed text-center transition-all duration-200 cursor-pointer relative overflow-hidden group
          ${dragActive 
            ? 'border-indigo-500 bg-indigo-500/10' 
            : 'border-slate-300 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-850/40 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800/20'}`}
      >
        <input 
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInput}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.mp3,.wav,.m4a"
        />

        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white animate-pulse">Brainy lit et classe le document...</h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Extraction du résumé, géolocalisation et indexation sémantique</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-2.5">
            <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-white">
                Glissez vos rapports ou enregistrements ici
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                L'IA s'occupe du tri, de la catégorisation et rédige le résumé (PDF, Word, MP3, Notes vocales...)
              </p>
            </div>
            <button
              type="button"
              className="px-3.5 py-1.5 bg-indigo-600 group-hover:bg-indigo-700 text-white text-[10px] font-bold rounded-md transition-colors shadow-xs"
            >
              Parcourir les fichiers
            </button>
          </div>
        )}
      </div>

      {/* Filterable Tabs and Search Bar row */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-850 p-1 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto w-full lg:w-auto">
          <button
            id="tab-doc-all"
            onClick={() => setActiveSubTab('all')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all shrink-0 cursor-pointer
              ${activeSubTab === 'all' 
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-extrabold shadow-xs' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
          >
            Tous
          </button>
          <button
            id="tab-doc-document"
            onClick={() => setActiveSubTab('document')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all shrink-0 cursor-pointer
              ${activeSubTab === 'document' 
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-extrabold shadow-xs' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
          >
            Documents
          </button>
          <button
            id="tab-doc-rapport"
            onClick={() => setActiveSubTab('rapport')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all shrink-0 cursor-pointer
              ${activeSubTab === 'rapport' 
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-extrabold shadow-xs' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
          >
            Rapports terrain
          </button>
          <button
            id="tab-doc-reunion"
            onClick={() => setActiveSubTab('reunion')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all shrink-0 cursor-pointer
              ${activeSubTab === 'reunion' 
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-extrabold shadow-xs' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
          >
            Réunions
          </button>
          <button
            id="tab-doc-audio"
            onClick={() => setActiveSubTab('audio')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all shrink-0 cursor-pointer
              ${activeSubTab === 'audio' 
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-extrabold shadow-xs' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
          >
            Notes vocales
          </button>
        </div>

        {/* Search bar */}
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            id="doc-search-bar"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un document..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

      </div>

      {/* Grid Layout of Document Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredDocs.length === 0 ? (
          <div className="md:col-span-2 p-12 text-center bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
            <File className="w-10 h-10 text-slate-300 mx-auto mb-2 animate-pulse" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Aucun fichier trouvé</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Modifiez vos filtres ou effectuez une nouvelle recherche.</p>
          </div>
        ) : (
          filteredDocs.map((doc) => (
            <div 
              key={doc.id}
              className="p-5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-lg hover:shadow-md hover:scale-[1.01] transition-all duration-200 flex flex-col justify-between group"
            >
              <div>
                {/* Header: File Icon, Title & Badge row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-150 dark:border-slate-800 rounded-lg shrink-0 group-hover:scale-105 transition-transform">
                      {getDocIcon(doc.type)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {doc.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{getDocTypeLabel(doc.type)} • {doc.size}</p>
                    </div>
                  </div>

                  {/* Optional GPS Location Badge for field reports */}
                  {doc.gpsLocation && (
                    <span className="flex items-center gap-0.5 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-full shrink-0">
                      <MapPin className="w-2.5 h-2.5 shrink-0 animate-bounce" />
                      GPS
                    </span>
                  )}
                </div>

                {/* AI Summary Section */}
                <div className="mt-4 p-3 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80">
                  <span className="text-[9px] font-extrabold text-indigo-500 uppercase tracking-widest font-mono flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                    Résumé IA :
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed mt-1 italic">
                    {doc.summary}
                  </p>
                </div>
              </div>

              {/* Card Footer actions */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 font-medium">
                <div>
                  <p>Par <span className="font-bold text-slate-600 dark:text-slate-300">{doc.author}</span></p>
                  <p className="text-[9px] text-slate-400 font-mono">{doc.date}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id={`download-doc-${doc.id}`}
                    onClick={() => addToast(`Téléchargement de "${doc.title}" lancé !`, "success")}
                    className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 dark:text-slate-300 transition-colors cursor-pointer"
                    title="Télécharger le fichier"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    id={`chat-doc-${doc.id}`}
                    onClick={() => {
                      setActiveTab('chat');
                      addToast(`Analyse lancée pour "${doc.title}"`, "info");
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Consulter
                  </button>
                </div>
              </div>

            </div>
          ))
        )}
      </div>

    </div>
  );
}
