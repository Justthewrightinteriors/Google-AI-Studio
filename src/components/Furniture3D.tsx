import { useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, PerspectiveCamera, Environment, Grid, ContactShadows, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { PlacedItem } from '../types';

function BoxModel({ 
  width = 100, 
  height = 100, 
  depth = 100, 
  color = '#F59E0B',
  position = [0, 0, 0] as [number, number, number],
  rotation = 0
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Convert cm to meters for 3D scale (assuming 1 unit = 1 meter)
  const scale: [number, number, number] = [width / 100, height / 100, depth / 100];

  return (
    <group position={position} rotation={[0, THREE.MathUtils.degToRad(rotation), 0]}>
      <mesh ref={meshRef} scale={scale} castShadow receiveShadow position={[0, scale[1] / 2, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.2} />
      </mesh>
    </group>
  );
}

function GLTFModel({ url, width, height, depth, position, rotation }: { 
  url: string; 
  width: number; 
  height: number; 
  depth: number;
  position: [number, number, number];
  rotation: number;
}) {
  const { scene } = useGLTF(url);
  const scale: [number, number, number] = [width / 100, height / 100, depth / 100];

  return (
    <primitive 
      object={scene} 
      scale={scale} 
      position={position}
      rotation={[0, THREE.MathUtils.degToRad(rotation), 0]}
      castShadow
      receiveShadow
    />
  );
}

function ModelRenderer({ item, color, isBlueprint, isNoir, isIndustrial, isClassic }: {
  item: Partial<PlacedItem> & { width?: number; height?: number; depth?: number; modelUrl?: string };
  color?: string;
  isBlueprint?: boolean;
  isNoir?: boolean;
  isIndustrial?: boolean;
  isClassic?: boolean;
}) {
  const width = item.dimensions?.width ?? item.width ?? 100;
  const height = item.dimensions?.height ?? item.height ?? 100;
  const depth = item.dimensions?.depth ?? item.depth ?? 100;
  const position: [number, number, number] = item.position ? [item.position.x / 100, 0, item.position.y / 100] : [0, 0, 0];
  const rotation = item.rotation ?? 0;
  const modelUrl = item.modelUrl;

  const finalColor = isBlueprint ? '#64ffda' : 
                   isNoir ? '#ffffff' : 
                   isIndustrial ? '#4a4a4a' :
                   isClassic ? '#8b5e3c' :
                   item.color ?? color ?? '#F59E0B';

  return (
    <Suspense fallback={<BoxModel width={width} height={height} depth={depth} color={finalColor} position={position} rotation={rotation} />}>
      {modelUrl ? (
        <GLTFModel url={modelUrl} width={width} height={height} depth={depth} position={position} rotation={rotation} />
      ) : (
        <BoxModel width={width} height={height} depth={depth} color={finalColor} position={position} rotation={rotation} />
      )}
    </Suspense>
  );
}

export default function Furniture3D({ 
  width, height, depth, color, modelUrl,
  items,
  lightingIntensity = 0.5, 
  environment = 'apartment',
  designStyle = 'default',
  showScanningMesh = false 
}: { 
  width?: number; 
  height?: number; 
  depth?: number; 
  color?: string;
  modelUrl?: string;
  items?: PlacedItem[];
  lightingIntensity?: number;
  environment?: 'city' | 'apartment' | 'lobby' | 'studio' | 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'park';
  designStyle?: 'default' | 'blueprint' | 'gallery' | 'noir' | 'industrial' | 'classic';
  showScanningMesh?: boolean;
}) {
  const isBlueprint = designStyle === 'blueprint';
  const isGallery = designStyle === 'gallery';
  const isNoir = designStyle === 'noir';
  const isIndustrial = designStyle === 'industrial';
  const isClassic = designStyle === 'classic';

  return (
    <div className="w-full h-full relative cursor-move">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [3, 3, 3], fov: 45 }}>
        {isBlueprint && <color attach="background" args={['#0a192f']} />}
        {isGallery && <color attach="background" args={['#ffffff']} />}
        {isNoir && <color attach="background" args={['#000000']} />}
        {isIndustrial && <color attach="background" args={['#1a1a1a']} />}
        {isClassic && <color attach="background" args={['#fdfcf0']} />}
        
        <PerspectiveCamera makeDefault position={[5, 5, 5]} />
        <OrbitControls makeDefault enablePan={true} minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} />
        
        <Stage environment={environment} intensity={lightingIntensity} shadows="contact">
          {items ? (
            items.map((item) => (
              <ModelRenderer 
                key={item.instanceId}
                item={item}
                isBlueprint={isBlueprint}
                isNoir={isNoir}
                isIndustrial={isIndustrial}
                isClassic={isClassic}
              />
            ))
          ) : (
            <ModelRenderer 
              item={{ width, height, depth, modelUrl }}
              color={color}
              isBlueprint={isBlueprint}
              isNoir={isNoir}
              isIndustrial={isIndustrial}
              isClassic={isClassic}
            />
          )}
        </Stage>

        {showScanningMesh && (
          <Grid 
            infiniteGrid 
            fadeDistance={20} 
            fadeStrength={5} 
            cellSize={0.5} 
            sectionSize={2.5} 
            sectionThickness={1.5} 
            sectionColor="#d97706" 
            cellColor="#666" 
          />
        )}

        <ContactShadows 
          resolution={1024} 
          scale={10} 
          blur={isGallery ? 4 : 2} 
          opacity={isNoir || isIndustrial ? 0.8 : 0.25} 
          far={10} 
          color={isBlueprint ? "#00ffff" : "#000000"} 
        />
        
        <Environment preset={environment} />
        
        {!showScanningMesh && (
          isBlueprint ? (
            <Grid 
              infiniteGrid 
              fadeDistance={30} 
              fadeStrength={5} 
              cellSize={1} 
              sectionSize={5} 
              sectionThickness={1} 
              sectionColor="#112240" 
              cellColor="#1d3557" 
            />
          ) : isGallery ? (
             <gridHelper args={[20, 20, 0xeeeeee, 0xf5f5f5]} />
          ) : isNoir ? (
             <gridHelper args={[20, 20, 0x222222, 0x111111]} />
          ) : isIndustrial ? (
             <Grid 
               infiniteGrid 
               fadeDistance={25} 
               fadeStrength={3} 
               cellSize={1} 
               sectionSize={2.5} 
               sectionThickness={1} 
               sectionColor="#333333" 
               cellColor="#222222" 
             />
          ) : isClassic ? (
             <gridHelper args={[20, 20, 0xccb08a, 0xe8dcc0]} />
          ) : (
             <gridHelper args={[20, 20, 0x888888, 0x444444]} />
          )
        )}
      </Canvas>

      {showScanningMesh && (
        <div className="absolute inset-0 pointer-events-none border-2 border-amber-500/30 animate-pulse flex items-center justify-center">
           <div className="bg-amber-600/10 backdrop-blur-sm px-4 py-1 rounded-full flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
              <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Scanning Spatial Mesh...</span>
           </div>
        </div>
      )}
    </div>
  );
}
