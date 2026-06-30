import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  User, 
  TrendingUp, 
  ThumbsUp, 
  Calendar, 
  MapPin, 
  CornerDownRight, 
  BellRing,
  Award,
  ChevronRight
} from 'lucide-react';
import { OrgId, KpiItem, ActivityItem, PendingAction } from '../types';

interface DashboardViewProps {
  activeOrgId: OrgId;
  kpis: KpiItem[];
  activities: ActivityItem[];
  pendingActions: PendingAction[];
  setPendingActions: React.Dispatch<React.SetStateAction<Record<OrgId, PendingAction[]>>>;
  addToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

export default function DashboardView({
  activeOrgId,
  kpis,
  activities,
  pendingActions,
  setPendingActions,
  addToast
}: DashboardViewProps) {
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  // Sample data for the activity chart depending on the org
  const getChartData = (org: OrgId) => {
    switch(org) {
      case 'ngo':
        return [32, 45, 28, 62, 75, 54, 82]; // NGO Peak mid-week / weekend field runs
      case 'hotel':
        return [45, 38, 52, 60, 88, 95, 74]; // Hotel Peak weekend guest arrivals
      case 'agency':
        return [24, 58, 65, 48, 72, 30, 15]; // Agency Peak weekday campaigns
      case 'restaurant':
        return [35, 42, 50, 68, 92, 110, 85]; // Restaurant Peak weekend diners
    }
  };

  const getChartDays = () => ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const chartValues = getChartData(activeOrgId);
  const chartDays = getChartDays();
  const maxVal = Math.max(...chartValues, 100);

  // Generate SVG coordinates based on values
  const width = 500;
  const height = 160;
  const padding = 20;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = chartValues.map((val, idx) => {
    const x = padding + (idx / (chartValues.length - 1)) * chartWidth;
    const y = padding + chartHeight - (val / maxVal) * chartHeight;
    return { x, y, value: val, day: chartDays[idx] };
  });

  const pathD = points.length > 0 
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    : '';

  // Gradient area path
  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
    : '';

  // Contributors depending on Org
  const getContributors = (org: OrgId) => {
    switch(org) {
      case 'ngo':
        return [
          { name: 'Fatoumata Traoré', role: 'Directrice de Projet', score: 88, avatar: 'FT', color: 'bg-emerald-500' },
          { name: 'Ousmane Diallo', role: 'Superviseur Logistique', score: 74, avatar: 'OD', color: 'bg-indigo-500' },
          { name: 'Mariam Koné', role: 'Nutritionniste de Zone', score: 62, avatar: 'MK', color: 'bg-amber-500' },
          { name: 'Kadidia Dembélé', role: 'Relais Sanitaire', score: 50, avatar: 'KD', color: 'bg-slate-500' }
        ];
      case 'hotel':
        return [
          { name: 'Chantal Agon', role: 'Gouvernante Générale', score: 92, avatar: 'CA', color: 'bg-emerald-500' },
          { name: 'Ephrem Codjia', role: 'Directeur d\'Événements', score: 78, avatar: 'EC', color: 'bg-indigo-500' },
          { name: 'Chef Koffi', role: 'Chef Exécutif', score: 65, avatar: 'CK', color: 'bg-amber-500' },
          { name: 'Ablaye Sène', role: 'Chef Sommelier', score: 54, avatar: 'AS', color: 'bg-slate-500' }
        ];
      case 'agency':
        return [
          { name: 'Yasmine Sylla', role: 'Directrice Artistique', score: 95, avatar: 'YS', color: 'bg-emerald-500' },
          { name: 'Marc Kouadio', role: 'Lead UI/UX Designer', score: 82, avatar: 'MK', color: 'bg-indigo-500' },
          { name: 'Aminata Bamba', role: 'Directrice Conseil', score: 70, avatar: 'AB', color: 'bg-amber-500' },
          { name: 'Koffi Mensah', role: 'Monteur & Motion Designer', score: 48, avatar: 'KM', color: 'bg-slate-500' }
        ];
      case 'restaurant':
        return [
          { name: 'Chef Moussa', role: 'Chef de Cuisine', score: 98, avatar: 'CM', color: 'bg-emerald-500' },
          { name: 'Ibrahima Ndiaye', role: 'Responsable Approvisionnement', score: 80, avatar: 'IN', color: 'bg-indigo-500' },
          { name: 'Khadija Sow', role: 'Maître d\'Hôtel', score: 64, avatar: 'KS', color: 'bg-amber-500' },
          { name: 'Babacar Fall', role: 'Chef de Partie Froid', score: 52, avatar: 'BF', color: 'bg-slate-500' }
        ];
    }
  };

  const contributors = getContributors(activeOrgId);

  const handleApprove = (id: string, title: string) => {
    setPendingActions(prev => ({
      ...prev,
      [activeOrgId]: prev[activeOrgId].filter(item => item.id !== id)
    }));
    addToast(`Action approuvée : "${title}"`, 'success');
  };

  const handleReject = (id: string, title: string) => {
    setPendingActions(prev => ({
      ...prev,
      [activeOrgId]: prev[activeOrgId].filter(item => item.id !== id)
    }));
    addToast(`Action rejetée : "${title}"`, 'error');
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-300">
      
      {/* Top Banner & Welcome Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-linear-to-r from-slate-900 via-slate-850 to-indigo-950 rounded-xl border border-slate-800 text-white shadow-md">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Bonjour Amadou 👋
          </h1>
          <p className="text-slate-300 text-sm mt-1 font-medium">
            Voici l'état actuel de votre cerveau collectif et de la coordination d'équipe.
          </p>
        </div>
        <div className="flex items-center gap-2.5 bg-indigo-500/10 border border-indigo-400/20 px-4 py-2 rounded-lg self-start sm:self-center">
          <Clock className="w-4 h-4 text-indigo-400 animate-pulse" />
          <div className="text-right">
            <span className="block text-xs font-semibold text-slate-200">24 Juin 2026</span>
            <span className="block text-[10px] text-slate-400">Heure locale: 08:30 (GMT)</span>
          </div>
        </div>
      </div>

      {/* 4 Animated KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const isSelected = selectedKpi === kpi.id;
          
          return (
            <div 
              key={kpi.id}
              id={`kpi-card-${kpi.id}`}
              onClick={() => setSelectedKpi(isSelected ? null : kpi.id)}
              className={`p-5 rounded-xl border bg-white dark:bg-slate-850 shadow-xs hover:shadow-md hover:scale-[1.02] transition-all duration-200 cursor-pointer relative overflow-hidden group
                ${isSelected ? 'ring-2 ring-indigo-500 dark:ring-indigo-400' : 'border-slate-200 dark:border-slate-800'}`}
            >
              {/* Colored left bar */}
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 
                ${kpi.color === 'indigo' ? 'bg-indigo-500' : ''}
                ${kpi.color === 'amber' ? 'bg-amber-500' : ''}
                ${kpi.color === 'emerald' ? 'bg-emerald-500' : ''}
                ${kpi.color === 'slate' ? 'bg-slate-500' : ''}
              `} />

              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide uppercase">{kpi.title}</p>
                <span className={`flex items-center gap-0.5 text-xs font-extrabold px-2 py-0.5 rounded-full
                  ${kpi.isPositive 
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}
                >
                  {kpi.isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {kpi.trend}
                </span>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {kpi.value}
                </h3>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 truncate">{kpi.description}</p>

              {/* Collapsible Details Panel */}
              {isSelected && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 animate-in fade-in duration-150">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100 mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                    Indice optimisé par l'IA
                  </div>
                  Les données indiquent une activité stable basée sur les 7 derniers jours d'activité.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Analytics Row: Line Chart + Contributors Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Line Chart: Team Activity (60%) */}
        <div className="lg:col-span-3 p-6 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                Activité globale de l'équipe
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Fréquence de synchronisation et de partage d'informations</p>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-full uppercase">
              7 Derniers Jours
            </div>
          </div>

          {/* Handcrafted Responsive SVG Line Chart */}
          <div className="flex-1 min-h-[160px] relative w-full mt-2">
            <svg 
              viewBox={`0 0 ${width} ${height}`} 
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              {/* Grids */}
              <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(148, 163, 184, 0.08)" strokeWidth={1} />
              <line x1={padding} y1={height/2} x2={width - padding} y2={height/2} stroke="rgba(148, 163, 184, 0.08)" strokeWidth={1} />
              <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(148, 163, 184, 0.15)" strokeWidth={1.5} />

              {/* Area Gradient Definition */}
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.00" />
                </linearGradient>
              </defs>

              {/* Area under line */}
              <path d={areaD} fill="url(#chartGradient)" />

              {/* Line */}
              <path 
                d={pathD} 
                fill="none" 
                stroke="#4F46E5" 
                strokeWidth={2.5} 
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-300"
              />

              {/* Data points */}
              {points.map((p, idx) => (
                <g 
                  key={idx}
                  onMouseEnter={() => setHoveredDay(idx)}
                  onMouseLeave={() => setHoveredDay(null)}
                  className="cursor-pointer group"
                >
                  <circle 
                    cx={p.x} 
                    cy={p.y} 
                    r={hoveredDay === idx ? 6 : 4} 
                    fill={hoveredDay === idx ? '#4F46E5' : '#ffffff'} 
                    stroke="#4F46E5" 
                    strokeWidth={2}
                    className="transition-all duration-150"
                  />
                  {/* Tooltip on SVG */}
                  {hoveredDay === idx && (
                    <g>
                      <rect 
                        x={p.x - 30} 
                        y={p.y - 28} 
                        width={60} 
                        height={20} 
                        rx={4} 
                        fill="#0F172A" 
                        className="shadow-md"
                      />
                      <text 
                        x={p.x} 
                        y={p.y - 15} 
                        fill="#ffffff" 
                        fontSize="9" 
                        fontWeight="bold" 
                        textAnchor="middle"
                      >
                        {p.value} acts
                      </text>
                    </g>
                  )}
                </g>
              ))}
            </svg>

            {/* Custom Tooltip Overlay if hovered */}
            <div className="flex justify-between px-5 mt-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono">
              {chartDays.map((d, i) => (
                <span 
                  key={i} 
                  className={`transition-colors ${hoveredDay === i ? 'text-indigo-600 dark:text-indigo-400 scale-110 font-extrabold' : ''}`}
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bar Chart: Top Contributors (40%) */}
        <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Contributeurs clés
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Membres les plus actifs cette semaine</p>
          </div>

          {/* Custom Horizontal Bar Chart with beautiful growth transitions */}
          <div className="space-y-4 mt-4 flex-1 flex flex-col justify-center">
            {contributors.map((c, idx) => (
              <div key={idx} className="space-y-1.5 group">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-850 flex items-center justify-center font-bold text-[10px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-850">
                      {c.avatar}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{c.name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-2 hidden sm:inline">{c.role}</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{c.score} act.</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${c.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section: Live Activity Feed vs Pending Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Live Activity Feed */}
        <div className="p-6 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col h-[400px]">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Flux d'activité en direct
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Mises à jour instantanées de la mémoire d'équipe</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
              Temps réel
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {activities.map((act) => (
              <div 
                key={act.id} 
                className="flex gap-3 text-xs p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group border border-transparent hover:border-slate-150 dark:hover:border-slate-800"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                  {act.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                    <span className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{act.user}</span>
                    {` `}{act.action}{` `}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">"{act.target}"</span>
                  </p>
                  
                  <div className="flex items-center gap-2.5 mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 shrink-0" />
                      {act.timestamp}
                    </span>
                    {act.location && (
                      <span className="flex items-center gap-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {act.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Approvals: "Actions en attente" */}
        <div className="p-6 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col h-[400px]">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BellRing className="w-4 h-4 text-indigo-500" />
                Actions en attente d'approbation
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Décisions nécessitant votre validation finale</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/30">
              {pendingActions.length} urgentes
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {pendingActions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2 animate-bounce" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Aucune action en attente !</h4>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Toutes les décisions et dépenses de l'équipe ont été arbitrées.</p>
              </div>
            ) : (
              pendingActions.map((item) => (
                <div 
                  key={item.id} 
                  className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-800 hover:border-indigo-500/30 transition-all duration-200 flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-extrabold tracking-widest px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 uppercase">
                        {item.type}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Demandeur : {item.requester}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white leading-snug mt-1">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic pl-2.5 border-l-2 border-slate-300 dark:border-slate-700 mt-1.5">
                      {item.details}
                    </p>
                  </div>

                  {/* Approve / Reject Actions */}
                  <div className="flex items-center gap-2 justify-end mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      id={`reject-action-${item.id}`}
                      onClick={() => handleReject(item.id, item.title)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      Rejeter
                    </button>
                    <button
                      id={`approve-action-${item.id}`}
                      onClick={() => handleApprove(item.id, item.title)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      Approuver
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
