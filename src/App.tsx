/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';

// --- Constants ---
const CANVAS_WIDTH = 840;
const CANVAS_HEIGHT = 680;
const HEART_COLOR = "#FF0000";
const IMAGE_ENLARGE = 11;

// Math helpers
const PI = Math.PI;
const sin = Math.sin;
const cos = Math.cos;
const log = Math.log;
const random = Math.random;

function randomUniform(min: number, max: number) {
  return random() * (max - min) + min;
}

function randomInt(min: number, max: number) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(random() * arr.length)];
}

// --- Heart Logic ---

function heartFunction(t: number, centerX: number, centerY: number) {
  // Basic parametric heart function
  let x = 17 * Math.pow(sin(t), 3);
  let y = -(16 * cos(t) - 5 * cos(2 * t) - 2 * cos(3 * t) - cos(4 * t)); // Note: Python code had -3*cos(3*t) which is slightly different but let's stick to the spirit

  // The Python code used: y = -(16 * cos(t) - 5 * cos(2 * t) - 3 * cos(3 * t))
  // Let's use the exact one from the prompt:
  y = -(16 * cos(t) - 5 * cos(2 * t) - 3 * cos(3 * t));

  // Enlarge and center
  x *= IMAGE_ENLARGE;
  y *= IMAGE_ENLARGE;
  x += centerX;
  y += centerY;

  return [x, y];
}

function scatterInside(x: number, y: number, centerX: number, centerY: number, beta = 0.15) {
  const ratioX = -beta * log(random());
  const ratioY = -beta * log(random());

  const dx = ratioX * (x - centerX);
  const dy = ratioY * (y - centerY);

  return [x - dx, y - dy];
}

function shrink(x: number, y: number, centerX: number, centerY: number, ratio: number) {
  const force = -1 / Math.pow(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2), 0.6);
  const dx = ratio * force * (x - centerX);
  const dy = ratio * force * (y - centerY);
  return [x - dx, y - dy];
}

function curve(p: number) {
  return 2 * (2 * sin(4 * p)) / (2 * PI);
}

type Point = [number, number, number]; // x, y, size

class HeartGenerator {
  private points: Set<string> = new Set();
  private edgeDiffusionPoints: Set<string> = new Set();
  private centerDiffusionPoints: Set<string> = new Set();
  public allFrames: Point[][] = [];
  private generateFrameCount: number;
  private centerX: number;
  private centerY: number;

