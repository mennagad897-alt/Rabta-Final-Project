import React from 'react';

interface MatchScoreBadgeProps {
  score?: number | null;
  reason?: string | null;
}

const MatchScoreBadge: React.FC<MatchScoreBadgeProps> = ({ score, reason }) => {
  if (score === undefined || score === null) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-[#262626] border border-gray-200 dark:border-white/5 animate-pulse relative group">
        <span className="material-icons-round text-sm text-gray-400">psychology</span>
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">AI Calculating...</span>
      </div>
    );
  }

  let colorClasses = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-900/50";
  let icon = "warning";

  if (score >= 80) {
    colorClasses = "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-900/50";
    icon = "check_circle";
  } else if (score >= 50) {
    colorClasses = "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-900/50";
    icon = "info";
  }

  return (
    <div className={`relative flex items-center gap-1.5 px-3 py-1 rounded-full border ${colorClasses} group cursor-help transition-all hover:shadow-md`}>
      <span className="material-icons-round text-[16px]">{icon}</span>
      <span className="text-sm font-black">{score}% Match</span>

      {/* Tooltip / Popover on hover */}
      {reason && (
        <div className="absolute top-full right-0 mt-2 hidden group-hover:block w-auto min-w-[250px] max-w-md p-4 bg-gray-900 text-white text-xs rounded-xl shadow-xl z-50 animate-fade-in pointer-events-none whitespace-normal break-words before:content-[''] before:absolute before:bottom-full before:right-6 before:border-8 before:border-transparent before:border-b-gray-900">
          <div className="flex items-start gap-2">
            <span className="material-icons-round text-[14px] text-purple-400 shrink-0">psychology</span>
            <span className="leading-relaxed font-medium block">{reason}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchScoreBadge;
