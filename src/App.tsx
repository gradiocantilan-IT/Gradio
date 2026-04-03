import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Howl, Howler } from 'howler';
import { io, Socket } from 'socket.io-client';
import { Visualizer } from './components/Visualizer';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Heart, 
  Search, 
  Radio, 
  History, 
  ListMusic, 
  MapPin, 
  Info,
  SkipBack,
  SkipForward,
  Menu,
  X,
  Mic2,
  Newspaper,
  Music,
  Cast,
  Settings,
  AlertCircle,
  MessageSquare,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Modality } from "@google/genai";
import { RADIO_STATIONS } from './constants';
import { RadioStation, PlayerState } from './types';

const ADS = [
  {
    id: 1,
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRsMpvV6-XopeMTU2H1VRdaddqVk9Ckaeao7g&s',
    title: 'Eyeberry: Natural Vision Support',
    subtitle: 'Rich in antioxidants for your daily eye health'
  },
  {
    id: 2,
    image: 'https://down-ph.img.susercontent.com/file/ph-11134207-81ztf-mm5p7rs2slxh97',
    title: 'Eyeberry Gold: Premium Protection',
    subtitle: 'Enhanced formula with Lutein and Zeaxanthin'
  },
  {
    id: 3,
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR_8xsCtywh-ygyEI3VllELoZNYyusG1yxBHw&s',
    title: 'See the World Clearly',
    subtitle: 'The #1 choice for Filipino eye care'
  }
];

