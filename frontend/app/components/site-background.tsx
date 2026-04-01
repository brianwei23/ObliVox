export default function Background() {
  // Pre-calculated fixed coordinate arrays for grid lines in a 1920x1080 space
  const xGridLines = [213, 427, 640, 853, 1067, 1280, 1493, 1707]; // (i+1)*1920/9
  const yGridLines = [135, 270, 405, 540, 675, 810, 945]; // (i+1)*1080/8

  return (
    <svg
      className="absolute inset-0 w-full h-full z-0"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1920 1080"
    >
      <defs>
        <style>{`
          @keyframes pulse { 0%,100%{opacity:0.18} 50%{opacity:0.38} }
          @keyframes scan { 0%{transform:translateY(0)} 100%{transform:translateY(100vh)} }
          .ring1 { animation: pulse 3.2s ease-in-out infinite; }
          .ring2 { animation: pulse 3.2s ease-in-out infinite 0.6s; }
          .ring3 { animation: pulse 3.2s ease-in-out infinite 1.2s; }
          .scanline { animation: scan 4s linear infinite; opacity: 0.07; }
        `}</style>
      </defs>

      {/* Grid Lines using pre-calculated fixed positions */}
      {yGridLines.map((y) => (
        <line
          key={y}
          x1="0"
          y1={y}
          x2="100%"
          y2={y}
          stroke="#6ee7f7"
          strokeWidth="0.5"
          opacity="0.06"
        />
      ))}
      {xGridLines.map((x) => (
        <line
          key={x}
          x1={x}
          y1="0"
          x2={x}
          y2="100%"
          stroke="#6ee7f7"
          strokeWidth="0.5"
          opacity="0.06"
        />
      ))}

      <rect className="scanline" x="0" y="0" width="100%" height="2" fill="#6ee7f7" />

      <circle className="ring1" cx="960" cy="540" r="430" fill="none" stroke="#6ee7f7" strokeWidth="1" />
      <circle className="ring2" cx="960" cy="540" r="320" fill="none" stroke="#6ee7f7" strokeWidth="0.8" />
      <circle className="ring3" cx="960" cy="540" r="220" fill="none" stroke="#6ee7f7" strokeWidth="0.6" />

      {/* Top left corner */}
      <circle cx="60" cy="60" r="3" fill="#6ee7f7" opacity="0.4" />
      <line x1="60" y1="60" x2="180" y2="60" stroke="#6ee7f7" strokeWidth="1" opacity="0.3" />
      <line x1="60" y1="60" x2="60" y2="180" stroke="#6ee7f7" strokeWidth="1" opacity="0.3" />

      {/* Top right corner */}
      <circle cx="1860" cy="60" r="3" fill="#6ee7f7" opacity="0.4" />
      <line x1="1860" y1="60" x2="1740" y2="60" stroke="#6ee7f7" strokeWidth="1" opacity="0.3" />
      <line x1="1860" y1="60" x2="1860" y2="180" stroke="#6ee7f7" strokeWidth="1" opacity="0.3" />

      {/* Bottom left corner */}
      <circle cx="60" cy="1020" r="3" fill="#6ee7f7" opacity="0.4" />
      <line x1="60" y1="1020" x2="180" y2="1020" stroke="#6ee7f7" strokeWidth="1" opacity="0.3" />
      <line x1="60" y1="1020" x2="60" y2="900" stroke="#6ee7f7" strokeWidth="1" opacity="0.3" />

      {/* Bottom right corner */}
      <circle cx="1860" cy="1020" r="3" fill="#6ee7f7" opacity="0.4" />
      <line x1="1860" y1="1020" x2="1740" y2="1020" stroke="#6ee7f7" strokeWidth="1" opacity="0.3" />
      <line x1="1860" y1="1020" x2="1860" y2="900" stroke="#6ee7f7" strokeWidth="1" opacity="0.3" />
    </svg>
  );
}