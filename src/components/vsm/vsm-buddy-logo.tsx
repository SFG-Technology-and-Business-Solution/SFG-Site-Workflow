'use client';

// VSM Buddy brand mark. Uses /vsm-buddy-logo.png from /public when present
// (drop the AI2 Solutions logo file there); falls back to a styled badge.
// The image is probed in the background so a missing file never shows a
// broken-image icon, even before hydration.

import React, { useEffect, useState } from 'react';
import { GitBranch } from 'lucide-react';

const LOGO_SRC = '/vsm-buddy-logo.png';

export function VsmBuddyLogo({ size = 48 }: { size?: number }) {
    const [hasImage, setHasImage] = useState(false);

    useEffect(() => {
        const img = new Image();
        img.onload = () => setHasImage(true);
        img.src = LOGO_SRC;
    }, []);

    if (hasImage) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={LOGO_SRC}
                alt="VSM Buddy - by AI2 Solutions"
                style={{ height: size }}
                className="w-auto object-contain"
            />
        );
    }

    return (
        <div
            className="rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 text-white flex items-center justify-center shadow-sm shrink-0"
            style={{ width: size, height: size }}
            aria-label="VSM Buddy"
        >
            <GitBranch size={size * 0.52} />
        </div>
    );
}
