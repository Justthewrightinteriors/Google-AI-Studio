import { FurnitureItem } from './types';

export const FURNITURE_DATA: FurnitureItem[] = [
  {
    id: 's-1',
    name: 'Nordic Cloud Sofa',
    description: 'A plush, minimalist sofa designed for ultimate comfort and Scandinavian elegance. Features premium linen upholstery and solid oak frames.',
    category: 'Sofa',
    style: 'Scandinavian',
    price: 1249,
    dimensions: { width: 220, height: 85, depth: 95 },
    image: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'c-1',
    name: 'Eames-Inspired Shell Chair',
    description: 'Iconic mid-century modern design with a molded fiberglass shell and wooden legs. Perfect for the modern workspace or dining room.',
    category: 'Chair',
    style: 'Modern',
    price: 349,
    dimensions: { width: 62, height: 82, depth: 60 },
    image: 'https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 't-1',
    name: 'Industrial Oak Dining Table',
    description: 'Heavy solid oak top with custom welded steel legs for a rugged, modern look. Built to last generations.',
    category: 'Table',
    style: 'Industrial',
    price: 899,
    dimensions: { width: 180, height: 75, depth: 90 },
    image: 'https://images.unsplash.com/photo-1530018607912-eff2df114f11?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'b-1',
    name: 'Velvet Dream Platform Bed',
    description: 'Luxury velvet headboard with a minimalist frame for a sophisticated bedroom feel. Includes integrated slat support.',
    category: 'Bed',
    style: 'Classic',
    price: 1599,
    dimensions: { width: 160, height: 110, depth: 210 },
    image: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'l-1',
    name: 'Copper Sphere Pendant',
    description: 'Warm metallic light fixture that adds a focal point to any room. Creates a beautiful ambient glow.',
    category: 'Lighting',
    style: 'Modern',
    price: 189,
    dimensions: { width: 40, height: 40, depth: 40 },
    image: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'c-2',
    name: 'Woven Rattan Armchair',
    description: 'Natural textures and organic shapes for a relaxed bohemian atmosphere. Hand-woven by skilled artisans.',
    category: 'Chair',
    style: 'Bohemian',
    price: 279,
    dimensions: { width: 75, height: 90, depth: 80 },
    image: 'https://images.unsplash.com/photo-1519947486511-46149fa0a254?auto=format&fit=crop&q=80&w=1200'
  }
];

export const STYLE_QUIZ_QUESTIONS = [
  {
    id: 1,
    question: "Which color palette speaks to your design philosophy?",
    options: [
      { text: "Neutral whites and light woods", image: "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&q=80&w=800", style: "Scandinavian" },
      { text: "Bold blacks and raw concrete", image: "https://images.unsplash.com/photo-1536376074432-cd4258ae71bd?auto=format&fit=crop&q=80&w=800", style: "Industrial" },
      { text: "Warm earth tones and vibrant patterns", image: "https://images.unsplash.com/photo-1554995207-c18c20360a59?auto=format&fit=crop&q=80&w=800", style: "Bohemian" },
      { text: "Rich velvets and deep jewel tones", image: "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&q=80&w=800", style: "Classic" }
    ]
  },
  {
    id: 2,
    question: "Select your ideal evening environment.",
    options: [
      { text: "Cozy reading nook with plenty of light", image: "https://images.unsplash.com/photo-1516455590571-18256e5bb9ff?auto=format&fit=crop&q=80&w=800", style: "Scandinavian" },
      { text: "A sleek, modern lounge bar", image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=800", style: "Modern" },
      { text: "An artistic studio with eclectic vibes", image: "https://images.unsplash.com/photo-1505843513577-22bb7d21e455?auto=format&fit=crop&q=80&w=800", style: "Bohemian" },
      { text: "A grand, traditional dining room", image: "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&q=80&w=800", style: "Classic" }
    ]
  }
];
