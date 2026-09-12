import React, { useEffect, useRef } from 'react';
import bestieCatsMoon from '../assets/images/bestie_cats_moon_1789198713660.jpg';

export const DreamyBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle classes
    interface Particle {
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      opacity: number;
      fadeSpeed: number;
      isHeart: boolean;
      color: string;
      rotation: number;
      rotSpeed: number;
    }

    const particles: Particle[] = [];
    const count = Math.min(45, Math.floor(width / 35));

    const colors = [
      'rgba(244, 114, 182, ', // pink-400
      'rgba(192, 132, 252, ', // purple-400
      'rgba(232, 121, 249, ', // fuchsia-400
      'rgba(147, 197, 253, ', // blue-300
      'rgba(254, 205, 211, ', // rose-200
    ];

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 5 + 3,
        speedY: -(Math.random() * 0.4 + 0.15), // drift slowly upward
        speedX: (Math.random() - 0.5) * 0.25,
        opacity: Math.random() * 0.6 + 0.2,
        fadeSpeed: (Math.random() * 0.008 + 0.002) * (Math.random() > 0.5 ? 1 : -1),
        isHeart: Math.random() > 0.45,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.015,
      });
    }

    // Shooting star state
    interface ShootingStar {
      x: number;
      y: number;
      length: number;
      speed: number;
      angle: number;
      opacity: number;
      life: number;
    }
    let shootingStar: ShootingStar | null = null;
    let nextShootingStarTime = Date.now() + 4000 + Math.random() * 6000;

    function drawHeart(c: CanvasRenderingContext2D, x: number, y: number, size: number, rot: number) {
      c.save();
      c.translate(x, y);
      c.rotate(rot);
      c.beginPath();
      const topCurveHeight = size * 0.3;
      c.moveTo(0, topCurveHeight);
      // top left curve
      c.bezierCurveTo(0, 0, -size / 2, 0, -size / 2, topCurveHeight);
      // bottom left curve
      c.bezierCurveTo(-size / 2, (size + topCurveHeight) / 2, 0, (size + topCurveHeight) / 1.2, 0, size * 1.1);
      // bottom right curve
      c.bezierCurveTo(0, (size + topCurveHeight) / 1.2, size / 2, (size + topCurveHeight) / 2, size / 2, topCurveHeight);
      // top right curve
      c.bezierCurveTo(size / 2, 0, 0, 0, 0, topCurveHeight);
      c.closePath();
      c.fill();
      c.restore();
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const now = Date.now();
      if (!shootingStar && now > nextShootingStarTime) {
        shootingStar = {
          x: Math.random() * (width * 0.7),
          y: Math.random() * (height * 0.35),
          length: Math.random() * 80 + 70,
          speed: Math.random() * 9 + 11,
          angle: Math.PI / 4 + (Math.random() - 0.5) * 0.2,
          opacity: 1,
          life: 0,
        };
        nextShootingStarTime = now + 9000 + Math.random() * 12000;
      }

      if (shootingStar) {
        ctx.save();
        const endX = shootingStar.x + Math.cos(shootingStar.angle) * shootingStar.length;
        const endY = shootingStar.y + Math.sin(shootingStar.angle) * shootingStar.length;

        const grad = ctx.createLinearGradient(shootingStar.x, shootingStar.y, endX, endY);
        grad.addColorStop(0, `rgba(255, 255, 255, 0)`);
        grad.addColorStop(0.8, `rgba(244, 114, 182, ${shootingStar.opacity * 0.8})`);
        grad.addColorStop(1, `rgba(255, 255, 255, ${shootingStar.opacity})`);

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(shootingStar.x, shootingStar.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        shootingStar.x += Math.cos(shootingStar.angle) * shootingStar.speed;
        shootingStar.y += Math.sin(shootingStar.angle) * shootingStar.speed;
        shootingStar.life++;
        shootingStar.opacity -= 0.025;

        if (shootingStar.opacity <= 0 || shootingStar.x > width || shootingStar.y > height) {
          shootingStar = null;
        }
        ctx.restore();
      }

      // Draw floating heart lights & stars
      for (const p of particles) {
        p.y += p.speedY;
        p.x += p.speedX;
        p.rotation += p.rotSpeed;
        p.opacity += p.fadeSpeed;

        if (p.opacity > 0.85 || p.opacity < 0.15) {
          p.fadeSpeed = -p.fadeSpeed;
        }

        if (p.y < -30) {
          p.y = height + 20;
          p.x = Math.random() * width;
        }
        if (p.x < -20) p.x = width + 10;
        if (p.x > width + 20) p.x = -10;

        ctx.fillStyle = `${p.color}${Math.max(0, p.opacity)})`;
        ctx.shadowColor = p.color + '0.7)';
        ctx.shadowBlur = p.isHeart ? 10 : 6;

        if (p.isHeart) {
          drawHeart(ctx, p.x, p.y, p.size * 1.5, p.rotation);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {/* Dreamy Scene Illustration Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
        style={{
          backgroundImage: `url(${bestieCatsMoon})`,
        }}
      />

      {/* Atmospheric Vignette & Dark Translucent Overlay (balances vibrant art visibility with UI readability) */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#060814]/55 via-[#080a18]/65 to-[#05060f]/85" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-slate-950/70" />

      {/* Interactive Soft Glowing Canvas for shooting stars and heart lights */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};