function HeroSlideshow() {
  const [currentAd, setCurrentAd] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentAd((prev) => (prev + 1) % ADS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative h-48 sm:h-64 lg:h-80 rounded-2xl overflow-hidden mb-8 group">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentAd}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <img 
            src={ADS[currentAd].image} 
            alt={ADS[currentAd].title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6 lg:p-10">
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-spotify-green text-xs lg:text-sm font-bold uppercase tracking-widest mb-2"
            >
              Featured
            </motion.p>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl lg:text-5xl font-black text-white mb-2 leading-tight"
            >
              {ADS[currentAd].title}
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-spotify-gray text-sm lg:text-lg max-w-xl"
            >
              {ADS[currentAd].subtitle}
            </motion.p>
          </div>
        </motion.div>
      </AnimatePresence>
      
      {/* Indicators */}
      <div className="absolute bottom-4 right-6 flex gap-2 z-10">
        {ADS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentAd(i)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              currentAd === i ? 'w-6 bg-spotify-green' : 'bg-white/30 hover:bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}


export default function App() {
  const [state, setState] = useState<PlayerState>(() => {
    const savedFavs = localStorage.getItem('pinoyRadio_favorites');
    const savedRecent = localStorage.getItem('pinoyRadio_recent');
    return {
      currentStation: RADIO_STATIONS[0] || null,
      isPlaying: false,
      volume: 70,
      isMuted: false,
      favorites: savedFavs ? JSON.parse(savedFavs) : [],
      recentlyPlayed: savedRecent ? JSON.parse(savedRecent) : []
    };
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [view, setView] = useState<'all' | 'favorites' | 'recent'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDjSpeaking, setIsDjSpeaking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [rtmpsUrl, setRtmpsUrl] = useState('');
  const [streamStatus, setStreamStatus] = useState<'idle' | 'starting' | 'live' | 'error'>('idle');
  const [showStreamingModal, setShowStreamingModal] = useState(false);
  const [shoutout, setShoutout] = useState('');
  const [pendingShoutouts, setPendingShoutouts] = useState<string[]>([]);
  const [showDjBooth, setShowDjBooth] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const howlRef = useRef<Howl | null>(null);
  const djAudioRef = useRef<HTMLAudioElement | null>(null);
  const djSourceNodeRef = useRef<any>(null);
  const destNodeRef = useRef<any>(null);

  // Initialize socket
  useEffect(() => {
    socketRef.current = io();
    
    socketRef.current.on('stream-status', ({ status, message }) => {
      if (status === 'started') {
        setStreamStatus('live');
      } else if (status === 'error') {
        setStreamStatus('error');
        setError(message || 'Failed to start stream');
        stopStreaming();
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const startStreaming = () => {
    if (!rtmpsUrl) {
      setError('Please enter an RTMPS URL');
      return;
    }

    // Basic validation for Facebook/YouTube RTMPS URLs
    if (rtmpsUrl.includes('facebook.com') && !rtmpsUrl.includes('/rtmp/')) {
      setError('Invalid Facebook RTMPS URL. Make sure it starts with rtmps:// and includes the stream key.');
      return;
    }

    if (rtmpsUrl.endsWith('/rtmp/') || rtmpsUrl.endsWith('/live2/')) {
      setError('Missing Stream Key. Please append your stream key to the URL.');
      return;
    }

    setStreamStatus('starting');
    setIsStreaming(true);

    try {
      // Ensure AudioContext is running
      if (Howler.ctx.state === 'suspended') {
        Howler.ctx.resume();
      }

      // Capture audio from Howler (only once)
      if (!destNodeRef.current) {
        destNodeRef.current = Howler.ctx.createMediaStreamDestination();
        Howler.masterGain.connect(destNodeRef.current);
      }

      // Also capture DJ audio if playing (only once)
      if (djAudioRef.current && !djSourceNodeRef.current) {
        try {
          djSourceNodeRef.current = Howler.ctx.createMediaElementSource(djAudioRef.current);
          djSourceNodeRef.current.connect(destNodeRef.current);
          djSourceNodeRef.current.connect(Howler.ctx.destination); // Still play locally
        } catch (e) {
          console.warn("DJ Source already connected or failed:", e);
        }
      }

      const mediaRecorder = new MediaRecorder(destNodeRef.current.stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('stream-data', event.data);
        }
      };

      socketRef.current?.emit('start-stream', { rtmpsUrl });
      mediaRecorder.start(2000); // Send chunks every 2 seconds
    } catch (err) {
      console.error('Failed to start media recorder:', err);
      setStreamStatus('error');
      setIsStreaming(false);
      setError('Streaming failed to initialize. Please try again.');
    }
  };

  const stopStreaming = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    socketRef.current?.emit('stop-stream');
    setIsStreaming(false);
    setStreamStatus('idle');
  };

  const playNext = () => {
    const currentIndex = RADIO_STATIONS.findIndex(s => s.id === state.currentStation?.id);
    const nextIndex = (currentIndex + 1) % RADIO_STATIONS.length;
    const nextStation = RADIO_STATIONS[nextIndex];
    selectStation(nextStation);
  };

  const playPrevious = () => {
    const currentIndex = RADIO_STATIONS.findIndex(s => s.id === state.currentStation?.id);
    const prevIndex = (currentIndex - 1 + RADIO_STATIONS.length) % RADIO_STATIONS.length;
    const prevStation = RADIO_STATIONS[prevIndex];
    selectStation(prevStation);
  };

  const triggerAiDj = async (currentStation: RadioStation, nextStation: RadioStation) => {
    setIsDjSpeaking(true);
    const currentShoutouts = [...pendingShoutouts];
    setPendingShoutouts([]); // Clear for next time

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const shoutoutContext = currentShoutouts.length > 0 
        ? `Also, give a quick shoutout to: ${currentShoutouts.join(', ')}.`
        : '';

      const prompt = `You are a cool, energetic AI DJ for GRADIO Station. 
      The song that just finished was "${currentStation.name}". 
      The next song coming up is "${nextStation.name}". 
      ${shoutoutContext}
      Give a very short, energetic 1-2 sentence transition in Taglish (Tagalog-English). 
      Make it sound like a real radio DJ transition. 
      Keep it brief and exciting. 
      Example: "Grabe, solid yung ${currentStation.name}! Up next, we have ${nextStation.name}. Keep it locked here on GRADIO Station!"`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Puck' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        // Convert raw PCM to WAV
        const binaryString = window.atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const sampleRate = 24000;
        const numChannels = 1;
        const bitsPerSample = 16;
        
        const header = new ArrayBuffer(44);
        const view = new DataView(header);
        
        view.setUint32(0, 0x52494646, false); // RIFF
        view.setUint32(4, 36 + bytes.length, true);
        view.setUint32(8, 0x57415645, false); // WAVE
        view.setUint32(12, 0x666d7420, false); // fmt 
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true);
        view.setUint16(32, numChannels * bitsPerSample / 8, true);
        view.setUint16(34, bitsPerSample, true);
        view.setUint32(36, 0x64617461, false); // data
        view.setUint32(40, bytes.length, true);
        
        const blob = new Blob([header, bytes], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(blob);
        
        if (djAudioRef.current) {
          djAudioRef.current.src = audioUrl;
          djAudioRef.current.play().catch(err => {
            console.error("DJ Play Error:", err);
            playNext();
          });
        }
      } else {
        playNext();
      }
    } catch (error) {
      console.error("AI DJ Error:", error);
      setIsDjSpeaking(false);
      playNext();
    }
  };

  // Sync audio state with component state
  useEffect(() => {
    if (!state.currentStation) return;

    const streamUrl = state.currentStation.streamUrl;

    // If station changed or no howl instance, create new one
    const currentHowlSrc = (howlRef.current as any)?._src;
    const isSameSrc = Array.isArray(currentHowlSrc) 
      ? currentHowlSrc[0] === streamUrl 
      : currentHowlSrc === streamUrl;

    if (!howlRef.current || !isSameSrc) {
      if (howlRef.current) {
        howlRef.current.unload();
      }

      setIsLoading(true);
      setError(null);

      howlRef.current = new Howl({
        src: [streamUrl],
        html5: false, // Use Web Audio for better reliability with CORS
        autoplay: false,
        volume: state.isMuted ? 0 : state.volume / 100,
        onload: () => {
          setIsLoading(false);
        },
        onloaderror: (id, err) => {
          console.error("Howl Load Error:", err);
          if (!navigator.onLine) {
            setError("You are offline. Please check your internet connection.");
          } else {
            setError("Failed to load stream. The station might be offline.");
          }
          setIsLoading(false);
          setState(prev => ({ ...prev, isPlaying: false }));
        },
        onplayerror: (id, err) => {
          console.error("Howl Play Error:", err);
          setError("Playback failed. Please try again.");
          setIsLoading(false);
          setState(prev => ({ ...prev, isPlaying: false }));
        },
        onplay: () => {
          setIsLoading(false);
        },
        onpause: () => {
          setIsLoading(false);
        },
        onend: () => {
          const currentIndex = RADIO_STATIONS.findIndex(s => s.id === state.currentStation?.id);
          const nextIndex = (currentIndex + 1) % RADIO_STATIONS.length;
          const nextStation = RADIO_STATIONS[nextIndex];
          triggerAiDj(state.currentStation!, nextStation);
        }
      });
    }

    if (state.isPlaying) {
      if (!howlRef.current.playing()) {
        howlRef.current.play();
      }
    } else {
      if (howlRef.current.playing()) {
        howlRef.current.pause();
      }
    }

    return () => {
      // Cleanup is handled when station changes or component unmounts
    };
  }, [state.currentStation?.id, state.isPlaying]);

  // Persist state
  useEffect(() => {
    localStorage.setItem('pinoyRadio_favorites', JSON.stringify(state.favorites));
  }, [state.favorites]);

  useEffect(() => {
    localStorage.setItem('pinoyRadio_recent', JSON.stringify(state.recentlyPlayed));
  }, [state.recentlyPlayed]);

  // Audio control (Volume/Mute)
  useEffect(() => {
    if (howlRef.current) {
      howlRef.current.volume(state.isMuted ? 0 : state.volume / 100);
    }
  }, [state.volume, state.isMuted]);

  const togglePlay = () => {
    if (!state.currentStation) return;
    setError(null);
    setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const selectStation = (station: RadioStation) => {
    if (state.currentStation?.id === station.id) {
      togglePlay();
      return;
    }

    setState(prev => {
      const newRecent = [station.id, ...prev.recentlyPlayed.filter(id => id !== station.id)].slice(0, 10);
      return {
        ...prev,
        currentStation: station,
        isPlaying: true, // Auto play on select
        recentlyPlayed: newRecent
      };
    });
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setState(prev => ({
      ...prev,
      favorites: prev.favorites.includes(id) 
        ? prev.favorites.filter(fid => fid !== id)
        : [...prev.favorites, id]
    }));
  };

  const filteredStations = useMemo(() => {
    let stations = RADIO_STATIONS;
    
    if (view === 'favorites') {
      stations = stations.filter(s => state.favorites.includes(s.id));
    } else if (view === 'recent') {
      stations = state.recentlyPlayed
        .map(id => RADIO_STATIONS.find(s => s.id === id))
        .filter((s): s is RadioStation => !!s);
    }

    if (activeCategory !== 'All') {
      stations = stations.filter(s => s.category === activeCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      stations = stations.filter(s => 
        s.name.toLowerCase().includes(query) || 
        s.frequency?.toLowerCase().includes(query) ||
        s.category.toLowerCase().includes(query)
      );
    }

    return stations;
  }, [searchQuery, activeCategory, view, state.favorites, state.recentlyPlayed]);

  const categories = ['All', 'Manila', 'Provincial', 'News', 'Music'];

  return (
    <div className="flex h-screen bg-spotify-black text-white overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-black transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-spotify-green rounded-full flex items-center justify-center shadow-lg shadow-spotify-green/20">
              <Radio className="text-black w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Pinoy Radio</h1>
          </div>

          <nav className="space-y-1">
            <SidebarLink 
              icon={<Radio className="w-5 h-5" />} 
              label="All Stations" 
              active={view === 'all'} 
              onClick={() => { setView('all'); setIsSidebarOpen(false); }} 
            />
            <SidebarLink 
              icon={<Heart className="w-5 h-5" />} 
              label="Favorites" 
              active={view === 'favorites'} 
              onClick={() => { setView('favorites'); setIsSidebarOpen(false); }} 
            />
            <SidebarLink 
              icon={<History className="w-5 h-5" />} 
              label="Recently Played" 
              active={view === 'recent'} 
              onClick={() => { setView('recent'); setIsSidebarOpen(false); }} 
            />
            <SidebarLink 
              icon={<Cast className="w-5 h-5" />} 
              label="Go Live (RTMPS)" 
              active={showStreamingModal} 
              onClick={() => { setShowStreamingModal(true); setIsSidebarOpen(false); }} 
            />
            <SidebarLink 
              icon={<Mic2 className="w-5 h-5" />} 
              label="DJ Booth" 
              active={showDjBooth} 
              onClick={() => { setShowDjBooth(true); setIsSidebarOpen(false); }} 
            />
          </nav>

          <div className="mt-8">
            <h2 className="text-xs font-bold text-spotify-gray uppercase tracking-widest mb-4 px-4">Categories</h2>
            <div className="space-y-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setView('all'); setIsSidebarOpen(false); }}
                  className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeCategory === cat ? 'bg-spotify-light text-white' : 'text-spotify-gray hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {cat === 'News' && <Newspaper className="w-4 h-4" />}
                    {cat === 'Music' && <Music className="w-4 h-4" />}
                    {cat === 'Manila' && <MapPin className="w-4 h-4" />}
                    {cat === 'Provincial' && <Mic2 className="w-4 h-4" />}
                    {cat === 'All' && <ListMusic className="w-4 h-4" />}
                    {cat}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-6 border-t border-spotify-light">
            <div className="bg-spotify-light/50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-spotify-gray mb-2">
                <Info className="w-3 h-3" />
                <span>About</span>
              </div>
              <p className="text-[10px] text-spotify-gray leading-relaxed">
                Pinoy Radio provides live streaming of Philippine radio stations. All streams are property of their respective owners.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-spotify-light/30 to-spotify-black">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 bg-spotify-black/40 backdrop-blur-md sticky top-0 z-40">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-spotify-gray hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex-1 max-w-xl mx-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-spotify-gray group-focus-within:text-white transition-colors" />
              <input
                type="text"
                placeholder="Search stations, frequencies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-spotify-light/50 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-spotify-green/50 transition-all placeholder:text-spotify-gray text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-spotify-light/50 rounded-full px-3 py-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-spotify-gray">Live Streams</span>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 pb-32">
          {view === 'all' && activeCategory === 'All' && !searchQuery && <HeroSlideshow />}
          
          <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold mb-2">
                {view === 'favorites' ? 'Your Favorites' : view === 'recent' ? 'Recently Played' : activeCategory === 'All' ? 'Browse All' : activeCategory}
              </h2>
              <p className="text-spotify-gray text-sm">
                {filteredStations.length} stations available
              </p>
            </div>
            {state.isPlaying && state.currentStation && (
              <div className="flex items-center gap-4 bg-spotify-light/30 px-4 py-2 rounded-2xl backdrop-blur-sm border border-white/5">
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] text-spotify-green font-bold uppercase tracking-tighter">Now Playing</p>
                  <p className="text-xs font-bold text-white truncate max-w-[150px]">{state.currentStation.name}</p>
                </div>
                <div className="w-24 h-8">
                  <Visualizer 
                    audioContext={Howler.ctx} 
                    sourceNode={Howler.masterGain} 
                    isDjSpeaking={isDjSpeaking} 
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredStations.map((station) => (
                <motion.div
                  layout
                  key={station.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => selectStation(station)}
                  className={`
                    group relative bg-spotify-dark/40 hover:bg-spotify-light/60 p-4 rounded-xl transition-all duration-300 cursor-pointer
                    border border-transparent hover:border-spotify-green/20
                    ${state.currentStation?.id === station.id ? 'bg-spotify-light/80 border-spotify-green/30' : ''}
                  `}
                >
                  <div className="relative aspect-square mb-4 bg-spotify-light rounded-lg flex items-center justify-center overflow-hidden">
                    {station.logoUrl ? (
                      <img 
                        src={station.logoUrl} 
                        alt={station.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Radio className={`w-12 h-12 ${state.currentStation?.id === station.id ? 'text-spotify-green' : 'text-spotify-gray'}`} />
                    )}
                    
                    {/* Play Overlay */}
                    <div className={`
                      absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300
                      ${state.currentStation?.id === station.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                    `}>
                      <div className="w-12 h-12 bg-spotify-green rounded-full flex items-center justify-center shadow-xl transform transition-transform duration-300 group-hover:scale-110">
                        {state.currentStation?.id === station.id && state.isPlaying ? (
                          <Pause className="text-black fill-black w-6 h-6" />
                        ) : (
                          <Play className="text-black fill-black w-6 h-6 ml-1" />
                        )}
                      </div>
                    </div>

                    {/* Equalizer Animation */}
                    {state.currentStation?.id === station.id && state.isPlaying && (
                      <div className="absolute bottom-2 right-2 flex items-end gap-0.5 h-6">
                        {[1, 2, 3, 4].map(i => (
                          <div 
                            key={i} 
                            className="w-1 bg-spotify-green animate-equalizer" 
                            style={{ animationDelay: `${i * 0.1}s` }} 
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold truncate group-hover:text-spotify-green transition-colors">{station.name}</h3>
                        <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-spotify-green/10 text-spotify-green font-bold uppercase tracking-wider">
                          {station.category}
                        </span>
                      </div>
                      <p className="text-xs text-spotify-gray flex items-center gap-1">
                        <span className="font-medium text-spotify-green">{station.frequency}</span>
                        <span>•</span>
                        <span className="truncate">{station.location}</span>
                      </p>
                      {station.description && (
                        <p className="text-[11px] text-spotify-gray/80 mt-2 line-clamp-2 leading-relaxed">
                          {station.description}
                        </p>
                      )}
                    </div>
                    <button 
                      onClick={(e) => toggleFavorite(station.id, e)}
                      className={`p-2 rounded-full hover:bg-white/10 transition-colors flex-shrink-0 ${state.favorites.includes(station.id) ? 'text-spotify-green' : 'text-spotify-gray'}`}
                    >
                      <Heart className={`w-5 h-5 ${state.favorites.includes(station.id) ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {filteredStations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-spotify-gray">
              <Search className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">No stations found</p>
              <p className="text-sm">Try adjusting your search or category</p>
            </div>
          )}
        </div>

        {/* Player Bar */}
        <footer className="fixed bottom-0 left-0 right-0 h-24 bg-black border-t border-spotify-light px-4 lg:px-6 flex items-center justify-between z-50">
          {/* Current Station Info */}
          <div className="flex items-center gap-4 w-1/3 min-w-0">
            {state.currentStation ? (
              <>
                <div className={`w-14 h-14 bg-spotify-light rounded-md flex items-center justify-center flex-shrink-0 relative overflow-hidden ${(state.isPlaying || isDjSpeaking) ? 'ring-2 ring-spotify-green/50' : ''}`}>
                  {isDjSpeaking ? (
                    <Mic2 className="w-8 h-8 z-10 text-spotify-green animate-pulse" />
                  ) : state.currentStation.logoUrl ? (
                    <img 
                      src={state.currentStation.logoUrl} 
                      alt={state.currentStation.name}
                      className="w-full h-full object-cover z-10"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Radio className={`w-8 h-8 z-10 ${state.isPlaying ? 'text-spotify-green' : 'text-spotify-gray'}`} />
                  )}
                  {(state.isPlaying || isDjSpeaking) && (
                    <motion.div 
                      animate={{ 
                        scale: [1, 1.5, 1],
                        opacity: [0.1, 0.3, 0.1]
                      }}
                      transition={{ 
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      className="absolute inset-0 bg-spotify-green rounded-full"
                    />
                  )}
                  {isLoading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-spotify-green border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold truncate">
                    {isDjSpeaking ? 'AI DJ Puck' : state.currentStation.name}
                  </h4>
                  <div className="flex items-center gap-2">
                    <p className={`text-xs truncate ${error ? 'text-red-500 font-medium' : 'text-spotify-gray'}`}>
                      {isDjSpeaking ? 'GRADIO Station • On Air' : (error || `${state.currentStation.frequency} • ${state.currentStation.location}`)}
                    </p>
                    {error && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                        className="text-[10px] bg-spotify-green/20 text-spotify-green px-2 py-0.5 rounded hover:bg-spotify-green/30 transition-colors uppercase font-bold"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
                <button 
                  onClick={(e) => toggleFavorite(state.currentStation!.id, e)}
                  className={`p-2 hover:text-white transition-colors ${state.favorites.includes(state.currentStation.id) ? 'text-spotify-green' : 'text-spotify-gray'}`}
                >
                  <Heart className={`w-5 h-5 ${state.favorites.includes(state.currentStation.id) ? 'fill-current' : ''}`} />
                </button>
              </>
            ) : (
              <div className="text-spotify-gray text-sm italic">Select a station to start listening</div>
            )}
          </div>

          {/* Visualizer */}
          <div className="hidden xl:flex items-center justify-center w-1/6 h-8 px-4 opacity-40">
            {state.isPlaying && (
              <Visualizer 
                audioContext={Howler.ctx} 
                sourceNode={Howler.masterGain} 
                isDjSpeaking={isDjSpeaking} 
              />
            )}
          </div>

          {/* Player Controls */}
          <div className="flex flex-col items-center gap-2 w-1/3">
            <div className="flex items-center gap-6">
              <button 
                onClick={playPrevious}
                disabled={!state.currentStation || isDjSpeaking}
                className="text-spotify-gray hover:text-white transition-colors disabled:opacity-30"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>
              <button 
                onClick={togglePlay}
                disabled={!state.currentStation || isLoading || isDjSpeaking}
                className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50"
              >
                {state.isPlaying ? (
                  <Pause className="text-black fill-black w-5 h-5" />
                ) : (
                  <Play className="text-black fill-black w-5 h-5 ml-1" />
                )}
              </button>
              <button 
                onClick={playNext}
                disabled={!state.currentStation || isDjSpeaking}
                className="text-spotify-gray hover:text-white transition-colors disabled:opacity-30"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>
            </div>
            
            {/* Progress Bar (Fake for Radio) */}
            <div className="w-full max-w-md flex items-center gap-2">
              <span className="text-[10px] text-spotify-gray w-8 text-right">LIVE</span>
              <div className="flex-1 h-1 bg-spotify-light rounded-full overflow-hidden">
                <div className={`h-full bg-spotify-green ${state.isPlaying ? 'w-full' : 'w-0'} transition-all duration-1000`} />
              </div>
              <span className="text-[10px] text-spotify-gray w-8">∞</span>
            </div>
          </div>

          {/* Volume Controls */}
          <div className="flex items-center justify-end gap-3 w-1/3">
            <button 
              onClick={() => setState(prev => ({ ...prev, isMuted: !prev.isMuted }))}
              className="text-spotify-gray hover:text-white transition-colors"
            >
              {state.isMuted || state.volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <div className="w-24 h-1 bg-spotify-light rounded-full relative group">
              <input
                type="range"
                min="0"
                max="100"
                value={state.isMuted ? 0 : state.volume}
                onChange={(e) => setState(prev => ({ ...prev, volume: parseInt(e.target.value), isMuted: false }))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
              />
              <div 
                className="h-full bg-spotify-green rounded-full group-hover:bg-spotify-green transition-colors" 
                style={{ width: `${state.isMuted ? 0 : state.volume}%` }} 
              />
            </div>
          </div>
        </footer>
      </main>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* DJ Booth Modal */}
      <AnimatePresence>
        {showDjBooth && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-spotify-light w-full max-w-md rounded-xl p-6 shadow-2xl border border-white/10"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Mic2 className="w-6 h-6 text-spotify-green" />
                  <h2 className="text-xl font-bold">DJ Booth</h2>
                </div>
                <button 
                  onClick={() => setShowDjBooth(false)}
                  className="text-spotify-gray hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-spotify-gray uppercase mb-2">Send a Shoutout</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="e.g. Shoutout to my friends in QC!"
                      value={shoutout}
                      onChange={(e) => setShoutout(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && shoutout.trim()) {
                          setPendingShoutouts(prev => [...prev, shoutout.trim()]);
                          setShoutout('');
                        }
                      }}
                      className="flex-1 bg-black/40 border border-white/10 rounded-md px-4 py-3 text-sm focus:outline-none focus:border-spotify-green transition-colors"
                    />
                    <button 
                      onClick={() => {
                        if (shoutout.trim()) {
                          setPendingShoutouts(prev => [...prev, shoutout.trim()]);
                          setShoutout('');
                        }
                      }}
                      className="bg-spotify-green text-black p-3 rounded-md hover:scale-105 transition-transform"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-spotify-gray mt-2 italic">
                    The AI DJ will mention these during the next song transition.
                  </p>
                </div>

                {pendingShoutouts.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-spotify-gray uppercase mb-3">Pending Shoutouts</h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                      {pendingShoutouts.map((s, i) => (
                        <div key={i} className="flex items-center justify-between bg-black/20 p-3 rounded-md border border-white/5 group">
                          <span className="text-sm text-white/90">{s}</span>
                          <button 
                            onClick={() => setPendingShoutouts(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-spotify-gray hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-spotify-green/10 border border-spotify-green/20 rounded-xl p-4 flex gap-4">
                  <div className="w-12 h-12 bg-spotify-green rounded-full flex items-center justify-center shrink-0">
                    <MessageSquare className="text-black w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-spotify-green">AI DJ Status</h4>
                    <p className="text-xs text-spotify-gray leading-relaxed mt-1">
                      {isDjSpeaking ? 'DJ is currently on air...' : 'DJ is waiting for the next transition.'}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Streaming Modal */}
      <AnimatePresence>
        {showStreamingModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-spotify-light w-full max-w-md rounded-xl p-6 shadow-2xl border border-white/10"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Cast className="w-6 h-6 text-spotify-green" />
                  <h2 className="text-xl font-bold">RTMPS Streaming</h2>
                </div>
                <button 
                  onClick={() => setShowStreamingModal(false)}
                  className="text-spotify-gray hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-spotify-gray uppercase mb-2">RTMPS Server URL & Stream Key</label>
                  <input 
                    type="text"
                    placeholder="rtmps://live-api-s.facebook.com:443/rtmp/FB-123456789-0-..."
                    value={rtmpsUrl}
                    onChange={(e) => setRtmpsUrl(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-md px-4 py-3 text-sm focus:outline-none focus:border-spotify-green transition-colors"
                  />
                  <p className="text-[10px] text-spotify-gray mt-2">
                    Combine your Server URL and Stream Key. For Facebook, it should look like: <span className="text-white">rtmps://.../rtmp/&lt;your-key&gt;</span>
                  </p>
                </div>

                {streamStatus === 'error' && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <p className="text-xs text-red-200">{error}</p>
                  </div>
                )}

                <div className="pt-4">
                  {!isStreaming ? (
                    <button 
                      onClick={startStreaming}
                      className="w-full bg-spotify-green text-black font-bold py-3 rounded-full hover:scale-105 transition-transform active:scale-95"
                    >
                      Start Broadcasting
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-3 py-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-sm font-bold text-red-500 uppercase tracking-wider">
                          {streamStatus === 'starting' ? 'Connecting...' : 'Live on RTMPS'}
                        </span>
                      </div>
                      <button 
                        onClick={stopStreaming}
                        className="w-full bg-white text-black font-bold py-3 rounded-full hover:scale-105 transition-transform active:scale-95"
                      >
                        Stop Stream
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI DJ Audio Element */}
      <audio 
        ref={djAudioRef} 
        onEnded={() => {
          setIsDjSpeaking(false);
          if (djAudioRef.current?.src.startsWith('blob:')) {
            URL.revokeObjectURL(djAudioRef.current.src);
          }
          playNext();
        }}
        className="hidden"
      />

      {/* Audio logic is now handled by Howler.js in useEffect */}
    </div>
  );
}

function SidebarLink({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-md transition-all duration-200 group ${
        active ? 'bg-spotify-light text-white' : 'text-spotify-gray hover:text-white'
      }`}
    >
      <span className={`${active ? 'text-spotify-green' : 'group-hover:text-white'} transition-colors`}>
        {icon}
      </span>
      <span className="text-sm font-bold">{label}</span>
    </button>
  );
}