  constructor(centerX: number, centerY: number, generateFrame = 20) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.generateFrameCount = generateFrame;
    this.build(1000);
    for (let frame = 0; frame < generateFrame; frame++) {
      this.calc(frame);
    }
  }

  private build(number: number) {
    // Heart outline
    for (let i = 0; i < number; i++) {
      const t = randomUniform(0, 2 * PI);
      const [x, y] = heartFunction(t, this.centerX, this.centerY);
      this.points.add(`${x},${y}`);
    }

    // Edge diffusion
    const pointList = Array.from(this.points).map(p => p.split(',').map(Number));
    for (const [px, py] of pointList) {
      for (let i = 0; i < 3; i++) {
        const [x, y] = scatterInside(px, py, this.centerX, this.centerY, 0.05);
        this.edgeDiffusionPoints.add(`${x},${y}`);
      }
    }

    // Center diffusion
    for (let i = 0; i < 5000; i++) {
      const [px, py] = randomChoice(pointList);
      const [x, y] = scatterInside(px, py, this.centerX, this.centerY, 0.27);
      this.centerDiffusionPoints.add(`${x},${y}`);
    }
  }

  private calcPosition(x: number, y: number, ratio: number): [number, number] {
    const force = 1 / Math.pow(Math.pow(x - this.centerX, 2) + Math.pow(y - this.centerY, 2), 0.420);
    const dx = ratio * force * (x - this.centerX) + randomInt(-1, 1);
    const dy = ratio * force * (y - this.centerY) + randomInt(-1, 1);
    return [x - dx, y - dy];
  }

  private calc(frame: number) {
    const ratio = 15 * curve((frame / 10) * PI);
    const haloRadius = Math.floor(4 + 6 * (1 + curve((frame / 10) * PI)));
    const haloNumber = Math.floor(1500 + 2000 * Math.pow(Math.abs(curve((frame / 10) * PI)), 2));

    const framePoints: Point[] = [];

    // Halo
    const heartHaloPoint = new Set<string>();
    for (let i = 0; i < haloNumber; i++) {
      const t = randomUniform(0, 2 * PI);
      let [x, y] = heartFunction(t, this.centerX, this.centerY);
      [x, y] = shrink(x, y, this.centerX, this.centerY, haloRadius);

      const key = `${Math.floor(x)},${Math.floor(y)}`;
      if (!heartHaloPoint.has(key)) {
        heartHaloPoint.add(key);
        x += randomInt(-60, 60);
        y += randomInt(-60, 60);
        const size = randomChoice([1, 1, 2]);
        framePoints.push([x, y, size]);
      }
    }

    // Outline
    for (const pStr of this.points) {
      const [px, py] = pStr.split(',').map(Number);
      const [x, y] = this.calcPosition(px, py, ratio);
      const size = randomInt(1, 3);
      framePoints.push([x, y, size]);
    }

    // Edge diffusion
    for (const pStr of this.edgeDiffusionPoints) {
      const [px, py] = pStr.split(',').map(Number);
      const [x, y] = this.calcPosition(px, py, ratio);
      const size = randomInt(1, 2);
      framePoints.push([x, y, size]);
    }

    // Center diffusion
    for (const pStr of this.centerDiffusionPoints) {
      const [px, py] = pStr.split(',').map(Number);
      const [x, y] = this.calcPosition(px, py, ratio);
      const size = randomInt(1, 2);
      framePoints.push([x, y, size]);
    }

    this.allFrames[frame] = framePoints;
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heartRef = useRef<HeartGenerator | null>(null);
  const frameRef = useRef(0);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize heart generator
    if (!heartRef.current) {
      heartRef.current = new HeartGenerator(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }

    const animate = () => {
      if (!ctx || !heartRef.current) return;

      // Clear canvas (transparent to show background)
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Render current frame
      const currentFrame = Math.floor(frameRef.current) % heartRef.current.allFrames.length;
      const points = heartRef.current.allFrames[currentFrame];

      ctx.fillStyle = HEART_COLOR;
      for (const [x, y, size] of points) {
        ctx.fillRect(x, y, size, size);
      }

      frameRef.current += 0.2; // Slow down the animation
      // The Python code uses after(1, ...) which is very fast. 
      // requestAnimationFrame is usually 60fps.
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center overflow-hidden">
      {/* Background Image: Enterprise Growth */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://picsum.photos/seed/business-growth/1920/1080"
          alt="Enterprise Growth"
          className="w-full h-full object-cover brightness-[0.4]"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
      </div>

      <div className="relative z-10 group flex flex-col items-center">
        {/* Subtle glow effect behind the heart */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-red-600/30 blur-[120px] rounded-full pointer-events-none" />
        
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="relative z-10 cursor-pointer transition-transform duration-1000 hover:scale-110 drop-shadow-[0_0_20px_rgba(255,0,0,0.6)]"
          title="开工大吉"
        />
        
        <div className="mt-4 text-white/40 font-mono text-xs tracking-[0.5em] uppercase pointer-events-none select-none">
          Passion for Excellence
        </div>
      </div>
      
      <div className="mt-12 relative z-10 flex flex-col items-center gap-6">
        <div className="h-[2px] w-32 bg-gradient-to-r from-transparent via-red-600 to-transparent" />
        <h1 className="text-white text-6xl md:text-8xl font-black tracking-[0.2em] drop-shadow-2xl text-center px-4 animate-pulse">
          开工了，我热爱工作
        </h1>
        <div className="h-[2px] w-32 bg-gradient-to-r from-transparent via-red-600 to-transparent" />
        
        <p className="text-red-500/90 text-lg uppercase tracking-[0.8em] font-bold mt-4 drop-shadow-md">
          Enterprise Growth & Vitality
        </p>
      </div>
    </div>
  );
}
