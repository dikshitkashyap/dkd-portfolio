import { useState } from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function DesignerCard(props) {
    const {
        cardholderName,
        cardNumber,
        validThru,
        cvvText,
        email,
        intro,
        showOpenToWork,
        accentColor,
        width,
        height,
    } = props

    const [isFlipped, setIsFlipped] = useState(false)

    const styles = {
        root: {
            perspective: "1200px",
            width,
            height,
            cursor: "pointer",
            position: "relative",
            fontFamily: "sans-serif",
        },
        inner: {
            position: "relative",
            width: "100%",
            height: "100%",
            transition: "transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        },
        face: {
            position: "absolute",
            width: "100%",
            height: "100%",
            borderRadius: 16,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            background: "linear-gradient(135deg, #0a0a0a 0%, #111 40%, #0d1117 100%)",
            border: "1px solid #222",
            overflow: "hidden",
            boxShadow:
                "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset",
        },
    }

    // Inline keyframe injection — Framer supports this
    const css = `
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Outfit:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @keyframes dkd-shimmer {
            0%   { background-position: -200% 0; }
            100% { background-position:  200% 0; }
        }
        @keyframes dkd-pulse {
            0%,100% { opacity:1; box-shadow:0 0 8px rgba(74,222,128,0.5); }
            50%      { opacity:.6; box-shadow:0 0 16px rgba(74,222,128,0.8); }
        }
    `

    return (
        <div
            style={styles.root}
            onMouseEnter={() => setIsFlipped(true)}
            onMouseLeave={() => setIsFlipped(false)}
        >
            <style>{css}</style>

            <div style={styles.inner}>

                {/* ─────────────── FRONT ─────────────── */}
                <div
                    style={{
                        ...styles.face,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        padding: "24px 28px",
                    }}
                >
                    {/* Shimmer overlay */}
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            background:
                                "linear-gradient(105deg, transparent 40%, rgba(102,179,255,0.03) 45%, rgba(102,179,255,0.06) 50%, rgba(102,179,255,0.03) 55%, transparent 60%)",
                            backgroundSize: "200% 100%",
                            animation: "dkd-shimmer 6s ease-in-out infinite",
                            pointerEvents: "none",
                        }}
                    />

                    {/* Top row — Chip + Mastercard */}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                        }}
                    >
                        {/* Gold EMV chip */}
                        <svg width="40" height="30" viewBox="0 0 40 30" fill="none">
                            <rect
                                x="0.5" y="0.5" width="39" height="29" rx="4.5"
                                fill="url(#dkd-chipGold)" stroke="#8B7535" strokeWidth="0.5"
                            />
                            <line x1="0" y1="11" x2="40" y2="11" stroke="#9E8A42" strokeWidth="0.5" opacity="0.6" />
                            <line x1="0" y1="19" x2="40" y2="19" stroke="#9E8A42" strokeWidth="0.5" opacity="0.6" />
                            <line x1="14" y1="0" x2="14" y2="30" stroke="#9E8A42" strokeWidth="0.5" opacity="0.6" />
                            <line x1="26" y1="0" x2="26" y2="30" stroke="#9E8A42" strokeWidth="0.5" opacity="0.6" />
                            <rect x="14" y="11" width="12" height="8" fill="url(#dkd-chipCenter)" opacity="0.4" />
                            <defs>
                                <linearGradient id="dkd-chipGold" x1="0" y1="0" x2="40" y2="30">
                                    <stop offset="0%"   stopColor="#C9A84C" />
                                    <stop offset="30%"  stopColor="#E8D48B" />
                                    <stop offset="50%"  stopColor="#F0E6A8" />
                                    <stop offset="70%"  stopColor="#D4B85A" />
                                    <stop offset="100%" stopColor="#A38A3B" />
                                </linearGradient>
                                <linearGradient id="dkd-chipCenter" x1="14" y1="11" x2="26" y2="19">
                                    <stop offset="0%"   stopColor="#B8962E" />
                                    <stop offset="100%" stopColor="#D4B85A" />
                                </linearGradient>
                            </defs>
                        </svg>

                        {/* Mastercard */}
                        <svg width="48" height="30" viewBox="0 0 48 30" fill="none" style={{ opacity: 0.9 }}>
                            <circle cx="17" cy="15" r="12" fill="#EB001B" />
                            <circle cx="31" cy="15" r="12" fill="#F79E1B" />
                            <path
                                d="M24,4.8c3,0,5.8,1.2,7.8,3.2c-2,2-4.6,3.2-7.8,3.2s-5.8-1.2-7.8-3.2C18.2,6,20.8,4.8,24,4.8z"
                                fill="#FF5F00"
                            />
                        </svg>
                    </div>

                    {/* Card number */}
                    <div
                        style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 15,
                            fontWeight: 400,
                            letterSpacing: "0.15em",
                            color: "#888",
                            textAlign: "center",
                        }}
                    >
                        {cardNumber}
                    </div>

                    {/* Bottom row — Name + Valid Thru */}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-end",
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    fontFamily: "'Outfit', sans-serif",
                                    fontSize: 9,
                                    fontWeight: 600,
                                    letterSpacing: "0.15em",
                                    color: "#444",
                                    marginBottom: 4,
                                    textTransform: "uppercase",
                                }}
                            >
                                Cardholder
                            </div>
                            <div
                                style={{
                                    fontFamily: "'DM Serif Display', serif",
                                    fontSize: 16,
                                    color: "#E0E0E0",
                                    letterSpacing: "0.02em",
                                }}
                            >
                                {cardholderName}
                            </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                            <div
                                style={{
                                    fontFamily: "'Outfit', sans-serif",
                                    fontSize: 9,
                                    fontWeight: 600,
                                    letterSpacing: "0.15em",
                                    color: "#444",
                                    marginBottom: 4,
                                    textTransform: "uppercase",
                                }}
                            >
                                Valid Thru
                            </div>
                            <div
                                style={{
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: 14,
                                    color: "#888",
                                }}
                            >
                                {validThru}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─────────────── BACK ─────────────── */}
                <div
                    style={{
                        ...styles.face,
                        transform: "rotateY(180deg)",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {/* Magnetic stripe */}
                    <div
                        style={{
                            marginTop: 20,
                            height: 36,
                            width: "100%",
                            background: "linear-gradient(90deg, #1a1a1a, #252525, #1a1a1a)",
                        }}
                    />

                    {/* Signature + CVV */}
                    <div style={{ padding: "14px 20px 0" }}>
                        <div
                            style={{
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: 8,
                                fontWeight: 500,
                                letterSpacing: "0.15em",
                                color: "#888",
                                textTransform: "uppercase",
                                marginBottom: 6,
                            }}
                        >
                            Authorized Signature
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div
                                style={{
                                    flex: 1,
                                    height: 32,
                                    background: "linear-gradient(90deg, #1c1c1c, #181818)",
                                    borderRadius: 4,
                                    display: "flex",
                                    alignItems: "center",
                                    padding: "0 12px",
                                }}
                            >
                                <span
                                    style={{
                                        fontFamily: "'DM Serif Display', serif",
                                        fontSize: 14,
                                        fontStyle: "italic",
                                        color: "#aaa",
                                        letterSpacing: "0.02em",
                                    }}
                                >
                                    {cardholderName.split(" ").slice(0, 2).join(" ").replace(/(\w+)\s(\w+)/, "$1 $2").replace(/^(\w)(\w+)\s/, (_, f, r) => f + r.slice(0,0) + ". ")}
                                </span>
                            </div>
                            <div
                                style={{
                                    width: 52,
                                    height: 32,
                                    background: "#e8e8e8",
                                    borderRadius: 4,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <span
                                    style={{
                                        fontFamily: "'JetBrains Mono', monospace",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: "#111",
                                        letterSpacing: "0.08em",
                                    }}
                                >
                                    {cvvText}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Intro text */}
                    <div
                        style={{
                            padding: "10px 20px 0",
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: 8.5,
                            fontWeight: 300,
                            lineHeight: 1.7,
                            color: "#888",
                        }}
                    >
                        {intro}
                    </div>

                    {/* Bottom — Email + Open to Work */}
                    <div
                        style={{
                            marginTop: "auto",
                            padding: "0 20px 16px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-end",
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    fontFamily: "'Outfit', sans-serif",
                                    fontSize: 8,
                                    fontWeight: 500,
                                    letterSpacing: "0.1em",
                                    color: "#777",
                                    marginBottom: 3,
                                    textTransform: "uppercase",
                                }}
                            >
                                Customer Service
                            </div>
                            <div
                                style={{
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: 10,
                                    color: "#aaa",
                                }}
                            >
                                {email}
                            </div>
                        </div>

                        {showOpenToWork && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                }}
                            >
                                <div
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: "50%",
                                        background: accentColor,
                                        animation: "dkd-pulse 2s ease-in-out infinite",
                                        flexShrink: 0,
                                    }}
                                />
                                <span
                                    style={{
                                        fontFamily: "'Outfit', sans-serif",
                                        fontSize: 9,
                                        fontWeight: 500,
                                        letterSpacing: "0.1em",
                                        color: "#777",
                                    }}
                                >
                                    OPEN TO WORK
                                </span>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    )
}

