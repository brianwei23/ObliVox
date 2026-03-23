export default function Background() {
    return (
        <svg className="absolute inset-0 w-full h-full z-0" xmlns="http://www.w3.org/2000/svg">
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
            {[60,120,180,240,300,360,420].map(y => (
                <line key={y} x1="0" y1={`${y}px`} x2="100%" y2={`${y}px`} stroke="#6ee7f7" strokeWidth="0.5" opacity="0.06"/>
            ))}
            {[80,160,240,320,400,480,560,640].map(x => (
                <line key={x} x1={`${x}px`} y1="0" x2={`${x}px`} y2="100%" stroke="#6ee7f7" strokeWidth="0.5" opacity="0.06"/>
            ))}
            <rect className="scanline" x="0" y="0" width="100%" height="2" fill="#6ee7f7"/>
            <circle className="ring1" cx="50%" cy="50%" r="280" fill="none" stroke="#6ee7f7" strokeWidth="1"/>
            <circle className="ring2" cx="50%" cy="50%" r="200" fill="none" stroke="#6ee7f7" strokeWidth="0.8"/>
           
            {/* Top left */}
            <circle className="ring3" cx="50%" cy="50%" r="120" fill="none" stroke="#6ee7f7" strokeWidth="0.6"/>
            <circle cx="60" cy="60" r="3" fill="#6ee7f7" opacity="0.4"/>
            <line x1="60" y1="60" x2="120" y2="60" stroke="#6ee7f7" strokeWidth="1" opacity="0.3"/>
            <line x1="60" y1="60" x2="60" y2="120" stroke="#6ee7f7" strokeWidth="1" opacity="0.3"/>
           
            {/* Top right */}
            <circle cx="calc(100% - 60px)" cy="60" r="3" fill="#6ee7f7" opacity="0.4"/>
            <line x1="calc(100% - 60px)" y1="60" x2="calc(100% - 120px)" y2="60" stroke="#6ee7f7" strokeWidth="1" opacity="0.3"/>
            <line x1="calc(100% - 60px)" y1="60" x2="calc(100% - 60px)" y2="120" stroke="#6ee7f7" strokeWidth="1" opacity="0.3"/>

            {/* Bottom left */}
            <circle cx="60" cy="calc(100% - 60px)" r="3" fill="#6ee7f7" opacity="0.4"/>
            <line x1="60" y1="calc(100% - 60px)" x2="120" y2="calc(100% - 60px)" stroke="#6ee7f7" strokeWidth="1" opacity="0.3"/>
            <line x1="60" y1="calc(100% - 60px)" x2="60" y2="calc(100% - 120px)" stroke="#6ee7f7" strokeWidth="1" opacity="0.3"/>

            {/* Bottom right */}
            <circle cx="calc(100% - 60px)" cy="calc(100% - 60px)" r="3" fill="#6ee7f7" opacity="0.4"/>
            <line x1="calc(100% - 60px)" y1="calc(100% - 60px)" x2="calc(100% - 120px)" y2="calc(100% - 60px)" stroke="#6ee7f7" strokeWidth="1" opacity="0.3"/>
            <line x1="calc(100% - 60px)" y1="calc(100% - 60px)" x2="calc(100% - 60px)" y2="calc(100% - 120px)" stroke="#6ee7f7" strokeWidth="1" opacity="0.3"/>
        </svg>
    );
}