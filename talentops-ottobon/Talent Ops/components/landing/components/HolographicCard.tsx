import React from 'react'

export function HolographicCard({ children, className = '', holographicColor = '124, 58, 237' }: any) {
    return (
        <div
            className={`holographic-card ${className}`}
            style={{ '--holo-rgb': holographicColor } as React.CSSProperties}
        >
            {children}
        </div>
    )
}
