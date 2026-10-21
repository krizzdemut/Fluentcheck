import React, { useState } from 'react';
import { Topic, DifficultyLevel } from '../types';
import { BookOpen, Camera, Film, Gamepad2, Globe, Laptop, Zap, Sun, Utensils, Briefcase, Plane } from 'lucide-react';

interface TopicSelectorProps {
  onSelectTopic: (topic: Topic, difficulty: DifficultyLevel) => void;
  isLoading: boolean;
}

const TOPIC_ICONS: Record<Topic, React.ReactNode> = {
  [Topic.DAILY_LIFE]: <BookOpen strokeWidth={1.5} />,
  [Topic.EIGHTIES_VS_NOW]: <Camera strokeWidth={1.5} />,
  [Topic.COUNTRY_VS_CITY]: <Globe strokeWidth={1.5} />,
  [Topic.TECHNOLOGY]: <Laptop strokeWidth={1.5} />,
  [Topic.HOBBIES]: <Gamepad2 strokeWidth={1.5} />,
  [Topic.WEIRD_TYPICAL]: <Zap strokeWidth={1.5} />,
  [Topic.MOVIES]: <Film strokeWidth={1.5} />,
  [Topic.HOLIDAYS]: <Sun strokeWidth={1.5} />,
  [Topic.FOOD]: <Utensils strokeWidth={1.5} />,
  [Topic.BUSINESS]: <Briefcase strokeWidth={1.5} />,
  [Topic.TRAVEL]: <Plane strokeWidth={1.5} />,
};

const LEVELS = [
  { id: DifficultyLevel.BEGINNER, label: 'Beginner (A1-A2)' },
  { id: DifficultyLevel.INTERMEDIATE, label: 'Intermediate (B1-B2)' },
  { id: DifficultyLevel.ADVANCED, label: 'Advanced (C1-C2)' },
];

export const TopicSelector: React.FC<TopicSelectorProps> = ({ onSelectTopic, isLoading }) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>(DifficultyLevel.BEGINNER);

  return (
    <div className="max-w-5xl mx-auto animate-fade-in-up">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-semibold text-slate-100 mb-6 tracking-tight">Learn by doing.</h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto font-light leading-relaxed mb-10">
          Select your level and a topic to start your pronunciation practice. Instant AI feedback.
        </p>

        {/* Difficulty Segmented Control */}
        <div className="inline-flex bg-slate-800 p-1.5 rounded-full relative border border-slate-700/50">
          {LEVELS.map((level) => (
            <button
              key={level.id}
              onClick={() => setSelectedDifficulty(level.id)}
              className={`
                relative px-6 py-2.5 text-sm font-medium rounded-full transition-all duration-300 z-10
                ${selectedDifficulty === level.id 
                  ? 'text-slate-100 shadow-md bg-slate-700' 
                  : 'text-slate-400 hover:text-slate-200'}
              `}
            >
              {level.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.values(Topic).map((topic) => (
          <button
            key={topic}
            onClick={() => !isLoading && onSelectTopic(topic, selectedDifficulty)}
            disabled={isLoading}
            className={`
              group relative flex flex-col items-center text-center p-8
              bg-slate-800 rounded-3xl transition-all duration-300 ease-out border border-slate-700/50
              ${isLoading 
                ? 'opacity-50 cursor-not-allowed scale-[0.98]' 
                : 'hover:scale-[1.02] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.4)] shadow-[0_2px_10px_rgba(0,0,0,0.2)]'}
            `}
          >
            <div className={`
              w-16 h-16 rounded-full flex items-center justify-center mb-6 transition-colors duration-300
              ${isLoading ? 'bg-slate-700 text-slate-500' : 'bg-slate-700/50 text-slate-300 group-hover:bg-orange-500 group-hover:text-white'}
            `}>
              {React.cloneElement(TOPIC_ICONS[topic] as React.ReactElement<any>, { className: "w-8 h-8" })}
            </div>
            
            <h3 className="text-lg font-medium text-slate-100 group-hover:text-white transition-colors">
              {topic}
            </h3>
            <span className="mt-2 text-[13px] text-slate-400 font-medium group-hover:text-orange-500 transition-colors">
              Start {selectedDifficulty} Practice &rarr;
            </span>
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex flex-col items-center justify-center transition-all">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-orange-500 border-t-transparent mb-4"></div>
          <p className="text-slate-100 font-medium">Creating your {selectedDifficulty.toLowerCase()} lesson...</p>
        </div>
      )}
    </div>
  );
};
