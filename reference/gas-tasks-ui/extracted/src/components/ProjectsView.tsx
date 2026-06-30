import React, { useState } from 'react';
import { 
  CheckSquare, 
  Square, 
  Plus, 
  Search, 
  TrendingUp, 
  ListTodo, 
  Calendar, 
  User, 
  Tag, 
  Sparkles,
  CheckCircle2,
  X
} from 'lucide-react';
import { OrgId } from '../types';

interface Task {
  id: string;
  title: string;
  assignee: string;
  dueDate: string;
  completed: boolean;
  category: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  tasks: Task[];
}

interface ProjectsViewProps {
  activeOrgId: OrgId;
  addToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

export default function ProjectsView({ activeOrgId, addToast }: ProjectsViewProps) {
  // Localized mock state for projects of each organization
  const [projectsData, setProjectsData] = useState<Record<OrgId, Project[]>>({
    ngo: [
      {
        id: 'ngo-p1',
        name: 'Forage Kayes Nord',
        description: 'Mise en œuvre du forage profond à Kayes Nord pour un approvisionnement pérenne en eau potable.',
        tasks: [
          { id: 'ngo-t1', title: 'Valider les relevés hydrogéologiques', assignee: 'Fatoumata Traoré', dueDate: '25 Juin 2026', completed: true, category: 'Recherche' },
          { id: 'ngo-t2', title: 'Signer la convention foncière avec San', assignee: 'Amadou Sidibé', dueDate: '28 Juin 2026', completed: false, category: 'Légal' },
          { id: 'ngo-t3', title: 'Acheminer le matériel de tubage', assignee: 'Ousmane Diallo', dueDate: '02 Juillet 2026', completed: false, category: 'Logistique' },
        ]
      },
      {
        id: 'ngo-p2',
        name: 'Sensibilisation Nutritionnelle Mopti',
        description: 'Campagne d\'éducation sanitaire et de distribution de suppléments pour les familles du Delta du Niger.',
        tasks: [
          { id: 'ngo-t4', title: 'Recruter 5 relais sanitaires additionnels', assignee: 'Kadidia Dembélé', dueDate: '22 Juin 2026', completed: true, category: 'RH' },
          { id: 'ngo-t5', title: 'Distribuer les 500 kits d\'hygiène d\'urgence', assignee: 'Mariam Koné', dueDate: '29 Juin 2026', completed: false, category: 'Distribution' },
        ]
      }
    ],
    hotel: [
      {
        id: 'hotel-p1',
        name: 'Séminaire Ministériel de l\'UEMOA',
        description: 'Préparatifs de l\'accueil de la délégation ministérielle ouest-africaine pour le grand séminaire annuel.',
        tasks: [
          { id: 'hotel-t1', title: 'Attribuer les suites de prestige VIP', assignee: 'Awa Diop', dueDate: '24 Juin 2026', completed: true, category: 'Réception' },
          { id: 'hotel-t2', title: 'Valider le devis de sonorisation', assignee: 'Ephrem Codjia', dueDate: '26 Juin 2026', completed: false, category: 'Événements' },
          { id: 'hotel-t3', title: 'Fiche d\'inspection climatisation Suite 105', assignee: 'Chantal Agon', dueDate: '27 Juin 2026', completed: false, category: 'Maintenance' },
        ]
      },
      {
        id: 'hotel-p2',
        name: 'Approvisionnement Éco-responsable Allada',
        description: 'Transition complète vers des fruits et légumes en circuit court avec les producteurs locaux d\'Allada.',
        tasks: [
          { id: 'hotel-t4', title: 'Négocier les volumes de légumes', assignee: 'Chef Koffi', dueDate: '20 Juin 2026', completed: true, category: 'Achats' },
          { id: 'hotel-t5', title: 'Éliminer 100% des films plastiques de cuisine', assignee: 'Chef Koffi', dueDate: '30 Juin 2026', completed: false, category: 'Cuisine' },
        ]
      }
    ],
    agency: [
      {
        id: 'agency-p1',
        name: 'Campagne d\'Été Djigui',
        description: 'Campagne publicitaire transmédia axée sur l\'énergie créative et entrepreneuriale de la jeunesse.',
        tasks: [
          { id: 'agency-t1', title: 'Valider le storyboard du spot TV', assignee: 'Yasmine Sylla', dueDate: '26 Juin 2026', completed: false, category: 'Création' },
          { id: 'agency-t2', title: 'Finaliser l\'enregistrement voix off Mossi/Bambara', assignee: 'Koffi Mensah', dueDate: '28 Juin 2026', completed: true, category: 'Audio' },
          { id: 'agency-t3', title: 'Acheter les espaces radio régionaux', assignee: 'Aminata Bamba', dueDate: '05 Juillet 2026', completed: false, category: 'Média' },
        ]
      },
      {
        id: 'agency-p2',
        name: 'Identité Visuelle Orange Money',
        description: 'Création d\'une charte graphique moderne et dynamique pour les nouveaux services de micro-crédit mobile.',
        tasks: [
          { id: 'agency-t4', title: 'Rédiger le brief stratégique', assignee: 'Marc Kouadio', dueDate: '24 Juin 2026', completed: true, category: 'Stratégie' },
          { id: 'agency-t5', title: 'Présenter la maquette UI finale', assignee: 'Marc Kouadio', dueDate: '01 Juillet 2026', completed: false, category: 'Design' },
        ]
      }
    ],
    restaurant: [
      {
        id: 'rest-p1',
        name: 'Adaptation de la Carte & Sourcing local',
        description: 'Ajustement créatif des recettes en remplaçant les espèces menacées par la pêche durable de Soumbédioune.',
        tasks: [
          { id: 'rest-t1', title: 'Rédiger la fiche technique du Thiéboudienne de prestige', assignee: 'Chef Moussa', dueDate: '22 Juin 2026', completed: true, category: 'Menu' },
          { id: 'rest-t2', title: 'Négocier les arrivages quotidiens de mérou noir', assignee: 'Ibrahima Ndiaye', dueDate: '27 Juin 2026', completed: false, category: 'Achat' },
          { id: 'rest-t3', title: 'Valider l\'ajustement du prix du menu déjeuner', assignee: 'Chef Moussa', dueDate: '28 Juin 2026', completed: false, category: 'Finance' },
        ]
      },
      {
        id: 'rest-p2',
        name: 'Logistique Zéro Déchet Sangalkam',
        description: 'Mise en place d\'un acheminement direct et de contenants consignés avec les maraîchers de Sangalkam.',
        tasks: [
          { id: 'rest-t4', title: 'Acheter le congélateur d\'occasion de secours', assignee: 'Babacar Fall', dueDate: '25 Juin 2026', completed: true, category: 'Matériel' },
          { id: 'rest-t5', title: 'Planifier les livraisons du 28 du mois', assignee: 'Khadija Sow', dueDate: '27 Juin 2026', completed: false, category: 'Planning' },
        ]
      }
    ]
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // New Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('');

  const activeProjects = projectsData[activeOrgId] || [];

  // Toggle Task State
  const handleToggleTask = (projectId: string, taskId: string) => {
    setProjectsData(prev => {
      const orgProjects = prev[activeOrgId] || [];
      const updatedProjects = orgProjects.map(proj => {
        if (proj.id === projectId) {
          const updatedTasks = proj.tasks.map(t => {
            if (t.id === taskId) {
              const nextState = !t.completed;
              addToast(
                nextState 
                  ? `Tâche accomplie : "${t.title}"` 
                  : `Tâche remise en cours : "${t.title}"`, 
                nextState ? 'success' : 'info'
              );
              return { ...t, completed: nextState };
            }
            return t;
          });
          return { ...proj, tasks: updatedTasks };
        }
        return proj;
      });

      return {
        ...prev,
        [activeOrgId]: updatedProjects
      };
    });
  };

  // Add Task Function
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskAssignee.trim() || !selectedProjectId) {
      addToast("Veuillez remplir tous les champs obligatoires", "error");
      return;
    }

    const createdTask: Task = {
      id: `task-${Date.now()}`,
      title: newTaskTitle,
      assignee: newTaskAssignee,
      dueDate: newTaskDueDate || 'Sous peu',
      completed: false,
      category: newTaskCategory || 'Opération'
    };

    setProjectsData(prev => {
      const orgProjects = prev[activeOrgId] || [];
      const updatedProjects = orgProjects.map(proj => {
        if (proj.id === selectedProjectId) {
          return {
            ...proj,
            tasks: [...proj.tasks, createdTask]
          };
        }
        return proj;
      });

      return {
        ...prev,
        [activeOrgId]: updatedProjects
      };
    });

    addToast(`Tâche ajoutée avec succès : "${newTaskTitle}"`, 'success');
    setShowAddModal(false);

    // Reset Form
    setNewTaskTitle('');
    setNewTaskAssignee('');
    setNewTaskDueDate('');
    setNewTaskCategory('');
  };

  // Calculate project percentage
  const calculateProgress = (project: Project) => {
    if (project.tasks.length === 0) return 0;
    const completed = project.tasks.filter(t => t.completed).length;
    return Math.round((completed / project.tasks.length) * 100);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      
      {/* Header and Add Task Action */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-6 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-indigo-500" />
            Suivi des Projets et de l'Exécution
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Pilotez les chantiers stratégiques et suivez l'avancement des livrables de l'équipe.</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              id="task-search-bar"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrer par tâche ou membre..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <button
            id="open-add-task-btn"
            onClick={() => {
              if (activeProjects.length > 0) {
                setSelectedProjectId(activeProjects[0].id);
              }
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Tâche
          </button>
        </div>
      </div>

      {/* Grid of Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeProjects.map((project) => {
          const progress = calculateProgress(project);
          
          // Filter tasks of this project based on query
          const filteredTasks = project.tasks.filter(t => 
            t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.assignee.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.category.toLowerCase().includes(searchQuery.toLowerCase())
          );

          return (
            <div 
              key={project.id}
              className="p-6 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
            >
              <div>
                {/* Project Title and Header */}
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                      {project.name}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 rounded-md">
                      {progress}% Réalisé
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                    {project.description}
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-5">
                  <div 
                    className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Tasks List */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Plan de Travail ({filteredTasks.length} tâches)
                  </span>

                  {filteredTasks.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500 italic">
                      Aucune tâche ne correspond à la recherche.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredTasks.map((task) => (
                        <div 
                          key={task.id}
                          id={`task-item-${task.id}`}
                          onClick={() => handleToggleTask(project.id, task.id)}
                          className={`p-3 rounded-lg border flex items-start gap-3 transition-all duration-150 cursor-pointer hover:border-indigo-500/20
                            ${task.completed 
                              ? 'bg-slate-50/50 dark:bg-slate-850/20 border-slate-150 dark:border-slate-800/60 opacity-70' 
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/80 shadow-xs'}`}
                        >
                          {/* Checkbox Icon */}
                          <div className="shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400">
                            {task.completed ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </div>

                          {/* Task details */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold leading-relaxed truncate
                              ${task.completed 
                                ? 'line-through text-slate-400 dark:text-slate-500 font-medium' 
                                : 'text-slate-800 dark:text-slate-200'}`}
                            >
                              {task.title}
                            </p>

                            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                              <span className="flex items-center gap-1 font-mono">
                                <User className="w-3.5 h-3.5" />
                                {task.assignee}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {task.dueDate}
                              </span>
                              <span className="px-1.5 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-700 text-[9px] font-bold uppercase tracking-wider">
                                {task.category}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Mini Summary Block */}
              <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] font-bold text-slate-400">
                <span className="flex items-center gap-1 font-mono">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  Mise à jour en direct
                </span>
                <span>
                  {project.tasks.filter(t => t.completed).length}/{project.tasks.length} validées
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Task Modal */}
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
              <Plus className="w-5 h-5 text-indigo-500" />
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Créer une nouvelle tâche</h3>
            </div>

            <form onSubmit={handleAddTask} className="space-y-4">
              {/* Project Select */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Sélectionner un projet *</label>
                <select
                  required
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                >
                  <option value="" disabled>Choisir un projet...</option>
                  {activeProjects.map(proj => (
                    <option key={proj.id} value={proj.id}>{proj.name}</option>
                  ))}
                </select>
              </div>

              {/* Title Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Titre de la tâche *</label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="ex: Signer l'accord d'approvisionnement"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              {/* Assignee Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Responsable *</label>
                <input
                  type="text"
                  required
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  placeholder="ex: Amadou Diallo ou Fatoumata Traoré"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              {/* Row: Due Date and Category */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date limite</label>
                  <input
                    type="text"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    placeholder="ex: 30 Juin 2026"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Catégorie</label>
                  <input
                    type="text"
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value)}
                    placeholder="ex: Logistique, Légal"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
              </div>

              {/* Footer Actions */}
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
                  Ajouter la tâche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
