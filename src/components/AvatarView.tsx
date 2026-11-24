import type { AvatarConfig } from '../types';

interface AvatarViewProps {
  avatar: AvatarConfig;
  size?: number;
  className?: string;
  alt?: string;
}

export function AvatarView({ avatar, size = 48, className = '', alt = 'User avatar' }: AvatarViewProps) {
  return (
    <div
      role="img"
      aria-label={alt}
      style={{ width: size, height: size }}
      className={`relative shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br ${avatar.bgGradient} select-none ${className}`}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Back Hair for wavy / bob */}
        {avatar.hairStyle === 'wavy' && (
          <path
            d="M22 46 C20 22, 80 22, 78 46 L82 78 C72 82, 28 82, 18 78 Z"
            fill={avatar.hairColor}
          />
        )}
        {avatar.hairStyle === 'bob' && (
          <path
            d="M24 46 C22 22, 78 22, 76 46 L78 68 C68 72, 32 72, 22 68 Z"
            fill={avatar.hairColor}
          />
        )}
        {avatar.hairStyle === 'bun' && (
          <circle cx="50" cy="18" r="11" fill={avatar.hairColor} />
        )}

        {/* Shoulders / Outfit */}
        <path
          d="M18 100 C18 78, 34 72, 50 72 C66 72, 82 78, 82 100 Z"
          fill={avatar.outfitColor}
        />
        {/* Neck */}
        <rect x="43" y="62" width="14" height="14" rx="5" fill={avatar.skinTone} />

        {/* Ears */}
        <circle cx="28" cy="48" r="5" fill={avatar.skinTone} />
        <circle cx="72" cy="48" r="5" fill={avatar.skinTone} />

        {/* Head */}
        <rect x="29" y="24" width="42" height="44" rx="20" fill={avatar.skinTone} />

        {/* Front Hair */}
        {avatar.hairStyle === 'short' && (
          <path
            d="M29 40 C29 22, 71 22, 71 40 C66 32, 58 30, 50 30 C40 30, 33 34, 29 40 Z"
            fill={avatar.hairColor}
          />
        )}
        {avatar.hairStyle === 'buzz' && (
          <path
            d="M30 36 C31 22, 69 22, 70 36 C63 30, 37 30, 30 36 Z"
            fill={avatar.hairColor}
          />
        )}
        {avatar.hairStyle === 'curls' && (
          <g fill={avatar.hairColor}>
            <circle cx="34" cy="28" r="9" />
            <circle cx="46" cy="24" r="10" />
            <circle cx="58" cy="25" r="9" />
            <circle cx="67" cy="30" r="8" />
          </g>
        )}
        {(avatar.hairStyle === 'wavy' || avatar.hairStyle === 'bob' || avatar.hairStyle === 'bun') && (
          <path
            d="M29 40 C30 22, 70 22, 71 40 C62 30, 48 31, 42 35 C36 33, 32 36, 29 40 Z"
            fill={avatar.hairColor}
          />
        )}

        {/* Eyes */}
        <circle cx="41" cy="46" r="2.6" fill="#0F172A" />
        {avatar.mood === 'wink' ? (
          <path d="M55 46 Q59 43 63 46" stroke="#0F172A" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        ) : (
          <circle cx="59" cy="46" r="2.6" fill="#0F172A" />
        )}

        {/* Eyebrows */}
        <path d="M37 40 Q41 38 45 40" stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.7" />
        <path d="M55 40 Q59 38 63 40" stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.7" />

        {/* Mood Mouth */}
        {avatar.mood === 'smile' && (
          <path d="M43 56 Q50 61 57 56" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        )}
        {avatar.mood === 'grin' && (
          <path d="M42 55 Q50 63 58 55 Z" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.8" strokeLinejoin="round" />
        )}
        {avatar.mood === 'chill' && (
          <path d="M44 57 Q50 58 56 56" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        )}
        {avatar.mood === 'wink' && (
          <path d="M43 55 Q50 61 58 54" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        )}

        {/* Eyewear */}
        {avatar.eyewear === 'round' && (
          <g stroke="#0F172A" strokeWidth="2" fill="none">
            <circle cx="41" cy="46" r="6.5" />
            <circle cx="59" cy="46" r="6.5" />
            <line x1="47.5" y1="46" x2="52.5" y2="46" />
          </g>
        )}
        {avatar.eyewear === 'square' && (
          <g stroke="#0F172A" strokeWidth="2" fill="none">
            <rect x="34" y="40" width="13" height="11" rx="2.5" />
            <rect x="53" y="40" width="13" height="11" rx="2.5" />
            <line x1="47" y1="45" x2="53" y2="45" />
          </g>
        )}
        {avatar.eyewear === 'shades' && (
          <g fill="#0F172A">
            <rect x="33" y="40" width="15" height="11" rx="3" />
            <rect x="52" y="40" width="15" height="11" rx="3" />
            <rect x="47" y="43" width="6" height="2.2" />
          </g>
        )}

        {/* Accessories */}
        {avatar.accessory === 'cap' && (
          <g>
            <path d="M27 31 C28 17, 72 17, 73 31 Z" fill="#FACC15" />
            <path d="M27 30 L79 30 C81 33, 74 35, 65 34 L27 33 Z" fill="#EAB308" />
          </g>
        )}
        {avatar.accessory === 'beanie' && (
          <g>
            <path d="M28 33 C28 16, 72 16, 72 33 Z" fill="#EA580C" />
            <rect x="26" y="29" width="48" height="7" rx="3.5" fill="#C2410C" />
          </g>
        )}
        {avatar.accessory === 'headphones' && (
          <g>
            <path d="M25 46 C25 18, 75 18, 75 46" stroke="#334155" strokeWidth="4" fill="none" />
            <rect x="21" y="40" width="7" height="16" rx="3.5" fill="#0F172A" />
            <rect x="72" y="40" width="7" height="16" rx="3.5" fill="#0F172A" />
          </g>
        )}
        {avatar.accessory === 'halo' && (
          <ellipse cx="50" cy="14" rx="16" ry="4" stroke="#FACC15" strokeWidth="3" fill="none" />
        )}
      </svg>
    </div>
  );
}
