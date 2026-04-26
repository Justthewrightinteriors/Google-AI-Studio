import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sun, Moon, Heart, Share2, Box, Sparkles, Eye,
  ChevronRight, Camera, Menu, X, ShoppingBag,
  Info, Mail, Phone, Instagram, Facebook,
  RotateCw, Layers, Move, Undo, Redo, Volume2,
  Users, LogIn, LogOut, Copy, Check
} from 'lucide-react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
  query, 
  serverTimestamp,
  getDocs,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { handleFirestoreError, OperationType } from './lib/firebaseUtils';
import { FURNITURE_DATA, STYLE_QUIZ_QUESTIONS } from './constants';
import { FurnitureItem, Theme, SavedProject, PlacedItem } from './types';
import { cn } from './lib/utils';
import confetti from 'canvas-confetti';
import { Trash2, Bookmark } from 'lucide-react';

import Furniture3D from './components/Furniture3D';
import FloorPlan from './components/FloorPlan';

// --- Sub-components (could be moved to separate files) ---

const Container = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", className)}>
    {children}
  </div>
);

export default function App() {
  const [theme, setTheme] = useState<Theme>('light');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [quizResults, setQuizResults] = useState<string[]>([]);
  const [viewingItem, setViewingItem] = useState<FurnitureItem | null>(null);
  const [customDimensions, setCustomDimensions] = useState({ width: 0, height: 0, depth: 0 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [arMode, setArMode] = useState(false);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [sceneOpen, setSceneOpen] = useState(false);
  const [lighting, setLighting] = useState(0.5);
  const [lightingPreset, setLightingPreset] = useState<'custom' | 'daylight' | 'evening' | 'studio' | 'dramatic'>('custom');
  const [environment, setEnvironment] = useState<'city' | 'apartment' | 'lobby' | 'studio' | 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'park'>('apartment');
  const [designStyle, setDesignStyle] = useState<'default' | 'blueprint' | 'gallery' | 'noir' | 'industrial' | 'classic'>('default');
  const [isScanning, setIsScanning] = useState(false);
  const [viewMode, setViewMode] = useState<'3D' | '2D'>('3D');
  const [soundscape, setSoundscape] = useState<'none' | 'study' | 'cafe' | 'nature'>('none');
  const [volume, setVolume] = useState(0.5);
  const [customModelUrl, setCustomModelUrl] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Sync listener ref
  const itemsListenerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const logout = () => signOut(auth);

  const createRoom = async () => {
    if (!user) {
      await login();
      if (!auth.currentUser) return;
    }
    
    setIsSyncing(true);
    const roomId = Math.random().toString(36).substring(7);
    const roomRef = doc(db, 'rooms', roomId);
    
    try {
      await setDoc(roomRef, {
        name: `${user?.displayName || 'Designer'}'s Space`,
        createdAt: serverTimestamp(),
        ownerId: auth.currentUser?.uid,
        lastUpdated: serverTimestamp()
      });
      
      // Upload current local items to the room
      const batch = writeBatch(db);
      placedItems.forEach((item) => {
        const itemRef = doc(db, 'rooms', roomId, 'items', item.instanceId);
        batch.set(itemRef, {
          ...item,
          updatedBy: auth.currentUser?.uid
        });
      });
      await batch.commit();
      
      joinRoom(roomId);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `rooms/${roomId}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const joinRoom = (roomId: string) => {
    if (itemsListenerRef.current) itemsListenerRef.current();
    
    setCurrentRoomId(roomId);
    const itemsRef = collection(db, 'rooms', roomId, 'items');
    
    itemsListenerRef.current = onSnapshot(itemsRef, (snapshot) => {
      const items: PlacedItem[] = [];
      snapshot.forEach((doc) => {
        items.push(doc.data() as PlacedItem);
      });
      setPlacedItems(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `rooms/${roomId}/items`);
    });
  };

  const leaveRoom = () => {
    if (itemsListenerRef.current) itemsListenerRef.current();
    setCurrentRoomId(null);
    setPlacedItems([]); // Or keep them locally? User choice. Let's clear for clean slate.
  };

  const handleModelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (customModelUrl) URL.revokeObjectURL(customModelUrl);
      const url = URL.createObjectURL(file);
      setCustomModelUrl(url);
      
      // Create a temporary furniture item for the custom model
      const customItem: FurnitureItem = {
        id: `custom-${customModelUrl}`,
        name: file.name,
        description: "User imported 3D model",
        category: 'Sofa', // Default category
        style: 'Modern',
        price: 0,
        dimensions: { width: 100, height: 100, depth: 100 },
        image: "https://images.unsplash.com/photo-1550584557-e90f38a8f46c?auto=format&fit=crop&q=80&w=300",
        modelUrl: url
      };
      setViewingItem(customItem);
    }
  };

  // History for Undo/Redo
  const [history, setHistory] = useState<PlacedItem[][]>([]);
  const [redoStack, setRedoStack] = useState<PlacedItem[][]>([]);

  const pushToHistory = async (newState: PlacedItem[]) => {
    if (currentRoomId) {
      // Sync to Firestore
      const roomRef = doc(db, 'rooms', currentRoomId);
      const batch = writeBatch(db);
      
      // Update room timestamp
      batch.update(roomRef, { lastUpdated: serverTimestamp() });
      
      // This is a naive sync - for production, we'd diff. 
      // For now, let's just handle the individual item logic in the specific handlers
      // but pushToHistory is used for 'Clear All' too.
      if (newState.length === 0) {
        // Handle clear all
        const itemsRef = collection(db, 'rooms', currentRoomId, 'items');
        const snapshot = await getDocs(itemsRef);
        snapshot.forEach(d => batch.delete(d.ref));
      }
      await batch.commit();
    }
    
    setHistory(prev => [...prev, placedItems]);
    setRedoStack([]); // Clear redo stack on new action
    setPlacedItems(newState);
  };

  const undo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setRedoStack(prev => [...prev, placedItems]);
    setHistory(prev => prev.slice(0, -1));
    setPlacedItems(previousState);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, placedItems]);
    setRedoStack(prev => prev.slice(0, -1));
    setPlacedItems(nextState);
  };

  const SOUND_URLS = {
    study: "https://www.soundboard.com/handler/DownLoadTrack.ashx?cliptitle=Library+Ambience&filename=mz/mzmzotm0mtmzmzo3_0_6D4zT_2fXnE.mp3",
    cafe: "https://www.soundboard.com/handler/DownLoadTrack.ashx?cliptitle=Cafe+Ambience&filename=nt/ntixmtcxndixntixmdgx_3_2bv7gGq4_2f_2bM.mp3",
    nature: "https://www.soundboard.com/handler/DownLoadTrack.ashx?cliptitle=Birds+Singing+in+the+Forest&filename=mt/mtu3nzeyndk1mtu3ndcy_E_2bmI_2b_2fWvY_2bs.mp3"
  };

  // Audio management
  useEffect(() => {
    if (soundscape === 'none') return;
    
    const audio = new Audio(SOUND_URLS[soundscape as keyof typeof SOUND_URLS]);
    audio.loop = true;
    audio.volume = volume;
    
    const playAudio = () => {
      audio.play().catch(e => console.log("Audio playback blocked by browser", e));
    };

    if (sceneOpen) {
      playAudio();
    }

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [soundscape, sceneOpen]);

  useEffect(() => {
    const audios = document.querySelectorAll('audio');
    audios.forEach(a => a.volume = volume);
  }, [volume]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, redoStack, placedItems]);

  const applyLightingPreset = (preset: typeof lightingPreset) => {
    setLightingPreset(preset);
    switch (preset) {
      case 'daylight':
        setLighting(1.0);
        setEnvironment('city');
        break;
      case 'evening':
        setLighting(0.4);
        setEnvironment('sunset');
        break;
      case 'studio':
        setLighting(0.8);
        setEnvironment('studio');
        break;
      case 'dramatic':
        setLighting(1.5);
        setEnvironment('night');
        break;
    }
  };

  // Initialize theme, favorites and projects from system preference or localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }

    const savedFavorites = localStorage.getItem('favorites');
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }

    const projects = localStorage.getItem('savedProjects');
    if (projects) {
      try {
        setSavedProjects(JSON.parse(projects));
      } catch (e) {
        console.error("Failed to parse projects", e);
      }
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('savedProjects', JSON.stringify(savedProjects));
  }, [savedProjects]);

  useEffect(() => {
    if (viewingItem) {
      setCustomDimensions(viewingItem.dimensions);
    }
  }, [viewingItem]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const saveProject = (item: FurnitureItem, dims: typeof customDimensions) => {
    const newProject: SavedProject = {
      id: crypto.randomUUID(),
      itemId: item.id,
      name: item.name,
      dimensions: { ...dims },
      createdAt: Date.now()
    };
    setSavedProjects(prev => [newProject, ...prev]);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#d97706', '#000000', '#ffffff']
    });
  };

  const deleteProject = (id: string) => {
    setSavedProjects(prev => prev.filter(p => p.id !== id));
  };

  const addToScene = (item: FurnitureItem, dims: typeof customDimensions) => {
    const newItem: PlacedItem = {
      instanceId: Math.random().toString(36).substring(7),
      itemId: item.id,
      position: { 
        x: (placedItems.length % 5) * 40 - 80, 
        y: Math.floor(placedItems.length / 5) * 40 - 80
      },
      rotation: 0,
      dimensions: { ...dims },
      color: theme === 'dark' ? '#1c1917' : '#f5f5f4',
      modelUrl: item.modelUrl
    };

    if (currentRoomId) {
      const itemRef = doc(db, 'rooms', currentRoomId, 'items', newItem.instanceId);
      setDoc(itemRef, { ...newItem, updatedBy: auth.currentUser?.uid })
        .catch(e => handleFirestoreError(e, OperationType.CREATE, `rooms/${currentRoomId}/items/${newItem.instanceId}`));
    } else {
      pushToHistory([...placedItems, newItem]);
    }

    setSceneOpen(true);
    setViewingItem(null);
  };

  const updatePlacedItem = (instanceId: string, updates: Partial<PlacedItem>, recordHistory: boolean = false) => {
    if (currentRoomId) {
      const itemRef = doc(db, 'rooms', currentRoomId, 'items', instanceId);
      setDoc(itemRef, { ...updates, updatedBy: auth.currentUser?.uid }, { merge: true })
        .catch(e => handleFirestoreError(e, OperationType.UPDATE, `rooms/${currentRoomId}/items/${instanceId}`));
    } else {
      const newState = placedItems.map(item => 
        item.instanceId === instanceId ? { ...item, ...updates } : item
      );
      if (recordHistory) {
        pushToHistory(newState);
      } else {
        setPlacedItems(newState);
      }
    }
  };

  const removeFromScene = (instanceId: string) => {
    if (currentRoomId) {
      const itemRef = doc(db, 'rooms', currentRoomId, 'items', instanceId);
      deleteDoc(itemRef)
        .catch(e => handleFirestoreError(e, OperationType.DELETE, `rooms/${currentRoomId}/items/${instanceId}`));
    } else {
      pushToHistory(placedItems.filter(item => item.instanceId !== instanceId));
    }
  };

  const categories = ['All', ...Array.from(new Set(FURNITURE_DATA.map(item => item.category)))];

  const filteredItems = useMemo(() => {
    return activeCategory === 'All' 
      ? FURNITURE_DATA 
      : FURNITURE_DATA.filter(item => item.category === activeCategory);
  }, [activeCategory]);

  const handleQuizAnswer = (style: string) => {
    const newResults = [...quizResults, style];
    setQuizResults(newResults);
    
    if (quizStep < STYLE_QUIZ_QUESTIONS.length - 1) {
      setQuizStep(quizStep + 1);
    } else {
      // Calculate dominant style
      const counts: Record<string, number> = {};
      newResults.forEach(s => counts[s] = (counts[s] || 0) + 1);
      const topStyle = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
      
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: theme === 'dark' ? ['#F59E0B', '#10B981', '#3B82F6'] : ['#B45309', '#059669', '#2563EB']
      });

      // Simple recommendation logic: set category/filter or just show alert
      setQuizOpen(false);
      alert(`Your style is ${topStyle}! Discover our ${topStyle} collection.`);
      // Reset for next time
      setQuizStep(0);
      setQuizResults([]);
    }
  };

  const shareDesign = (item: FurnitureItem) => {
    if (navigator.share) {
      navigator.share({
        title: `Check out the ${item.name} from Just the Wright Interiors`,
        text: `I'm visualizing the ${item.name} in my home. What do you think?`,
        url: window.location.href,
      }).catch(console.error);
    } else {
      alert(`Design link copied to clipboard: ${window.location.href}`);
    }
  };

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-500 font-sans",
      theme === 'dark' ? "bg-[#0A0A0A] text-stone-100" : "bg-[#fdfcf9] text-zinc-900"
    )}>
      {/* Navigation */}
      <nav className={cn(
        "sticky top-0 z-50 backdrop-blur-md border-b flex items-center transition-colors h-16 px-4 sm:px-8",
        theme === 'dark' ? "bg-[#0F0F0F]/80 border-stone-800" : "bg-white/80 border-zinc-200"
      )}>
        <div className="flex-1 flex items-center justify-between mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <div className={cn(
               "w-8 h-8 rounded-sm flex items-center justify-center transition-colors",
               theme === 'dark' ? "bg-stone-100" : "bg-zinc-900"
            )}>
              <div className={cn(
                "w-4 h-4 border-2 rotate-45",
                theme === 'dark' ? "border-[#0A0A0A]" : "border-white"
              )}></div>
            </div>
            <h1 className="text-xl tracking-tight hidden sm:block font-serif">
              Just the <span className="italic font-light">Wright</span> Interiors
            </h1>
          </div>

          <div className="hidden md:flex items-center gap-8 text-[11px] tracking-[0.2em] uppercase font-medium">
            <button 
              onClick={() => {
                setActiveCategory('All');
                document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' });
              }} 
              className="hover:text-amber-600 transition-colors"
            >
              Atelier
            </button>
            <button 
              onClick={() => setSceneOpen(true)} 
              className="hover:text-amber-600 transition-colors flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              Scene
              {placedItems.length > 0 && (
                <span className="ml-1 text-[8px] bg-amber-600 text-white rounded-full px-1 py-0.5 min-w-[16px] text-center">
                  {placedItems.length}
                </span>
              )}
            </button>
            <button 
              onClick={() => setShowGallery(true)} 
              className="hover:text-amber-600 transition-colors flex items-center gap-1.5"
            >
              <Bookmark className="w-3.5 h-3.5 text-amber-500" />
              Gallery
            </button>
            <button onClick={() => setQuizOpen(true)} className="hover:text-amber-600 transition-colors flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Style Quiz
            </button>
            <div className={cn(
              "flex items-center gap-4 pl-8 border-l",
              theme === 'dark' ? "border-stone-800" : "border-zinc-200"
            )}>
              <button 
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="p-2 hover:bg-stone-800/50 rounded-full transition-colors"
                title="Toggle Theme"
              >
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>
              <button className="relative p-2 hover:bg-stone-800/50 rounded-full transition-colors">
                <Heart className="w-4 h-4" />
                {favorites.length > 0 && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-600 rounded-full" />}
              </button>
            </div>
          </div>

          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2">
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={cn(
                "absolute top-16 left-0 right-0 md:hidden overflow-hidden border-b",
                theme === 'dark' ? "bg-[#0F0F0F] border-stone-800" : "bg-white border-zinc-200"
              )}
            >
              <div className="px-6 py-8 flex flex-col gap-6 text-[12px] tracking-[0.2em] uppercase font-medium">
                <button 
                  onClick={() => { 
                    setActiveCategory('All'); 
                    setIsMenuOpen(false); 
                    setTimeout(() => document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' }), 300);
                  }} 
                  className="text-left hover:text-amber-600 transition-colors"
                >
                  Collections
                </button>
                <button 
                  onClick={() => { setSceneOpen(true); setIsMenuOpen(false); }} 
                  className="text-left flex items-center gap-2 hover:text-amber-600 transition-colors"
                >
                  <Layers className="w-4 h-4 text-amber-500" />
                  AR Scene
                </button>
                <button 
                  onClick={() => { setShowGallery(true); setIsMenuOpen(false); }} 
                  className="text-left flex items-center gap-2 hover:text-amber-600 transition-colors"
                >
                  <Bookmark className="w-4 h-4 text-amber-500" />
                  Gallery
                </button>
                <button onClick={() => { setQuizOpen(true); setIsMenuOpen(false); }} className="text-left flex items-center gap-2 hover:text-amber-600 transition-colors">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Style Quiz
                </button>
                <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="text-left flex items-center gap-2 hover:text-amber-600 transition-colors">
                  {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  Appearance
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative h-[85vh] flex items-center overflow-hidden">
          <div className="absolute inset-0 z-0">
             <img 
               src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=2000" 
               className={cn(
                 "w-full h-full object-cover transition-opacity duration-1000",
                 theme === 'dark' ? "opacity-30" : "opacity-60"
               )}
               alt="Hero Interior"
               referrerPolicy="no-referrer"
             />
             <div className={cn(
               "absolute inset-0 bg-gradient-to-t via-transparent to-transparent",
               theme === 'dark' ? "from-[#0A0A0A]" : "from-[#fdfcf9]"
             )} />
          </div>
          
          <Container className="relative z-10">
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-3xl"
            >
              <span className={cn(
                "inline-block px-4 py-1.5 mb-8 text-[10px] font-bold tracking-[0.3em] uppercase border rounded-sm",
                theme === 'dark' ? "text-amber-500 border-stone-800 bg-stone-900/30" : "text-amber-700 border-zinc-200 bg-zinc-50"
              )}>
                Professional Atelier
              </span>
              <h2 className="text-7xl md:text-9xl font-serif font-light leading-[0.85] mb-10 tracking-tighter">
                Reimagine <br /> Your <span className="italic font-normal text-amber-600/80">Space</span>
              </h2>
              <p className={cn(
                "text-lg md:text-xl mb-12 leading-relaxed max-w-xl",
                theme === 'dark' ? "text-stone-400" : "text-zinc-600"
              )}>
                High-powered interior visualization at your fingertips. Discover premium furniture and bring your vision to life with advanced AR.
              </p>
              <div className="flex flex-col sm:flex-row gap-6">
                <button 
                  onClick={() => document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' })}
                  className={cn(
                    "px-10 py-5 font-bold text-[11px] tracking-[0.2em] uppercase rounded-sm transition-all hover:-translate-y-1 shadow-2xl",
                    theme === 'dark' ? "bg-stone-100 text-[#0A0A0A] hover:bg-white" : "bg-zinc-900 text-white hover:bg-black"
                  )}
                >
                  Explore Atelier
                </button>
                <button 
                  onClick={() => setQuizOpen(true)}
                  className={cn(
                    "px-10 py-5 font-bold text-[11px] tracking-[0.2em] uppercase rounded-sm transition-all border",
                    theme === 'dark' ? "border-stone-700 text-stone-100 hover:bg-stone-100 hover:text-black" : "border-zinc-300 text-zinc-900 hover:bg-zinc-900 hover:text-white"
                  )}
                >
                  Discovery Quiz
                </button>
              </div>
            </motion.div>
          </Container>
        </section>

        {/* Catalogue Section */}
        <section id="catalogue" className={cn(
          "py-32 transition-colors",
          theme === 'dark' ? "bg-[#050505]" : "bg-white"
        )}>
          <Container>
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
              <div>
                <h3 className="text-5xl font-serif mb-6">Collections</h3>
                <p className={theme === 'dark' ? "text-stone-500" : "text-zinc-500"}>Curated pieces for the discerning modern home.</p>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:pb-0 md:mx-0">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "whitespace-nowrap px-6 py-2.5 rounded-sm text-[10px] font-bold tracking-widest uppercase transition-all duration-300",
                      activeCategory === cat 
                        ? (theme === 'dark' ? "bg-amber-600 text-white" : "bg-zinc-900 text-white")
                        : (theme === 'dark' ? "bg-stone-900 text-stone-400 hover:text-stone-100" : "bg-zinc-100 text-zinc-500 hover:text-zinc-900")
                    )}
                  >
                    {cat}
                  </button>
                ))}
                
                <div className="relative">
                  <input 
                    type="file" 
                    id="model-import" 
                    className="hidden" 
                    accept=".glb,.obj" 
                    onChange={handleModelUpload}
                  />
                  <label 
                    htmlFor="model-import"
                    className={cn(
                      "whitespace-nowrap px-6 py-2.5 rounded-sm text-[10px] font-bold tracking-widest uppercase cursor-pointer flex items-center gap-2 transition-all duration-300 border",
                      theme === 'dark' ? "border-amber-600/50 text-amber-500 hover:bg-amber-600 hover:text-white" : "border-amber-600/50 text-amber-700 hover:bg-amber-600 hover:text-white"
                    )}
                  >
                    <Box className="w-3 h-3" />
                    Import 3D
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
              {filteredItems.map(item => (
                <motion.div
                  layout
                  key={item.id}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  className="group relative"
                >
                  <div className={cn(
                    "aspect-[4/5] overflow-hidden relative mb-8 rounded-sm",
                    theme === 'dark' ? "bg-stone-900" : "bg-zinc-100"
                  )}>
                    <img 
                      src={item.image} 
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4 backdrop-blur-[2px]">
                      <button 
                        onClick={() => setViewingItem(item)}
                        className="px-6 py-3 bg-white text-black text-[10px] font-bold tracking-widest uppercase rounded-sm hover:-translate-y-1 transition-transform"
                      >
                        Visualizer
                      </button>
                    </div>
                    <button 
                      onClick={() => toggleFavorite(item.id)}
                      className={cn(
                        "absolute top-6 right-6 p-2.5 rounded-full transition-all",
                        favorites.includes(item.id) 
                          ? "text-red-500 scale-110" 
                          : "text-white/60 hover:text-white"
                      )}
                    >
                      <Heart className={cn("w-5 h-5", favorites.includes(item.id) && "fill-current")} />
                    </button>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-[0.2em]">{item.style}</span>
                      <span className="text-xl font-serif text-amber-600/80">${item.price.toLocaleString()}</span>
                    </div>
                    <h4 className="text-2xl font-serif mb-4 group-hover:text-amber-600 transition-colors">{item.name}</h4>
                    <div className={cn(
                      "flex items-center justify-between pt-6 border-t",
                      theme === 'dark' ? "border-stone-900" : "border-zinc-100"
                    )}>
                      <span className="text-[10px] font-medium uppercase tracking-widest text-stone-500/80">
                        {item.dimensions.width}w {item.dimensions.height}h
                      </span>
                      <button 
                        onClick={() => shareDesign(item)}
                        className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 hover:text-amber-600 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        Share
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Container>
        </section>
      </main>

      {/* Style Quiz Modal */}
      <AnimatePresence>
        {quizOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQuizOpen(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "relative w-full max-w-5xl rounded-sm overflow-hidden shadow-2xl border",
                theme === 'dark' ? "bg-[#0A0A0A] border-stone-800" : "bg-white border-zinc-100"
              )}
            >
              <div className="flex flex-col md:flex-row min-h-[600px]">
                <div className={cn(
                  "w-full md:w-1/3 p-12 flex flex-col justify-between border-r",
                  theme === 'dark' ? "bg-[#0F0F0F] border-stone-800" : "bg-zinc-50 border-zinc-100"
                )}>
                  <div>
                    <h3 className="text-4xl font-serif mb-8 leading-tight">Identify Your <br /><span className="italic font-light text-amber-600/80">Aesthetic</span></h3>
                    <p className={cn(
                      "text-sm leading-relaxed mb-12",
                      theme === 'dark' ? "text-stone-400" : "text-zinc-500"
                    )}>
                      Allow our curation process to discern the silhouettes and palettes that define your personal style.
                    </p>
                  </div>
                  <div className="space-y-6">
                    <div className="flex gap-2">
                       {STYLE_QUIZ_QUESTIONS.map((_, i) => (
                        <div key={i} className={cn("h-[2px] flex-1 transition-colors duration-500", i <= quizStep ? "bg-amber-600" : (theme === 'dark' ? "bg-stone-800" : "bg-zinc-200"))} />
                      ))}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-60">Sequence {quizStep + 1} of {STYLE_QUIZ_QUESTIONS.length}</span>
                  </div>
                </div>
                <div className="w-full md:w-2/3 p-8 md:p-16 relative">
                  <button onClick={() => setQuizOpen(false)} className="absolute top-8 right-8 p-2 hover:bg-stone-800/10 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                  <h4 className={cn(
                    "text-xl tracking-tight mb-12",
                    theme === 'dark' ? "text-stone-300" : "text-zinc-700"
                  )}>
                    {STYLE_QUIZ_QUESTIONS[quizStep].question}
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    {STYLE_QUIZ_QUESTIONS[quizStep].options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleQuizAnswer(opt.style)}
                        className="group relative aspect-[4/3] overflow-hidden rounded-sm border border-transparent hover:border-amber-600/50 transition-all text-left"
                      >
                        <img 
                          src={opt.image} 
                          className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" 
                          alt={opt.text} 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-6">
                          <span className="text-white font-bold text-[10px] uppercase tracking-[0.2em]">{opt.text}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Item Viewer Backdrop */}
      <AnimatePresence>
        {viewingItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => { setViewingItem(null); setArMode(false); }}
               className="absolute inset-0 bg-black/95 backdrop-blur-xl" 
             />
             <motion.div 
               initial={{ opacity: 0, y: 100 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 100 }}
               transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
               className={cn(
                 "relative w-full max-w-7xl h-full md:h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-2xl",
                 theme === 'dark' ? "bg-[#0A0A0A] text-stone-100" : "bg-white text-zinc-900"
               )}
             >
                <div className={cn(
                  "w-full md:w-[68%] h-2/3 md:h-full relative overflow-hidden transition-colors border-r",
                  theme === 'dark' ? "bg-[#050505] border-stone-900" : "bg-zinc-50 border-zinc-100"
                )}>
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-stone-500 via-transparent to-transparent pointer-events-none"></div>
                  
                  {arMode ? (
                    <div className="w-full h-full relative flex items-center justify-center">
                       {/* Camera Simulation Overlay */}
                       <div className="absolute inset-0 opacity-40">
                         <img src="https://images.unsplash.com/photo-1554995207-c18c20360a59?auto=format&fit=crop&q=80&w=1200" className="w-full h-full object-cover" alt="AR background" />
                       </div>
                       
                       <motion.div 
                         drag
                         dragConstraints={{ left: -300, right: 300, top: -200, bottom: 200 }}
                         style={{ scale: customDimensions.width / viewingItem.dimensions.width }}
                         className="relative z-10 cursor-grab active:cursor-grabbing group/model"
                       >
                         <img src={viewingItem.image} className="w-80 h-80 object-contain drop-shadow-[0_35px_35px_rgba(0,0,0,0.6)]" alt="Furniture model" />
                         <div className="absolute -inset-4 border border-dashed border-amber-600/30 rounded-sm pointer-events-none opacity-0 group-hover/model:opacity-100 transition-opacity"></div>
                         <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-amber-600 text-white px-4 py-1.5 rounded-sm text-[9px] font-bold uppercase tracking-widest whitespace-nowrap shadow-xl">Precise Placement Active</div>
                       </motion.div>
                       
                       <div className="absolute top-10 left-10 flex items-center gap-4 bg-black/60 px-5 py-2.5 rounded-full backdrop-blur-xl border border-white/10">
                         <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                         <div>
                            <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-white">Live AR Engine</span>
                            <span className="block text-[8px] opacity-60 text-white uppercase tracking-widest leading-none mt-0.5">Scale {Math.round((customDimensions.width / viewingItem.dimensions.width) * 100)}%</span>
                         </div>
                       </div>
                    </div>
                  ) : (
                    <div className="w-full h-full relative group">
                       <Furniture3D 
                         width={customDimensions.width} 
                         height={customDimensions.height} 
                         depth={customDimensions.depth}
                         color={theme === 'dark' ? '#1c1917' : '#f5f5f4'}
                         modelUrl={viewingItem.modelUrl}
                         lightingIntensity={lighting}
                         environment={environment}
                         showScanningMesh={isScanning}
                        />
                       <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4">
                          {isScanning && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mb-4 p-4 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-lg max-w-sm text-center"
                            >
                              <h5 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2">Scanning Tips</h5>
                              <ul className="text-[9px] text-white/80 space-y-1.5 text-left list-disc list-inside leading-relaxed">
                                <li>Move camera slowly in smooth, circular motions</li>
                                <li>Ensure the room is well-lit for better surface detection</li>
                                <li>Focus on floor-to-wall intersections and large surfaces</li>
                                <li>Avoid reflective surfaces like mirrors or large windows</li>
                              </ul>
                            </motion.div>
                          )}
                          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="px-6 py-2.5 bg-black/40 backdrop-blur-xl border border-white/10 text-white rounded-full font-bold text-[9px] uppercase tracking-[0.2em] flex items-center gap-3">
                             <Box className="w-4 h-4" />
                             3D Interactive Studio
                          </motion.div>
                       </div>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => { setViewingItem(null); setArMode(false); }}
                    className="absolute top-10 right-10 p-3 hover:bg-stone-800/10 rounded-full transition-colors z-50"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="w-full md:w-[32%] p-8 md:p-14 flex flex-col border-l border-stone-900/5 transition-colors">
                   <div className="flex-1 overflow-y-auto no-scrollbar pr-2">
                      <div className="flex items-center justify-between mb-10">
                        <span className="px-4 py-1.5 bg-stone-900/5 dark:bg-stone-100/5 text-[9px] font-bold uppercase tracking-[0.3em] rounded-sm transition-colors">{viewingItem.style} Atelier</span>
                        <div className="flex gap-2">
                           <input 
                             type="file" 
                             id="viewer-model-import" 
                             className="hidden" 
                             accept=".glb,.obj" 
                             onChange={handleModelUpload}
                           />
                           <label 
                             htmlFor="viewer-model-import"
                             className="p-3 hover:bg-stone-900/5 dark:hover:bg-stone-100/5 rounded-full transition-all cursor-pointer"
                             title="Import custom 3D model"
                           >
                              <Box className="w-4 h-4 text-amber-500" />
                           </label>
                           <button onClick={() => toggleFavorite(viewingItem.id)} className="p-3 hover:bg-stone-900/5 dark:hover:bg-stone-100/5 rounded-full transition-all">
                              <Heart className={cn("w-4 h-4", favorites.includes(viewingItem.id) && "fill-red-500 text-red-500")} />
                           </button>
                           <button onClick={() => shareDesign(viewingItem)} className="p-3 hover:bg-stone-900/5 dark:hover:bg-stone-100/5 rounded-full transition-all">
                              <Share2 className="w-4 h-4" />
                           </button>
                        </div>
                      </div>
                      
                      <h3 className="text-4xl md:text-5xl font-serif mb-6 leading-tight">{viewingItem.name}</h3>
                      <p className="text-2xl font-serif font-light text-amber-600/80 mb-10 leading-none">${viewingItem.price.toLocaleString()}</p>
                      
                      <div className="h-px bg-stone-100 dark:bg-stone-900 mb-10" />
                      
                      <div className="space-y-10">
                         <div>
                            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mb-4">Provenance</span>
                            <p className="text-sm leading-relaxed opacity-70 italic font-serif">{viewingItem.description}</p>
                         </div>
                         <div>
                            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mb-6">Dimensional Control (CM)</span>
                            <div className="space-y-6">
                               {[
                                 { label: 'Length', key: 'width' },
                                 { label: 'Height', key: 'height' },
                                 { label: 'Depth', key: 'depth' }
                               ].map(dim => (
                                 <div key={dim.key}>
                                    <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest opacity-60 mb-2.5">
                                      <span>{dim.label}</span>
                                      <span>{customDimensions[dim.key as keyof typeof customDimensions]} CM</span>
                                    </div>
                                    <input 
                                      type="range"
                                      min={Math.round(viewingItem.dimensions[dim.key as keyof typeof viewingItem.dimensions] * 0.5)}
                                      max={Math.round(viewingItem.dimensions[dim.key as keyof typeof viewingItem.dimensions] * 1.5)}
                                      value={customDimensions[dim.key as keyof typeof customDimensions]}
                                      onChange={(e) => setCustomDimensions({ ...customDimensions, [dim.key]: parseInt(e.target.value) })}
                                      className="w-full h-0.5 bg-stone-200 dark:bg-stone-800 appearance-none cursor-pointer accent-amber-600"
                                    />
                                 </div>
                               ))}
                            </div>

                            <div className="h-px bg-stone-100 dark:bg-stone-900 my-10" />

                            <div className="space-y-6">
                               <div className="flex items-center justify-between mb-2">
                                  <span className="block text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">Atmospheric Studio</span>
                                  <span className="text-[9px] font-mono opacity-60">PRO TOOLS</span>
                               </div>
                               <div className="space-y-4">
                                  <div className="flex items-center gap-4">
                                     <Sun className="w-4 h-4 opacity-40 shrink-0" />
                                     <input 
                                       type="range" 
                                       min="0.1" 
                                       max="2" 
                                       step="0.1" 
                                       value={lighting} 
                                       onChange={(e) => setLighting(parseFloat(e.target.value))}
                                       className="flex-1 accent-amber-600 h-0.5 bg-stone-200 dark:bg-stone-800 rounded-full appearance-none"
                                     />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                     {['city', 'apartment', 'lobby', 'studio'].map((preset) => (
                                       <button
                                         key={preset}
                                         onClick={() => setEnvironment(preset as any)}
                                         className={cn(
                                           "py-2.5 px-3 text-[9px] uppercase tracking-widest rounded-sm border transition-all",
                                           environment === preset 
                                             ? "bg-amber-600 text-white border-amber-600" 
                                             : "border-stone-800/10 dark:border-white/10 opacity-60 hover:opacity-100"
                                         )}
                                       >
                                         {preset}
                                       </button>
                                     ))}
                                  </div>
                                  <button 
                                     onClick={() => {
                                       setIsScanning(true);
                                       setTimeout(() => setIsScanning(false), 3000);
                                     }}
                                     className={cn(
                                       "w-full py-4 px-4 rounded-sm border flex items-center justify-between transition-all group mt-2",
                                       isScanning ? "bg-amber-600/10 border-amber-500/50" : "border-stone-800/10 dark:border-white/10 hover:border-amber-500/50"
                                     )}
                                   >
                                      <div className="flex items-center gap-3">
                                         <Box className={cn("w-4 h-4", isScanning ? "text-amber-500" : "opacity-40")} />
                                         <span className={cn("text-[10px] uppercase tracking-widest font-bold", isScanning ? "text-amber-600" : "")}>
                                            {isScanning ? "Mapping Environment..." : "Scan Room Mesh"}
                                         </span>
                                      </div>
                                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse opacity-0 group-hover:opacity-100" />
                                   </button>
                               </div>
                             </div>
                          </div>
                       </div>
                    </div>
                   
                   <div className="pt-12 mt-auto">
                      <div className="flex gap-4 mb-4">
                        <button 
                          onClick={() => setArMode(!arMode)}
                          className={cn(
                            "flex-1 py-5 rounded-sm font-bold text-[10px] tracking-[0.2em] uppercase flex items-center justify-center gap-3 transition-all border",
                            arMode 
                              ? "bg-stone-100 text-[#0A0A0A] border-stone-100" 
                              : (theme === 'dark' ? "border-stone-800 text-stone-100 hover:bg-stone-800" : "border-zinc-200 text-zinc-900 hover:bg-zinc-50")
                          )}
                        >
                           <Camera className="w-4 h-4" />
                           {arMode ? 'Deactivate' : 'AR View'}
                        </button>
                        <button 
                          onClick={() => saveProject(viewingItem!, customDimensions)}
                          className={cn(
                            "px-6 py-5 rounded-sm transition-all border",
                            theme === 'dark' ? "border-stone-800 text-stone-100 hover:bg-stone-800" : "border-zinc-200 text-zinc-900 hover:bg-zinc-50"
                          )}
                          title="Save Configuration"
                        >
                           <Bookmark className="w-4 h-4" />
                        </button>
                      </div>
                      <button 
                        onClick={() => addToScene(viewingItem!, customDimensions)}
                        className={cn(
                          "w-full py-5 font-bold text-[10px] tracking-[0.3em] uppercase transition-all flex items-center justify-center gap-3 shadow-xl",
                          theme === 'dark' ? "bg-amber-600 text-white hover:bg-amber-500" : "bg-zinc-900 text-white hover:bg-black"
                        )}
                      >
                         <ShoppingBag className="w-4 h-4" />
                         Place in Scene
                      </button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Gallery Overlay */}
      <AnimatePresence>
        {showGallery && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGallery(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "relative w-full max-w-6xl h-full md:h-[85vh] rounded-sm overflow-hidden shadow-2xl border flex flex-col",
                theme === 'dark' ? "bg-[#0A0A0A] border-stone-800" : "bg-white border-zinc-100"
              )}
            >
              <div className="p-8 md:p-12 flex items-center justify-between border-b border-stone-900/10 dark:border-stone-800">
                <div>
                  <h3 className="text-4xl font-serif leading-tight">My <span className="italic font-light">Gallery</span></h3>
                  <p className="text-[10px] uppercase tracking-[0.3em] opacity-40 mt-2">Saved Configurations & Spatial Studies</p>
                </div>
                <button onClick={() => setShowGallery(false)} className="p-2 hover:bg-stone-800/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 md:p-12 no-scrollbar">
                {savedProjects.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30">
                    <Bookmark className="w-12 h-12 mb-6" />
                    <p className="text-sm uppercase tracking-widest">No configurations saved yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
                    {savedProjects.map(project => {
                      const item = FURNITURE_DATA.find(i => i.id === project.itemId);
                      return (
                        <div key={project.id} className="group flex flex-col">
                          <div className={cn(
                            "aspect-square rounded-sm overflow-hidden mb-6 relative",
                            theme === 'dark' ? "bg-stone-900" : "bg-zinc-100"
                          )}>
                            {item && (
                              <img 
                                src={item.image} 
                                alt={project.name} 
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" 
                              />
                            )}
                            <button 
                              onClick={() => deleteProject(project.id)}
                              className="absolute top-4 right-4 p-2.5 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all backdrop-blur-md"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex justify-between items-end">
                            <div>
                              <h4 className="text-xl font-serif mb-2">{project.name}</h4>
                              <p className="text-[9px] uppercase tracking-widest opacity-40">
                                {project.dimensions.width}L × {project.dimensions.height}H × {project.dimensions.depth}D CM
                              </p>
                            </div>
                            <button 
                              onClick={() => {
                                if (item) {
                                  setViewingItem(item);
                                  setCustomDimensions(project.dimensions);
                                  setShowGallery(false);
                                }
                              }}
                              className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-500 transition-colors"
                            >
                              Revisit
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AR Scene Overlay */}
      <AnimatePresence>
        {sceneOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black flex flex-col"
          >
            {/* Background Camera Sim */}
            <div className="absolute inset-0 z-0">
               <img 
                 src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=2000" 
                 className="w-full h-full object-cover opacity-40 grayscale"
                 alt="Room Background"
               />
               <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60" />
            </div>

            {/* Header */}
            <div className="relative z-10 p-6 flex items-center justify-between border-b border-white/10 backdrop-blur-md bg-black/20">
              <div className="flex items-center gap-4">
                <button onClick={() => setSceneOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6 text-white" />
                </button>
                <div className="hidden md:flex items-center gap-2 px-2 border-l border-white/10 mr-2">
                    <button 
                      onClick={undo} 
                      disabled={history.length === 0}
                      className={cn(
                        "p-2 rounded-full transition-colors",
                        history.length === 0 ? "text-white/10" : "text-white hover:bg-white/10"
                      )}
                      title="Undo (Ctrl+Z)"
                    >
                      <Undo className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={redo} 
                      disabled={redoStack.length === 0}
                      className={cn(
                        "p-2 rounded-full transition-colors",
                        redoStack.length === 0 ? "text-white/10" : "text-white hover:bg-white/10"
                      )}
                      title="Redo (Ctrl+Shift+Z)"
                    >
                      <Redo className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="flex items-center gap-3 px-4 border-l border-white/10 group relative">
                   <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full animate-pulse",
                        currentRoomId ? "bg-green-500" : "bg-stone-500"
                      )}></div>
                      <span className="text-[9px] uppercase tracking-widest text-white/40">
                        {currentRoomId ? `Room: ${currentRoomId}` : 'Local Session'}
                      </span>
                   </div>
                   
                   {currentRoomId ? (
                     <div className="flex items-center gap-2">
                       <button 
                         onClick={() => {
                           navigator.clipboard.writeText(currentRoomId);
                           setCopyFeedback(true);
                           setTimeout(() => setCopyFeedback(false), 2000);
                         }}
                         className="p-1 hover:bg-white/10 rounded-sm text-white/40 hover:text-white transition-all flex items-center gap-1"
                       >
                         {copyFeedback ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                         <span className="text-[8px] uppercase tracking-tighter">Copy Code</span>
                       </button>
                       <button 
                         onClick={leaveRoom}
                         className="text-[9px] text-red-500 hover:text-red-400 px-2 py-1 rounded-sm uppercase tracking-widest transition-all"
                       >
                         Leave
                       </button>
                     </div>
                   ) : (
                     <div className="flex items-center gap-2">
                       <button 
                         onClick={createRoom}
                         disabled={isSyncing}
                         className="text-[9px] bg-amber-600/20 hover:bg-amber-600 text-amber-500 hover:text-white px-3 py-1 rounded-sm uppercase tracking-widest transition-all disabled:opacity-50"
                       >
                         {isSyncing ? 'Starting...' : 'Go Live'}
                       </button>
                       <button 
                         onClick={() => {
                           const code = prompt("Enter Room Code:");
                           if (code) joinRoom(code);
                         }}
                         className="text-[9px] text-white/40 hover:text-white px-3 py-1 rounded-sm uppercase tracking-widest transition-all"
                       >
                         Join
                       </button>
                     </div>
                   )}
                </div>

                <div className="hidden md:flex items-center gap-3 bg-white/5 border border-white/10 rounded-sm p-1 mx-2">
                    <button 
                      onClick={() => setViewMode('3D')}
                      className={cn(
                        "px-3 py-1.5 text-[9px] uppercase font-bold tracking-widest rounded-sm transition-all",
                        viewMode === '3D' ? "bg-amber-600 text-white shadow-lg" : "text-white/40 hover:text-white"
                      )}
                    >
                      3D Space
                    </button>
                    <button 
                      onClick={() => setViewMode('2D')}
                      className={cn(
                        "px-3 py-1.5 text-[9px] uppercase font-bold tracking-widest rounded-sm transition-all",
                        viewMode === '2D' ? "bg-amber-600 text-white shadow-lg" : "text-white/40 hover:text-white"
                      )}
                    >
                      Floor Plan
                    </button>
                </div>
                <div>
                   <h3 className="text-white font-medium tracking-tight">Design Workshop</h3>
                   <p className="text-[9px] text-amber-500 uppercase tracking-[0.2em]">{placedItems.length} objects in scene</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                 <div className="hidden md:flex items-center gap-4 border-r border-white/10 pr-6 mr-2">
                    <Sun className="w-4 h-4 text-white/40" />
                    <input 
                      type="range" 
                      min="0.1" 
                      max="2" 
                      step="0.1" 
                      value={lighting} 
                      onChange={(e) => setLighting(parseFloat(e.target.value))}
                      className="w-24 accent-amber-600 h-0.5 bg-white/20 rounded-full appearance-none"
                    />
                 </div>
                 <button 
                   onClick={() => pushToHistory([])}
                   className="text-[10px] text-white/40 hover:text-white uppercase tracking-widest transition-colors"
                 >
                   Clear All
                 </button>
                 <button 
                   onClick={() => {
                     setArMode(true);
                     setSceneOpen(false);
                     alert("Multi-item AR mode activated. Scan floor to place design.");
                   }}
                   className="px-6 py-2.5 bg-amber-600 text-white text-[10px] uppercase font-bold tracking-widest rounded-sm hover:bg-amber-500 transition-colors"
                 >
                   Sync to Phone
                 </button>
              </div>
            </div>

            {/* Canvas */}
            <div className="relative flex-1 overflow-hidden">
               {placedItems.length === 0 ? (
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 pointer-events-none">
                    <Box className="w-16 h-16 mb-4" />
                    <p className="text-xs uppercase tracking-[0.4em]">Empty Canvas</p>
                 </div>
               ) : (
                 <div className="w-full h-full relative">
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
                  {isScanning && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-6 bg-black/60 backdrop-blur-3xl border border-white/20 rounded-2xl max-w-sm shadow-[0_0_50px_-12px_rgba(245,158,11,0.3)]"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-amber-500 rounded-lg">
                          <Eye className="w-5 h-5 text-white" />
                        </div>
                        <h5 className="text-sm font-bold text-white uppercase tracking-widest">AR Scanning Guide</h5>
                      </div>
                      <ul className="text-[11px] text-white/70 space-y-3 leading-relaxed">
                        <li className="flex items-start gap-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                          Move in slow circular motions to map the floor plane.
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                          Ensure strong ambient lighting—avoid dark corners.
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                          Target corners where walls meet floors for depth calibration.
                        </li>
                      </ul>
                    </motion.div>
                  )}
                    </div>
                    {viewMode === '3D' ? (
                      <Furniture3D 
                        items={placedItems}
                        lightingIntensity={lighting}
                        environment={environment}
                        designStyle={designStyle}
                        showScanningMesh={isScanning}
                      />
                    ) : (
                      <FloorPlan 
                        items={placedItems} 
                        onUpdateItem={updatePlacedItem}
                        furnitureData={FURNITURE_DATA}
                      />
                    )}
                    
                    {/* Management Panel */}
                    <div className="absolute top-10 right-10 w-72 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-sm p-6 hidden lg:flex flex-col max-h-[80%] overflow-hidden">
                       <div className="flex items-center justify-between mb-8 shrink-0">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Scene Inventory</h4>
                          <span className="text-[9px] text-white/30 font-mono">{placedItems.length}</span>
                       </div>
                       
                       <div className="space-y-3 overflow-y-auto pr-2 no-scrollbar flex-1">
                          {placedItems.map((pi) => {
                             const itemData = FURNITURE_DATA.find(i => i.id === pi.itemId);
                             return (
                               <div key={pi.instanceId} className="p-4 bg-white/5 border border-white/5 rounded-sm group">
                                  <div className="flex items-center justify-between mb-3">
                                     <span className="text-[10px] text-white/90 font-medium truncate max-w-[120px]">{itemData?.name || 'Unknown Item'}</span>
                                     <button 
                                       onClick={() => removeFromScene(pi.instanceId)}
                                       className="p-1 px-2 text-[8px] text-red-400 hover:text-red-300 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
                                     >
                                        Remove
                                     </button>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                     <div className="flex items-center gap-2 flex-1">
                                        <RotateCw className="w-3 h-3 text-white/20" />
                                        <input 
                                          type="range"
                                          min="0"
                                          max="360"
                                          value={pi.rotation}
                                          onChange={(e) => updatePlacedItem(pi.instanceId, { rotation: parseInt(e.target.value) })}
                                          onMouseUp={() => pushToHistory(placedItems)}
                                          className="flex-1 h-0.5 bg-white/10 accent-amber-500 appearance-none rounded-full"
                                        />
                                     </div>
                                     <span className="text-[8px] text-white/40 font-mono">{pi.rotation}°</span>
                                  </div>
                               </div>
                             );
                          })}
                       </div>
                       
                       <div className="mt-6 pt-6 border-t border-white/10 space-y-4 shrink-0">
                          <div className="flex items-center justify-between">
                             <label className="text-[9px] uppercase tracking-widest opacity-30">Ambient Soundscape</label>
                             <div className="flex items-center gap-2">
                                <Volume2 className="w-3 h-3 opacity-30" />
                                <input 
                                   type="range" 
                                   min="0" 
                                   max="1" 
                                   step="0.01" 
                                   value={volume} 
                                   onChange={(e) => setVolume(parseFloat(e.target.value))}
                                   className="w-16 h-0.5 bg-white/10 appearance-none cursor-pointer accent-amber-600"
                                />
                             </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                             {[
                               { id: 'none', label: 'None' },
                               { id: 'study', label: 'Quiet Study' },
                               { id: 'cafe', label: 'Lively Cafe' },
                               { id: 'nature', label: 'Peaceful Nature' }
                             ].map(s => (
                               <button 
                                 key={s.id} 
                                 onClick={() => setSoundscape(s.id as any)}
                                 className={cn(
                                   "py-2 text-[8px] uppercase tracking-widest border rounded-sm transition-all",
                                   soundscape === s.id ? "bg-amber-600 text-white border-amber-600" : "border-white/10 text-white/40 hover:text-white/60"
                                 )}
                               >
                                 {s.label}
                               </button>
                             ))}
                          </div>
                       </div>
                       
                       <div className="mt-6 pt-6 border-t border-white/10 space-y-4 shrink-0">
                          <label className="text-[9px] uppercase tracking-widest opacity-30">Lighting Presets</label>
                          <div className="grid grid-cols-2 gap-2">
                             {['daylight', 'evening', 'studio', 'dramatic'].map(p => (
                               <button 
                                 key={p} 
                                 onClick={() => applyLightingPreset(p as any)}
                                 className={cn(
                                   "py-2 text-[8px] uppercase tracking-widest border rounded-sm transition-all",
                                   lightingPreset === p ? "bg-amber-600 text-white border-amber-600" : "border-white/10 text-white/40"
                                 )}
                               >
                                 {p}
                               </button>
                             ))}
                          </div>
                       </div>
                       
                       <div className="mt-6 pt-6 border-t border-white/10 space-y-4 shrink-0">
                          <label className="text-[9px] uppercase tracking-widest opacity-30">Visual Style</label>
                          <div className="grid grid-cols-2 gap-2">
                             {['default', 'blueprint', 'gallery', 'noir', 'industrial', 'classic'].map(s => (
                               <button 
                                 key={s} 
                                 onClick={() => setDesignStyle(s as any)}
                                 className={cn(
                                   "py-2 text-[8px] uppercase tracking-widest border rounded-sm transition-all",
                                   designStyle === s ? "bg-amber-600 text-white border-amber-600" : "border-white/10 text-white/40"
                                 )}
                               >
                                 {s}
                               </button>
                             ))}
                          </div>
                       </div>
                       
                       <div className="mt-6 pt-6 border-t border-white/10 space-y-4 shrink-0">
                          <label className="text-[9px] uppercase tracking-widest opacity-30">Environments</label>
                          <div className="grid grid-cols-3 gap-1.5 overflow-y-auto max-h-32 pr-1 no-scrollbar">
                             {['sunset', 'dawn', 'night', 'warehouse', 'forest', 'apartment', 'studio', 'city', 'park', 'lobby'].map(p => (
                               <button 
                                 key={p} 
                                 onClick={() => setEnvironment(p as any)}
                                 className={cn(
                                   "py-1.5 text-[7px] uppercase tracking-widest border rounded-sm transition-all",
                                   environment === p ? "bg-white text-black border-white" : "border-white/5 text-white/20 hover:text-white/40"
                                 )}
                               >
                                 {p}
                               </button>
                             ))}
                          </div>
                       </div>
                    </div>
                 </div>
               )}
            </div>

            {/* Instruction Footer */}
            <div className="p-4 bg-black/40 backdrop-blur-md text-center z-10">
               <p className="text-[10px] text-white/40 uppercase tracking-[0.3em]">
                 Drag pieces to arrange. Use tools to rotate or remove.
               </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className={cn(
        "py-32 border-t transition-colors",
        theme === 'dark' ? "bg-[#0F0F0F] border-stone-800" : "bg-zinc-50 border-zinc-200"
      )}>
        <Container>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-32">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-10">
                <div className={cn(
                  "w-8 h-8 rounded-sm flex items-center justify-center",
                  theme === 'dark' ? "bg-stone-100" : "bg-zinc-900"
                )}>
                  <div className={cn(
                    "w-4 h-4 border-2 rotate-45",
                    theme === 'dark' ? "border-[#0A0A0A]" : "border-white"
                  )}></div>
                </div>
                <h2 className="text-xl font-serif">Just the <span className="italic font-light">Wright</span> Interiors</h2>
              </div>
              <p className={cn(
                "max-w-sm mb-10 leading-loose text-sm italic font-serif",
                theme === 'dark' ? "text-stone-500" : "text-zinc-500"
              )}>
                "The details are not the details. They make the design." — Elevating temporary spaces into timeless sanctuaries since 2012.
              </p>
              <div className="flex gap-6">
                {[Instagram, Facebook, Mail].map((Icon, i) => (
                  <button key={i} className={cn(
                    "p-3 rounded-full transition-all border",
                    theme === 'dark' ? "border-stone-800 hover:border-amber-600/50 hover:text-amber-600" : "border-zinc-200 hover:border-zinc-900"
                  )}>
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-bold uppercase tracking-[0.3em] text-[10px] mb-10 opacity-60">The Atelier</h4>
              <ul className="space-y-6 text-xs uppercase tracking-widest font-medium">
                <li className="hover:text-amber-600 transition-colors cursor-pointer">AR Room Planning</li>
                <li className="hover:text-amber-600 transition-colors cursor-pointer">Bespoke Curation</li>
                <li className="hover:text-amber-600 transition-colors cursor-pointer">Color Theory</li>
                <li className="hover:text-amber-600 transition-colors cursor-pointer">Lighting Design</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold uppercase tracking-[0.3em] text-[10px] mb-10 opacity-60">Maison</h4>
              <ul className="space-y-6 text-xs uppercase tracking-widest font-medium">
                <li className="hover:text-amber-600 transition-colors cursor-pointer">Store Finder</li>
                <li className="hover:text-amber-600 transition-colors cursor-pointer">Sustainability</li>
                <li className="hover:text-amber-600 transition-colors cursor-pointer">The Journal</li>
                <li className="hover:text-amber-600 transition-colors cursor-pointer">Contact</li>
              </ul>
            </div>
          </div>
          <div className="pt-12 border-t border-stone-800/10 dark:border-stone-800 flex flex-col md:flex-row justify-between items-center gap-8">
            <span className="text-[10px] uppercase tracking-widest opacity-40">© 2026 Just the Wright Interiors. Atelier of Excellence.</span>
            <div className="flex gap-10 text-[9px] uppercase tracking-[0.2em] font-bold opacity-60">
              <span className="hover:text-amber-600 cursor-pointer transition-colors">Privacy</span>
              <span className="hover:text-amber-600 cursor-pointer transition-colors">Terms</span>
              <span className="hover:text-amber-600 cursor-pointer transition-colors">Cookies</span>
            </div>
          </div>
        </Container>
      </footer>
    </div>
  );
}
