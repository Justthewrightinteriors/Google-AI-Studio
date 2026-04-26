export interface FurnitureItem {
  id: string;
  name: string;
  description: string;
  category: 'Sofa' | 'Chair' | 'Table' | 'Bed' | 'Lighting';
  style: 'Modern' | 'Industrial' | 'Scandinavian' | 'Classic' | 'Bohemian';
  price: number;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  image: string;
  modelUrl?: string; // Placeholder for future 3D models
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: {
    text: string;
    image: string;
    style: FurnitureItem['style'];
  }[];
}

export type Theme = 'light' | 'dark';

export interface SavedProject {
  id: string;
  itemId: string;
  name: string;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  createdAt: number;
}

export interface PlacedItem {
  instanceId: string;
  itemId: string;
  position: { x: number; y: number };
  rotation: number;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  color?: string;
  modelUrl?: string; // Support for imported 3D models
}
