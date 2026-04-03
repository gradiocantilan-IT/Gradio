import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  audioContext: AudioContext | null;
  sourceNode: AudioNode | null;
  isDjSpeaking?: boolean;
}

export function Visualizer({ audioContext, sourceNode, isDjSpeaking }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!audioContext || !sourceNode) return;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    sourceNode.connect(analyser);
    analyserRef.current = analyser;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * height;

        // Dynamic colors based on DJ speaking or music
        const hue = isDjSpeaking ? 140 : 200; // Greenish for DJ, Blueish for Music
        const saturation = 80;
        const lightness = 50 + (dataArray[i] / 255) * 20;

        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        
        // Draw bars from center or bottom? Let's do bottom for now
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      if (analyserRef.current && sourceNode) {
        try {
          sourceNode.disconnect(analyserRef.current);
        } catch (e) {
          // Ignore disconnection errors
        }
      }
    };
  }, [audioContext, sourceNode, isDjSpeaking]);

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={60} 
      className="w-full h-full opacity-60"
    />
  );
}
