import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, Loader2, Square } from 'lucide-react';
import { generateSpeech } from '../services/gemini';
import { pcmToWavBlob } from '../utils/audioUtils';

export interface TeacherAudioPlayerProps {
  text: string;
  voiceName?: string;
  label?: string;
  variant?: 'banner' | 'pill' | 'compact';
  disabled?: boolean;
  onPlayStateChange?: (isPlaying: boolean) => void;
  className?: string;
  id?: string;
}

export const TeacherAudioPlayer: React.FC<TeacherAudioPlayerProps> = ({
  text,
  voiceName = 'Kore',
  label = 'Listen to Teacher',
  variant = 'pill',
  disabled = false,
  onPlayStateChange,
  className = '',
  id,
}) => {
  const playerId = useRef(id || `tap-${Math.random().toString(36).substring(2, 9)}`).current;
  
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const cachedTextRef = useRef<string>(text);

  // Clean text by stripping parenthetical notes or formatting
  const sanitizedText = text
    .replace(/\(.*?\)/g, '')
    .replace(/\[\[.*?\]\]/g, (match) => match.slice(2, -2))
    .trim();

  // Reset audio if text changes
  useEffect(() => {
    if (cachedTextRef.current !== text) {
      cleanupAudio();
      cachedTextRef.current = text;
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [text]);

  // Global audio listener to stop this player if another starts or recording begins
  useEffect(() => {
    const handleOtherPlay = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string }>;
      if (customEvent.detail?.id !== playerId && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setIsPlaying(false);
        setIsPaused(true);
      }
    };

    const handleStopAll = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentTime(0);
      }
    };

    window.addEventListener('teacher-audio-play', handleOtherPlay);
    window.addEventListener('teacher-audio-stop-all', handleStopAll);

    return () => {
      window.removeEventListener('teacher-audio-play', handleOtherPlay);
      window.removeEventListener('teacher-audio-stop-all', handleStopAll);
    };
  }, [playerId]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  const cleanupAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  };

  const setupAudioElement = (url: string): HTMLAudioElement => {
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.onplay = () => {
      setIsPlaying(true);
      setIsPaused(false);
      onPlayStateChange?.(true);
      // Notify other players to pause
      window.dispatchEvent(new CustomEvent('teacher-audio-play', { detail: { id: playerId } }));
    };

    audio.onpause = () => {
      if (!audio.ended) {
        setIsPlaying(false);
        setIsPaused(true);
      }
      onPlayStateChange?.(false);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentTime(0);
      onPlayStateChange?.(false);
    };

    audio.onerror = (e) => {
      console.error("Audio playback error:", e);
      setIsPlaying(false);
      setIsPaused(false);
      onPlayStateChange?.(false);
    };

    return audio;
  };

  const handlePlayOrResume = async () => {
    if (disabled || isLoading) return;

    // 1. If audio element is already loaded, resume
    if (audioRef.current) {
      try {
        await audioRef.current.play();
        return;
      } catch (err) {
        console.warn("Resume failed, regenerating audio...", err);
      }
    }

    // 2. Need to generate speech audio via Gemini
    if (!sanitizedText) return;

    setIsLoading(true);
    try {
      const pcmData = await generateSpeech(sanitizedText, voiceName);
      const wavBlob = pcmToWavBlob(pcmData, 24000, 1);
      const url = URL.createObjectURL(wavBlob);
      audioUrlRef.current = url;

      const audio = setupAudioElement(url);
      await audio.play();
    } catch (error) {
      console.error("Failed to generate or play teacher audio:", error);
      alert("Could not load teacher audio. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = () => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  };

  const handleRestart = async () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    try {
      await audioRef.current.play();
    } catch (err) {
      console.error("Restart error:", err);
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentTime(0);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = percentage * duration;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // --- VARIANT 1: BANNER (Large Executive Bar for Main Reading Paragraph) ---
  if (variant === 'banner') {
    // Idle state: show primary "Listen to Teacher" button
    if (!isPlaying && !isPaused && !isLoading && currentTime === 0) {
      return (
        <button
          onClick={handlePlayOrResume}
          disabled={disabled}
          className={`
            flex items-center justify-center space-x-2 px-6 py-3 rounded-full font-medium text-sm transition-all shadow-sm hover:shadow-md
            bg-orange-500 text-white hover:bg-orange-600 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed
            ${className}
          `}
          title="Listen to the teacher read the text aloud"
        >
          <Volume2 className="w-4 h-4" />
          <span>{label}</span>
        </button>
      );
    }

    // Loading state
    if (isLoading) {
      return (
        <div className={`flex items-center space-x-2 px-5 py-2.5 rounded-full bg-slate-700/80 border border-slate-600/60 text-slate-300 text-sm shadow-sm ${className}`}>
          <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
          <span>Teacher voice loading...</span>
        </div>
      );
    }

    // Active playback bar (Playing or Paused)
    return (
      <div className={`flex items-center gap-3 bg-slate-700/90 border border-slate-600 px-4 py-2 rounded-2xl shadow-lg backdrop-blur-sm transition-all ${className}`}>
        
        {/* Play / Pause Toggle Button */}
        {isPlaying ? (
          <button
            onClick={handlePause}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs shadow transition-all active:scale-95"
            title="Pause teacher audio"
          >
            <Pause className="w-3.5 h-3.5 fill-current" />
            <span>Pause</span>
          </button>
        ) : (
          <button
            onClick={handlePlayOrResume}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs shadow transition-all active:scale-95 disabled:opacity-50"
            title="Play / Resume teacher audio"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Play</span>
          </button>
        )}

        {/* Restart Button */}
        <button
          onClick={handleRestart}
          className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-slate-600 transition-colors"
          title="Replay from start"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Interactive Progress Timeline */}
        <div className="flex items-center gap-2">
          <div
            onClick={handleSeek}
            className="w-24 sm:w-32 h-2 bg-slate-800 rounded-full overflow-hidden cursor-pointer relative group"
            title="Click to seek"
          >
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-100"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-slate-400 select-none whitespace-nowrap min-w-[58px]">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Sound Wave Animation indicator */}
        <div className="flex items-center gap-0.5 h-3 px-1" title={isPlaying ? "Teacher speaking" : "Paused"}>
          <div className={`w-0.5 bg-orange-400 rounded-full ${isPlaying ? 'h-3 animate-pulse' : 'h-1.5'}`} />
          <div className={`w-0.5 bg-orange-400 rounded-full ${isPlaying ? 'h-4 animate-bounce delay-75' : 'h-2'}`} />
          <div className={`w-0.5 bg-orange-400 rounded-full ${isPlaying ? 'h-2 animate-pulse delay-150' : 'h-1'}`} />
        </div>

        {/* Stop Button */}
        <button
          onClick={handleStop}
          className="p-1.5 rounded-full text-slate-400 hover:text-red-400 hover:bg-slate-600 transition-colors"
          title="Stop playback"
        >
          <Square className="w-3 h-3 fill-current" />
        </button>
      </div>
    );
  }

  // --- VARIANT 2: COMPACT (Minimal Icon-only Play/Pause button) ---
  if (variant === 'compact') {
    if (isLoading) {
      return (
        <div className={`p-1.5 rounded-full text-orange-500 bg-slate-700 ${className}`}>
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      );
    }

    if (isPlaying) {
      return (
        <button
          onClick={handlePause}
          className={`p-1.5 rounded-full text-orange-400 hover:text-white bg-orange-500/20 hover:bg-orange-500 border border-orange-500/40 transition-all ${className}`}
          title="Pause audio"
        >
          <Pause className="w-3.5 h-3.5 fill-current" />
        </button>
      );
    }

    return (
      <button
        onClick={handlePlayOrResume}
        disabled={disabled}
        className={`p-1.5 rounded-full text-slate-400 hover:text-orange-400 hover:bg-slate-700 border border-slate-600/50 transition-all disabled:opacity-40 ${className}`}
        title={isPaused ? "Resume audio" : label}
      >
        <Play className="w-3.5 h-3.5 fill-current" />
      </button>
    );
  }

  // --- VARIANT 3: PILL (Inline button with Play/Pause controls) ---
  if (isLoading) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-700/80 border border-slate-600 text-slate-300 text-xs ${className}`}>
        <Loader2 className="w-3 h-3 animate-spin text-orange-500" />
        <span>Loading...</span>
      </div>
    );
  }

  if (isPlaying) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400 text-xs shadow-sm ${className}`}>
        <button
          onClick={handlePause}
          className="flex items-center gap-1 font-semibold hover:text-white transition-colors"
          title="Pause teacher audio"
        >
          <Pause className="w-3 h-3 fill-current" />
          <span>Pause</span>
        </button>

        <button
          onClick={handleRestart}
          className="hover:text-white transition-colors p-0.5"
          title="Restart from beginning"
        >
          <RotateCcw className="w-2.5 h-2.5" />
        </button>

        <span className="font-mono text-[10px] text-orange-300/80">
          {formatTime(currentTime)}
        </span>

        {/* Animated wave bars */}
        <div className="flex items-center gap-0.5">
          <span className="w-0.5 h-2 bg-orange-400 animate-pulse" />
          <span className="w-0.5 h-3 bg-orange-400 animate-bounce delay-75" />
          <span className="w-0.5 h-1.5 bg-orange-400 animate-pulse delay-150" />
        </div>
      </div>
    );
  }

  if (isPaused) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-700 border border-slate-600 text-slate-300 text-xs shadow-sm ${className}`}>
        <button
          onClick={handlePlayOrResume}
          disabled={disabled}
          className="flex items-center gap-1 font-semibold text-orange-400 hover:text-orange-300 transition-colors disabled:opacity-50"
          title="Resume teacher audio"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>Play</span>
        </button>

        <button
          onClick={handleRestart}
          className="hover:text-slate-100 transition-colors p-0.5 text-slate-400"
          title="Restart from beginning"
        >
          <RotateCcw className="w-2.5 h-2.5" />
        </button>

        <span className="font-mono text-[10px] text-slate-400">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    );
  }

  // Idle state
  return (
    <button
      onClick={handlePlayOrResume}
      disabled={disabled}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shadow-sm
        bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 hover:border-orange-500/50
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      title="Listen to teacher"
    >
      <Volume2 className="w-3.5 h-3.5 text-orange-500" />
      <span>{label}</span>
    </button>
  );
};