// ─── Default props ───────────────────────────────────────────
DesignerCard.defaultProps = {
    cardholderName: "Dikshit Kashyap Das",
    cardNumber: "UPI · BBPS · PPI · NPCI",
    validThru: "11/22",
    cvvText: "BLR",
    email: "dkashyap450@gmail.com",
    intro: "I design UPI products, BBPS integrations, and compliance flows at BlackBuck — where the system behind the screen matters as much as the screen itself. Part-time nitpicker of design psychology.",
    showOpenToWork: true,
    accentColor: "#4ADE80",
    width: 420,
    height: 260,
}

// ─── Framer property controls ────────────────────────────────
addPropertyControls(DesignerCard, {
    cardholderName: {
        type: ControlType.String,
        title: "Name",
        defaultValue: "Dikshit Kashyap Das",
    },
    cardNumber: {
        type: ControlType.String,
        title: "Card Number",
        defaultValue: "UPI · BBPS · PPI · NPCI",
    },
    validThru: {
        type: ControlType.String,
        title: "Valid Thru",
        defaultValue: "11/22",
    },
    cvvText: {
        type: ControlType.String,
        title: "CVV Text",
        defaultValue: "BLR",
    },
    email: {
        type: ControlType.String,
        title: "Email",
        defaultValue: "dkashyap450@gmail.com",
    },
    intro: {
        type: ControlType.String,
        title: "Back Intro",
        displayTextArea: true,
        defaultValue: "I design UPI products, BBPS integrations, and compliance flows at BlackBuck — where the system behind the screen matters as much as the screen itself. Part-time nitpicker of design psychology.",
    },
    showOpenToWork: {
        type: ControlType.Boolean,
        title: "Open to Work",
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
    },
    accentColor: {
        type: ControlType.Color,
        title: "Accent",
        defaultValue: "#4ADE80",
    },
    width: {
        type: ControlType.Number,
        title: "Width",
        defaultValue: 420,
        min: 300,
        max: 560,
        step: 10,
        displayStepper: true,
    },
    height: {
        type: ControlType.Number,
        title: "Height",
        defaultValue: 260,
        min: 180,
        max: 340,
        step: 10,
        displayStepper: true,
    },
})
