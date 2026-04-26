import React from 'react';
import { motion } from 'motion/react';
import { PlacedItem, FurnitureItem } from '../types';
import { cn } from '../lib/utils';

interface FloorPlanProps {
  items: PlacedItem[];
  onUpdateItem: (id: string, updates: Partial<PlacedItem>, recordHistory?: boolean) => void;
  furnitureData: FurnitureItem[];
}

export default function FloorPlan({ items, onUpdateItem, furnitureData }: FloorPlanProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Grid size in pixels per meter (100px = 1m)
  const SCALE = 100;

  const handleDrag = (id: string, info: any) => {
    if (!containerRef.current) return;
    
    // Convert pixel delta to cm
    const deltaX = (info.delta.x / SCALE) * 100;
    const deltaY = (info.delta.y / SCALE) * 100;

    const item = items.find(i => i.instanceId === id);
    if (item) {
      onUpdateItem(id, {
        position: {
          x: item.position.x + deltaX,
          y: item.position.y + deltaY
        }
      });
    }
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-[#0F0F0F] relative overflow-hidden flex items-center justify-center cursor-crosshair"
      style={{
        backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)`,
        backgroundSize: '20px 20px'
      }}
    >
      {/* 0,0 Center Mark */}
      <div className="absolute w-4 h-4 border border-white/10 rounded-full" />
      
      {items.map((pi) => {
        const itemData = furnitureData.find(i => i.id === pi.itemId);
        // Convert cm to pixels
        const widthPx = (pi.dimensions.width / 100) * SCALE;
        const depthPx = (pi.dimensions.depth / 100) * SCALE;
        const xPos = (pi.position.x / 100) * SCALE;
        const yPos = (pi.position.y / 100) * SCALE;

        return (
          <motion.div
            key={pi.instanceId}
            drag
            dragMomentum={false}
            onDrag={(e, info) => handleDrag(pi.instanceId, info)}
            onDragEnd={() => onUpdateItem(pi.instanceId, {}, true)}
            className="absolute cursor-move flex items-center justify-center group"
            style={{
              width: widthPx,
              height: depthPx,
              x: xPos - widthPx/2,
              y: yPos - depthPx/2,
              rotate: pi.rotation,
              backgroundColor: pi.color || '#F59E0B',
            }}
          >
            {/* Visual enhancements for the floorplan items */}
            <div className="absolute inset-0 border border-white/20 hover:border-white/50 transition-colors shadow-lg" />
            
            <div className="relative z-10 flex flex-col items-center pointer-events-none">
                <span className="text-[8px] font-bold text-black/60 uppercase text-center leading-none px-1">
                  {itemData?.name.split(' ')[0]}
                </span>
                <span className="text-[6px] text-black/40 font-mono mt-1">
                  {pi.dimensions.width}x{pi.dimensions.depth}
                </span>
            </div>

            {/* Rotation Handle (Visual only for now since we have a slider in management panel) */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-white/20" />
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border border-white/20" />
          </motion.div>
        );
      })}

      {/* Legend / Info */}
      <div className="absolute bottom-10 left-10 p-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-sm pointer-events-none">
         <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 bg-white/20 border border-white/10" />
            <span className="text-[10px] text-white/60 uppercase tracking-widest font-bold">Overhead Layout</span>
         </div>
         <p className="text-[9px] text-white/30 uppercase tracking-widest leading-relaxed">
            1 Grid Square = 20cm<br />
            Scale: 1:10
         </p>
      </div>

      <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5 pointer-events-none" />
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/5 pointer-events-none" />
    </div>
  );
}
