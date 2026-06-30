import { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Mic, 
  MicOff, 
  Paperclip, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  CheckCircle2, 
  BrainCircuit, 
  Volume2, 
  HelpCircle,
  Clock
} from 'lucide-react';
import { OrgId, MessageItem, DocItem } from '../types';
import { SUGGESTIONS, MOCK_DATA, ORGANIZATIONS } from '../data/mockData';

interface ChatViewProps {
  activeOrgId: OrgId;
  documents: DocItem[];
  addToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

export default function ChatView({ activeOrgId, documents, addToast }: ChatViewProps) {
  const [messages, setMessages] = useState<Record<OrgId, MessageItem[]>>({
    ngo: [
      { id: 'm1', sender: 'assistant', text: 'Bonjour ! Je suis l\'intelligence collective de Vision Sahel. Je connais tous vos rapports de forage, enregistrements audio de terrain et décisions communautaires. Que souhaitez-vous analyser aujourd\'hui ?', timestamp: '08:15', confidence: 'Haute' }
    ],
    hotel: [
      { id: 'm1', sender: 'assistant', text: 'Bonjour ! Je suis l\'assistant de l\'Hôtel Azalaï. Je peux vous renseigner instantanément sur les fiches d\'inspection, l\'approvisionnement maraîcher ou les préparatifs des séminaires vip. Quelle est votre question ?', timestamp: '08:15', confidence: 'Haute' }
    ],
    agency: [
      { id: 'm1', sender: 'assistant', text: 'Salut ! Je suis le cerveau de l\'Agence Delta. Je garde la trace de tous vos brainstormings, briefs créatifs (Orange Money, Djigui) et storyboards en cours. Des idées à creuser ?', timestamp: '08:15', confidence: 'Haute' }
    ],
    restaurant: [
      { id: 'm1', sender: 'assistant', text: 'Bonjour ! Je suis l\'assistant du Bistro Dakar. J\'analyse vos fiches recettes, vos bons de livraison de poisson de Soumbédioune et vos stocks maraîchers. Comment puis-je vous aider en cuisine ou en salle ?', timestamp: '08:15', confidence: 'Haute' }
    ]
  });

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeMessages = messages[activeOrgId] || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, isTyping]);

  const toggleSources = (msgId: string) => {
    setExpandedSources(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleSend = (text: string) => {
    if (!text.trim()) return;

    const userMsgId = `user-${Date.now()}`;
    const newMsg: MessageItem = {
      id: userMsgId,
      sender: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };

    // Add user message
    setMessages(prev => ({
      ...prev,
      [activeOrgId]: [...(prev[activeOrgId] || []), newMsg]
    }));
    setInputText('');
    setIsTyping(true);

    // Simulate AI response with matching sources and content
    setTimeout(() => {
      const response = generateAssistantResponse(text, activeOrgId);
      const assistantMsgId = `assistant-${Date.now()}`;
      
      setMessages(prev => ({
        ...prev,
        [activeOrgId]: [
          ...(prev[activeOrgId] || []),
          {
            id: assistantMsgId,
            sender: 'assistant',
            text: response.text,
            timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            confidence: response.confidence,
            sources: response.sources
          }
        ]
      }));
      setIsTyping(false);
    }, 1500);
  };

  // Simulated Voice Recording logic
  const triggerVoiceRecording = () => {
    setIsRecording(true);
    addToast("Microphone activé : Écoute en cours...", "info");

    setTimeout(() => {
      setIsRecording(false);
      // Determine simulated speech based on org
      let simulatedSpeech = "";
      if (activeOrgId === 'ngo') simulatedSpeech = "Quelles sont les dernières décisions pour le forage à Kayes ?";
      else if (activeOrgId === 'hotel') simulatedSpeech = "Où en est l'accord d'approvisionnement avec Allada ?";
      else if (activeOrgId === 'agency') simulatedSpeech = "Retrouver le brief créatif pour Djigui";
      else simulatedSpeech = "Quel poisson remplace le thiof ce week-end ?";

      setInputText(simulatedSpeech);
      addToast("Voix transcrite avec succès !", "success");
    }, 3000);
  };

  const generateAssistantResponse = (query: string, org: OrgId): { text: string; confidence: 'Haute' | 'Moyenne' | 'Faible'; sources: string[] } => {
    const lowerQuery = query.toLowerCase();

    if (org === 'ngo') {
      if (lowerQuery.includes('vaccin') || lowerQuery.includes('mopti') || lowerQuery.includes('nutri')) {
        return {
          text: "D'après les rapports d'Ousmane Diallo et les décisions sanitaires, la campagne nutritionnelle et vaccinale à Mopti progresse bien. Les relais communautaires s'engagent à assurer deux séances hebdomadaires de sensibilisation au lavage des mains. Attention toutefois aux inondations de l'hivernage qui risquent de ralentir l'approvisionnement médical de 140% entre Juillet et Septembre.",
          confidence: 'Haute',
          sources: [
            "Note Vocale : Réunion de crise nutritionnelle Mopti",
            "Plan d'action Hivernage et Prépositionnement"
          ]
        };
      }
      if (lowerQuery.includes('kayes') || lowerQuery.includes('forage')) {
        return {
          text: "Pour le projet de forage de Kayes Nord, la décision prioritaire du 18 Juin a acté l'allocation de 60% du budget d'infrastructure vers ce site. Le rapport technique rédigé par Fatoumata Traoré confirme que la nappe phréatique est viable à une profondeur de 85m. Le plan de travaux et les devis finaux sont d'ores et déjà indexés dans vos documents.",
          confidence: 'Haute',
          sources: [
            "Rapport technique Forage Kayes Nord",
            "Procès-Verbal Assemblée Générale Communautaire San"
          ]
        };
      }
    }

    if (org === 'hotel') {
      if (lowerQuery.includes('uemoa') || lowerQuery.includes('gala') || lowerQuery.includes('séminaire') || lowerQuery.includes('vip')) {
        return {
          text: "Concernant la logistique du séminaire ministériel et du dîner de gala de la CEDEAO/UEMOA : les consignes protocolaires d'attribution des suites VIP ont été archivées par Ephrem Codjia dans un mémo vocal. Un devis de sonorisation de 750 000 FCFA est actuellement en attente d'approbation. Le taux d'occupation atteint 78% grâce à cet événement.",
          confidence: 'Haute',
          sources: [
            "Audio : Briefing d'accueil Délégation CEDEAO",
            "Compte-rendu Comité de Direction Qualité Q2"
          ]
        };
      }
      if (lowerQuery.includes('achat') || lowerQuery.includes('fruits') || lowerQuery.includes('légumes') || lowerQuery.includes('allada')) {
        return {
          text: "La décision du 20 Juin a sanctuarisé l'achat de fruits et légumes à 100% locaux auprès de la coopérative maraîchère du Plateau d'Allada. Cette convention a été signée avec le Chef Koffi pour garantir des prix fixes et éviter les perturbations douanières. Le rapport d'inspection indique également un planning renforcé pour les gouvernantes d'étage.",
          confidence: 'Haute',
          sources: [
            "Convention de partenariat coopérative maraîchère Allada",
            "Compte-rendu Comité de Direction Qualité Q2"
          ]
        };
      }
    }

    if (org === 'agency') {
      if (lowerQuery.includes('orange') || lowerQuery.includes('money') || lowerQuery.includes('crédit')) {
        return {
          text: "Le brief stratégique rédigé par Marc Kouadio pour Orange Money Côte d'Ivoire cible en priorité l'entrepreneuriat des jeunes actifs urbains et informels. L'axe validé par Aminata Bamba s'oriente vers un ton résolument Afro-optimiste. Un storyboard de spot TV soumis par Yasmine Sylla est en attente de votre validation sur votre tableau de bord.",
          confidence: 'Haute',
          sources: [
            "Brief Stratégique Lancement Orange Money",
            "Rapport d'impact de Focus Group Abidjan"
          ]
        };
      }
      if (lowerQuery.includes('djigui') || lowerQuery.includes('brief') || lowerQuery.includes('créatif')) {
        return {
          text: "La campagne Djigui avance activement. Les maquettes des spots radio en Mossi et Bambara ont été validées par le directeur artistique et téléversées par Koffi Mensah. L'analyse IA montre qu'un goulot d'étranglement ralentit la validation créative de 6 jours chez le directeur de création. Il est recommandé de déléguer la validation intermédiaire.",
          confidence: 'Haute',
          sources: [
            "Audio : Voix Off Spot Radio Djigui (Mossi & Bambara)",
            "Compte-rendu du brainstorming d'équipe Logo Djigui"
          ]
        };
      }
    }

    if (org === 'restaurant') {
      if (lowerQuery.includes('thiof') || lowerQuery.includes('mérou') || lowerQuery.includes('poisson') || lowerQuery.includes('soumbédioune')) {
        return {
          text: "Le Chef Moussa a pris la décision stratégique d'ajuster notre Thiéboudienne de Prestige en substituant le Thiof blanc (devenu extrêmement cher et rare au marché) par le Mérou Noir de Soumbédioune ou la Lotte locale. Ibrahima Ndiaye a consigné une réclamation concernant le dernier calibrage de poisson reçu de la poissonnerie artisanale de Soumbédioune.",
          confidence: 'Haute',
          sources: [
            "Recette officielle & Fiche technique Thiéboudienne de Prestige",
            "Audio : Enregistrement réclamation poissonnerie Soumbédioune"
          ]
        };
      }
      if (lowerQuery.includes('légumes') || lowerQuery.includes('sangalkam') || lowerQuery.includes('oignon')) {
        return {
          text: "L'approvisionnement en tomates, piments et gombos est sécurisé grâce au contrat direct de circuit court signé avec les maraîchers de Sangalkam le 3 Juin. Toutefois, l'IA signale un risque élevé de rupture d'oignons locaux le 28 du mois en raison des fluctuations du marché de Diamniadio. Recommandation : commander avant le 22 du mois.",
          confidence: 'Haute',
          sources: [
            "Bon de livraison et Facture Maraîchers Sangalkam",
            "Compte-rendu Réunion d'équipe \"Planification Tabaski\""
          ]
        };
      }
    }

    // Default intelligent response matching active organization state
    return {
      text: `J'ai analysé votre requête concernant l'organisation "${ORGANIZATIONS.find(o => o.id === org)?.name}". Bien que je n'aie pas trouvé de correspondance exacte, mon index contient ${documents.length} fichiers pertinents et plusieurs décisions clés. Je vous recommande d'utiliser l'un des boutons de suggestions rapides ci-dessus ou de préciser si vous parlez d'un rapport terrain ou d'un enregistrement audio spécifique.`,
      confidence: 'Moyenne',
      sources: documents.slice(0, 2).map(d => d.title)
    };
  };

  const currentSuggestions = SUGGESTIONS[activeOrgId] || [];
  const activeOrgName = ORGANIZATIONS.find(o => o.id === activeOrgId)?.name || 'l\'organisation';

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-300">
      
      {/* Header of Chat */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              Assistant Brainy
              <span className="flex h-2 w-2 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
            </h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Connecté à la mémoire de {activeOrgName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            <span>Mise à jour : Temps réel</span>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeMessages.map((msg) => {
          const isAssistant = msg.sender === 'assistant';
          const isSourceExpanded = expandedSources[msg.id];
          
          return (
            <div 
              key={msg.id}
              className={`flex gap-3 ${isAssistant ? 'justify-start' : 'justify-end'}`}
            >
              {/* Assistant Avatar */}
              {isAssistant && (
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  B
                </div>
              )}

              {/* Message Bubble Card */}
              <div className={`max-w-2xl rounded-xl p-4 shadow-xs relative group
                ${isAssistant 
                  ? 'bg-indigo-50/50 dark:bg-indigo-950/20 text-slate-800 dark:text-slate-100 border border-indigo-100/60 dark:border-indigo-500/10' 
                  : 'bg-indigo-600 text-white font-medium'}`}
              >
                {/* Confidence Badge & Assistant Specific Controls */}
                {isAssistant && msg.confidence && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">Cerveau IA</span>
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border
                      ${msg.confidence === 'Haute' 
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/20' 
                        : msg.confidence === 'Moyenne'
                        ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300/20'}`}
                    >
                      Confiance {msg.confidence}
                    </span>
                  </div>
                )}

                {/* Main Text content */}
                <p className="text-xs leading-relaxed whitespace-pre-line select-text">
                  {msg.text}
                </p>

                {/* Sources Collapsible Panel */}
                {isAssistant && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-indigo-100/40 dark:border-slate-800">
                    <button 
                      id={`sources-toggle-${msg.id}`}
                      onClick={() => toggleSources(msg.id)}
                      className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors focus:outline-hidden cursor-pointer"
                    >
                      <span>Sources d'information ({msg.sources.length})</span>
                      {isSourceExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {isSourceExpanded && (
                      <div className="mt-2 space-y-1.5 animate-in fade-in duration-200">
                        {msg.sources.map((src, sIdx) => (
                          <div 
                            key={sIdx}
                            className="flex items-center gap-2 p-1.5 rounded-md bg-white dark:bg-slate-850 border border-slate-150 dark:border-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-300"
                          >
                            <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span className="truncate">{src}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <span className={`block text-[9px] text-right mt-1.5 font-mono
                  ${isAssistant ? 'text-slate-400 dark:text-slate-500' : 'text-indigo-200'}`}
                >
                  {msg.timestamp}
                </span>
              </div>

              {/* User Avatar */}
              {!isAssistant && (
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200 dark:border-slate-700 shadow-xs">
                  AD
                </div>
              )}
            </div>
          );
        })}

        {/* AI Typing Loader Indicator */}
        {isTyping && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              B
            </div>
            <div className="bg-slate-50 dark:bg-slate-850 text-slate-500 rounded-xl p-4 border border-slate-150 dark:border-slate-800 flex items-center gap-2">
              <span className="text-xs font-semibold">Brainy analyse la mémoire</span>
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Anchor point to snap scroll */}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips and Input Floating Panel */}
      <div className="p-4 bg-slate-50 dark:bg-slate-850/60 border-t border-slate-200 dark:border-slate-800 space-y-3">
        
        {/* Chips for instant queries */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
            Suggéré :
          </span>
          {currentSuggestions.map((chip, idx) => (
            <button
              key={idx}
              id={`suggestion-chip-${idx}`}
              onClick={() => handleSend(chip)}
              className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:border-indigo-500 dark:hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer shrink-0 shadow-xs hover:scale-105"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Simulated Voice Mic Overlay */}
        {isRecording && (
          <div className="p-4 rounded-xl bg-indigo-600 text-white flex flex-col items-center justify-center gap-2 animate-pulse">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-8 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2.5 h-12 bg-white rounded-full animate-bounce" style={{ animationDelay: '100ms' }} />
              <span className="w-2.5 h-6 bg-white/90 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
              <span className="w-2.5 h-10 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="w-2.5 h-7 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
            </div>
            <span className="text-xs font-bold font-mono uppercase tracking-wider">Écoute vocale intelligente en cours...</span>
          </div>
        )}

        {/* Input Text Form */}
        {!isRecording && (
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(inputText);
            }}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/50 dark:focus-within:ring-indigo-400/50 transition-all"
          >
            {/* Context File Button */}
            <button 
              type="button"
              onClick={() => addToast("Indexation de fichier contextuel bientôt disponible", "info")}
              className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
              title="Ajouter un document au contexte"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Main Input Text */}
            <input
              type="text"
              id="chat-input-text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Posez une question à la mémoire d'équipe (ex: forage, poisson, séminaire...)"
              className="flex-1 bg-transparent border-none text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-hidden focus:ring-0 px-2 py-1.5"
            />

            {/* Mic Button for voice coordination */}
            <button
              type="button"
              onClick={triggerVoiceRecording}
              className="p-2 rounded-md bg-amber-500/10 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 transition-all shrink-0 cursor-pointer"
              title="Enregistrement vocal intelligent"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim()}
              className={`p-2 rounded-md transition-all shrink-0 cursor-pointer
                ${inputText.trim() 
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs' 
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>

    </div>
  );
}
