import React from 'react';
import { useLocalization } from '../context/LocalizationContext';
import { SpiralDynamicsResult } from './PersonalitySurvey';

interface SpiralDynamicsVisualizationProps {
  result: SpiralDynamicsResult;
}

// Fixed order for SD levels - highest development at top
// ICH-orientiert (Individual/Express-self): Yellow, Orange, Red, Beige
// WIR-orientiert (Collective/Sacrifice-self): Turquoise, Green, Blue, Purple
const ICH_LEVELS = ['yellow', 'orange', 'red', 'beige'] as const;
const WIR_LEVELS = ['turquoise', 'green', 'blue', 'purple'] as const;

// Colors matching the SD model
const LEVEL_COLORS: Record<string, string> = {
  beige: '#C4A66B',      // Earthy beige
  purple: '#8B5CF6',     // Purple
  red: '#EF4444',        // Red
  blue: '#3B82F6',       // Blue
  orange: '#F97316',     // Orange
  green: '#22C55E',      // Green
  yellow: '#EAB308',     // Yellow
  turquoise: '#14B8A6',  // Turquoise/Teal
};

// Descriptive keywords for each level (what it represents, not the color name)
const LEVEL_KEYWORDS: Record<string, string> = {
  beige: 'Safety',
  purple: 'Belonging',
  red: 'Power',
  blue: 'Order',
  orange: 'Achievement',
  green: 'Harmony',
  yellow: 'Integration',
  turquoise: 'Holism',
};

const SpiralDynamicsVisualization: React.FC<SpiralDynamicsVisualizationProps> = ({
  result,
}) => {
  const { t } = useLocalization();

  // Get level value (1-5 scale from Likert)
  const getLevelValue = (levelId: string): number => {
    return result.levels[levelId as keyof typeof result.levels] || 3;
  };

  // Render a single level bar - pure data, no interpretation markers
  const renderLevelBar = (levelId: string) => {
    const value = getLevelValue(levelId);
    const color = LEVEL_COLORS[levelId];
    const keyword = LEVEL_KEYWORDS[levelId];
    const percentage = (value / 5) * 100;

    return (
      <div key={levelId} className="flex items-center gap-2 py-1.5">
        {/* Color dot and keyword */}
        <div className="w-24 flex items-center gap-1.5 shrink-0">
          <div 
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs font-medium truncate text-content-secondary">
            {keyword}
          </span>
        </div>
        
        {/* Progress bar with value always inside */}
        <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden relative">
          <div 
            className="h-full rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-2"
            style={{ 
              width: `${Math.max(percentage, 20)}%`, // Min 20% to ensure value is visible
              backgroundColor: color
            }}
          >
            <span className="text-xs font-bold text-white drop-shadow-sm">
              {value.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ICH-orientiert Column */}
        <div className="p-4 rounded-lg border border-border-secondary dark:border-border-primary bg-background-primary dark:bg-background-primary">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-content-primary">
              {t('sd_strand_ich') || 'Ich-orientiert'}
            </h4>
            <p className="text-xs text-content-tertiary">
              {t('sd_strand_ich_desc') || 'Selbstausdruck & Autonomie'}
            </p>
          </div>
          <div className="space-y-0.5">
            {ICH_LEVELS.map((id) => renderLevelBar(id))}
          </div>
        </div>

        {/* WIR-orientiert Column */}
        <div className="p-4 rounded-lg border border-border-secondary dark:border-border-primary bg-background-primary dark:bg-background-primary">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-content-primary">
              {t('sd_strand_wir') || 'Wir-orientiert'}
            </h4>
            <p className="text-xs text-content-tertiary">
              {t('sd_strand_wir_desc') || 'Gemeinschaft & Zugehörigkeit'}
            </p>
          </div>
          <div className="space-y-0.5">
            {WIR_LEVELS.map((id) => renderLevelBar(id))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpiralDynamicsVisualization;
