const addRemValues = (left: string, right: string): string => {
  if (!left.endsWith("rem") || !right.endsWith("rem")) {
    throw new Error(
      `Expected rem values for addition, received: ${left} and ${right}`,
    );
  }

  return `${(Number.parseFloat(left) + Number.parseFloat(right)).toString()}rem`;
}

const buttonSizes = {
    lg: {
        "border-radius": "1rem",
        "font-size": "1.25rem",
        gap: "0.75rem",
        height: "3.5rem",
        "icon-size": "1.5rem",
        padding: "1rem"
    },
    md: {
        "border-radius": "0.75rem",
        "font-size": "1rem",
        gap: "0.5rem",
        height: "3rem",
        "icon-size": "1.5rem",
        padding: "0.75rem"
    },
    sm: {
        "border-radius": "0.5rem",
        "font-size": "0.875rem",
        gap: "0.5rem",
        height: "2.25rem",
        "icon-size": "1.25rem",
        padding: "0.5rem"
    },
    xs: {
        "border-radius": "0.375rem",
        "font-size": "0.6875rem",
        gap: "0.25rem",
        height: "1.5rem",
        "icon-size": "1rem",
        padding: "0.25rem"
    }
} as const;

export const Theme = {
    addRemValues,
    borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        base: "0.25rem",
        full: "9999px",
        lg: "0.5rem",
        md: "0.375rem",
        none: "0px",
        sm: "0.125rem",
        xl: "0.75rem"
    },
    breakpoints: {
        "2xl": "1536px",
        lg: "1024px",
        md: "768px",
        sm: "640px",
        xl: "1280px"
    },
    buttonPadding: (size: keyof typeof buttonSizes, includeGap: boolean): string => {
        const button = Theme.buttonSizes[size];
        const padding = button.padding;
        return includeGap ? addRemValues(padding, button.gap) : padding;
    },
    buttonSizes,
    color: {
        background: {
            "card-highlight": "light-dark(#ede9fe, #2e1065)",
            "card-secondary": "light-dark(#fff, #100e23)",
            modal: "light-dark(#fff, #100e23)",
            "nav-blur": "light-dark(rgb(from #fff r g b / 70%), rgb(from #100e23 r g b / 70%))",
            primary: "light-dark(#fff, #100e23)",
            secondary: "light-dark(#f3eded, #27253d)",
            tooltip: "light-dark(#333655, #e2e3f0)"
        },
        border: "light-dark(#d6d3d1, #474a69)",
        button: {
            disabled: {
                background: "light-dark(#e7e5e4, #474a69)",
                foreground: "light-dark(#a8a29e, #9497b8)"
            },
            outline: {
                background: {
                    active: "light-dark(rgb(from #2d2222 r g b / 10%), rgb(from #f8f9fc r g b / 10%))",
                    hover: "light-dark(rgb(from #2d2222 r g b / 5%), rgb(from #f8f9fc r g b / 5%))"
                },
                border: "light-dark(#d6d3d1, #474a69)",
                foreground: "light-dark(#1c1917, #f8f9fc)"
            },
            primary: {
                background: {
                    active: "light-dark(#4c1d95, #5b21b6)",
                    hover: "light-dark(#5b21b6, #6d28d9)",
                    normal: "light-dark(#6d28d9, #7c3aed)"
                },
                foreground: "#fff"
            },
            secondary: {
                background: {
                    active: "#c084fc",
                    hover: "#d8b4fe",
                    normal: "#e9d5ff"
                },
                foreground: "#27253d"
            },
            solid: {
                background: {
                    active: "light-dark(#27253d, #f8f9fc)",
                    hover: "light-dark(#474a69, #e2e3f0)",
                    normal: "light-dark(#27253d, #f8f9fc)"
                },
                foreground: "light-dark(#f8f9fc, #27253d)"
            }
        },
        chart: {
            series: {
                neutral: "light-dark(#78716c, #cbcee1)",
                primary: "light-dark(#8b5cf6, #a78bfa)"
            }
        },
        focus: "light-dark(#6d28d9, #8b5cf6)",
        focusDim: "light-dark(rgb(from #6d28d9 r g b / 30%), rgb(from #8b5cf6 r g b / 30%))",
        foreground: "light-dark(#27253d, #f8f9fc)",
        forms: {
            input: {
                hover: {
                    border: "light-dark(#a8a29e, #64678b)"
                }
            }
        },
        heading: "light-dark(#25253e, #e2e3f0)",
        highlight: "light-dark(#7c3aed, #8b5cf6)",
        link: {
            normal: "light-dark(#25253e, #f8f9fc)",
            primary: "light-dark(#6d28d9, #d8b4fe)"
        },
        muted: "light-dark(#44403c, #cbcee1)",
        paragraph: "light-dark(#333655, #cbcee1)",
        selection: {
            background: "light-dark(#7c3aed, #a78bfa)",
            foreground: "light-dark(#f8f9fc, #100e23)"
        },
        states: {
            data: {
                background: "light-dark(#ede9fe, #2e1065)",
                border: "light-dark(#ddd6fe, #5b21b6)",
                normal: "light-dark(#7c3aed, #a78bfa)"
            },
            error: {
                active: "#b91c1c",
                background: "light-dark(#fee2e2, #450a0a)",
                base: "light-dark(#dc2626, #f87171)",
                border: "light-dark(#f87171, #7f1d1d)",
                color: "light-dark(#ef4444, #f87171)",
                hover: "#dc2626",
                normal: "#ef4444"
            },
            info: {
                background: "light-dark(#e0e7ff, #1e1b4b)",
                "background-opaque": "light-dark(rgb(from #c7d2fe r g b / 80%), rgb(from #1e1b4b r g b / 80%))",
                border: "light-dark(#818cf8, #3730a3)",
                icon: "light-dark(#4f46e5, #6366f1)",
                normal: "light-dark(#4f46e5, #818cf8)"
            },
            lime: {
                background: "light-dark(#ecfccb, #365314)",
                normal: "#84cc16"
            },
            neutral: {
                background: "light-dark(#fff, #27253d)",
                border: "light-dark(#d6d3d1, #474a69)",
                normal: "light-dark(#27253d, #f8f9fc)"
            },
            success: {
                active: "#065f46",
                background: "light-dark(#d1fae5, #022c22)",
                base: "light-dark(#059669, #10b981)",
                border: "light-dark(#34d399, #065f46)",
                hover: "#047857",
                normal: "light-dark(#059669, #10b981)"
            },
            warning: {
                background: "light-dark(#ffedd5, #431407)",
                border: "light-dark(#fb923c, #c2410c)",
                normal: "light-dark(#ea580c, #fb923c)"
            },
            yellow: {
                background: "light-dark(#fef9c3, #713f12)",
                normal: "#eab308"
            }
        },
        tooltip: "light-dark(#e2e3f0, #25253e)",
        transparent: "transparent"
    },
    colorPallete: {
        amber: {
            "100": "#fef3c7",
            "200": "#fde68a",
            "300": "#fcd34d",
            "400": "#fbbf24",
            "50": "#fffbeb",
            "500": "#f59e0b",
            "600": "#d97706",
            "700": "#b45309",
            "800": "#92400e",
            "900": "#78350f",
            "950": "#451a03"
        },
        beige: {
            "100": "#f3eded",
            "200": "#e9dfdf",
            "300": "#d9c8c8",
            "400": "#c1a8a8",
            "50": "#f7f4f4",
            "500": "#a98a8a",
            "600": "#927070",
            "700": "#795c5c",
            "800": "#664e4e",
            "900": "#574545",
            "950": "#2d2222"
        },
        black: "#000",
        blue: {
            "100": "#dbeafe",
            "200": "#bfdbfe",
            "300": "#93c5fd",
            "400": "#60a5fa",
            "50": "#eff6ff",
            "500": "#3b82f6",
            "600": "#2563eb",
            "700": "#1d4ed8",
            "800": "#1e40af",
            "900": "#1e3a8a",
            "950": "#172554"
        },
        cyan: {
            "100": "#cffafe",
            "200": "#a5f3fc",
            "300": "#67e8f9",
            "400": "#22d3ee",
            "50": "#ecfeff",
            "500": "#06b6d4",
            "600": "#0891b2",
            "700": "#0e7490",
            "800": "#155e75",
            "900": "#164e63",
            "950": "#083344"
        },
        emerald: {
            "100": "#d1fae5",
            "200": "#a7f3d0",
            "300": "#6ee7b7",
            "400": "#34d399",
            "50": "#ecfdf5",
            "500": "#10b981",
            "600": "#059669",
            "700": "#047857",
            "800": "#065f46",
            "900": "#064e3b",
            "950": "#022c22"
        },
        fuchsia: {
            "100": "#fae8ff",
            "200": "#f5d0fe",
            "300": "#f0abfc",
            "400": "#e879f9",
            "50": "#fdf4ff",
            "500": "#d946ef",
            "600": "#c026d3",
            "700": "#a21caf",
            "800": "#86198f",
            "900": "#701a75",
            "950": "#4a044e"
        },
        gray: {
            "100": "#f3f4f6",
            "200": "#e5e7eb",
            "300": "#d1d5db",
            "400": "#9ca3af",
            "50": "#f9fafb",
            "500": "#6b7280",
            "600": "#4b5563",
            "700": "#374151",
            "800": "#1f2937",
            "900": "#111827",
            "950": "#030712"
        },
        green: {
            "100": "#dcfce7",
            "200": "#bbf7d0",
            "300": "#86efac",
            "400": "#4ade80",
            "50": "#f0fdf4",
            "500": "#22c55e",
            "600": "#16a34a",
            "700": "#15803d",
            "800": "#166534",
            "900": "#14532d",
            "950": "#052e16"
        },
        indigo: {
            "100": "#e0e7ff",
            "200": "#c7d2fe",
            "300": "#a5b4fc",
            "400": "#818cf8",
            "50": "#eef2ff",
            "500": "#6366f1",
            "600": "#4f46e5",
            "700": "#4338ca",
            "800": "#3730a3",
            "900": "#312e81",
            "950": "#1e1b4b"
        },
        lime: {
            "100": "#ecfccb",
            "200": "#d9f99d",
            "300": "#bef264",
            "400": "#a3e635",
            "50": "#f7fee7",
            "500": "#84cc16",
            "600": "#65a30d",
            "700": "#4d7c0f",
            "800": "#3f6212",
            "900": "#365314",
            "950": "#1a2e05"
        },
        neutral: {
            "100": "#f5f5f5",
            "200": "#e5e5e5",
            "300": "#d4d4d4",
            "400": "#a3a3a3",
            "50": "#fafafa",
            "500": "#737373",
            "600": "#525252",
            "700": "#404040",
            "800": "#262626",
            "900": "#171717",
            "950": "#0a0a0a"
        },
        orange: {
            "100": "#ffedd5",
            "200": "#fed7aa",
            "300": "#fdba74",
            "400": "#fb923c",
            "50": "#fff7ed",
            "500": "#f97316",
            "600": "#ea580c",
            "700": "#c2410c",
            "800": "#9a3412",
            "900": "#7c2d12",
            "950": "#431407"
        },
        pink: {
            "100": "#fce7f3",
            "200": "#fbcfe8",
            "300": "#f9a8d4",
            "400": "#f472b6",
            "50": "#fdf2f8",
            "500": "#ec4899",
            "600": "#db2777",
            "700": "#be185d",
            "800": "#9d174d",
            "900": "#831843",
            "950": "#500724"
        },
        purple: {
            "100": "#f3e8ff",
            "200": "#e9d5ff",
            "300": "#d8b4fe",
            "400": "#c084fc",
            "50": "#faf5ff",
            "500": "#a855f7",
            "600": "#9333ea",
            "700": "#7e22ce",
            "800": "#6b21a8",
            "900": "#581c87",
            "950": "#3b0764"
        },
        red: {
            "100": "#fee2e2",
            "200": "#fecaca",
            "300": "#fca5a5",
            "400": "#f87171",
            "50": "#fef2f2",
            "500": "#ef4444",
            "600": "#dc2626",
            "700": "#b91c1c",
            "800": "#991b1b",
            "900": "#7f1d1d",
            "950": "#450a0a"
        },
        rose: {
            "100": "#ffe4e6",
            "200": "#fecdd3",
            "300": "#fda4af",
            "400": "#fb7185",
            "50": "#fff1f2",
            "500": "#f43f5e",
            "600": "#e11d48",
            "700": "#be123c",
            "800": "#9f1239",
            "900": "#881337",
            "950": "#4c0519"
        },
        sky: {
            "100": "#e0f2fe",
            "200": "#bae6fd",
            "300": "#7dd3fc",
            "400": "#38bdf8",
            "50": "#f0f9ff",
            "500": "#0ea5e9",
            "600": "#0284c7",
            "700": "#0369a1",
            "800": "#075985",
            "900": "#0c4a6e",
            "950": "#082f49"
        },
        slate: {
            "100": "#f1f5f9",
            "200": "#e2e8f0",
            "300": "#cbd5e1",
            "400": "#94a3b8",
            "50": "#f8fafc",
            "500": "#64748b",
            "600": "#475569",
            "700": "#334155",
            "800": "#1e293b",
            "900": "#0f172a",
            "950": "#020617"
        },
        steel: {
            "100": "#f1f2f9",
            "200": "#e2e3f0",
            "300": "#cbcee1",
            "400": "#9497b8",
            "50": "#f8f9fc",
            "500": "#64678b",
            "600": "#474a69",
            "700": "#333655",
            "800": "#25253e",
            "900": "#27253d",
            "950": "#100e23"
        },
        stone: {
            "100": "#f5f5f4",
            "200": "#e7e5e4",
            "300": "#d6d3d1",
            "400": "#a8a29e",
            "50": "#fafaf9",
            "500": "#78716c",
            "600": "#57534e",
            "700": "#44403c",
            "800": "#292524",
            "900": "#1c1917",
            "950": "#0c0a09"
        },
        teal: {
            "100": "#ccfbf1",
            "200": "#99f6e4",
            "300": "#5eead4",
            "400": "#2dd4bf",
            "50": "#f0fdfa",
            "500": "#14b8a6",
            "600": "#0d9488",
            "700": "#0f766e",
            "800": "#115e59",
            "900": "#134e4a",
            "950": "#042f2e"
        },
        violet: {
            "100": "#ede9fe",
            "200": "#ddd6fe",
            "300": "#c4b5fd",
            "400": "#a78bfa",
            "50": "#f5f3ff",
            "500": "#8b5cf6",
            "600": "#7c3aed",
            "700": "#6d28d9",
            "800": "#5b21b6",
            "900": "#4c1d95",
            "950": "#2e1065"
        },
        white: "#fff",
        yellow: {
            "100": "#fef9c3",
            "200": "#fef08a",
            "300": "#fde047",
            "400": "#facc15",
            "50": "#fefce8",
            "500": "#eab308",
            "600": "#ca8a04",
            "700": "#a16207",
            "800": "#854d0e",
            "900": "#713f12",
            "950": "#422006"
        },
        zinc: {
            "100": "#f4f4f5",
            "200": "#e4e4e7",
            "300": "#d4d4d8",
            "400": "#a1a1aa",
            "50": "#fafafa",
            "500": "#71717a",
            "600": "#52525b",
            "700": "#3f3f46",
            "800": "#27272a",
            "900": "#18181b",
            "950": "#09090b"
        }
    },
    elevations: {
        default: {
            "1": "0px 4px 6px -4px rgb(from black r g b / 10%), 0px 10px 15px -3px rgb(from black r g b / 10%)",
            "2": "0px 29px 12px 0px light-dark(rgb(from #564848 r g b / 2%), rgb(from black r g b / 8%)), 0px 16px 10px 0px light-dark(rgb(from #564848 r g b / 6%), rgb(from black r g b / 12%)), 0px 7px 7px 0px light-dark(rgb(from #564848 r g b / 12%), rgb(from black r g b / 20%)), 0px 2px 4px 0px light-dark(rgb(from #564848 r g b / 14%), rgb(from black r g b / 30%))"
        },
        primary: {
            "2": "0px 66px 18px 0px rgb(112 66 206 / 0%), 0px 42px 17px 0px rgb(112 66 206 / 3%), 0px 24px 14px 0px rgb(112 66 206 / 8%), 0px 11px 11px 0px rgb(112 66 206 / 14%), 0px 3px 6px 0px rgb(112 66 206 / 17%)"
        }
    },
    fontFamily: {
        monospace: "ui-monospace, sfmono-regular, consolas, Liberation Mono, menlo, monospace"
    },
    fontSize: {
        "2xl": "1.5rem",
        "3xl": "1.875rem",
        "4xl": "2.25rem",
        "5xl": "3rem",
        "6xl": "3.75rem",
        "7xl": "4.5rem",
        "8xl": "6rem",
        "9xl": "8rem",
        base: "1rem",
        lg: "1.125rem",
        sm: "0.875rem",
        xl: "1.25rem",
        xs: "0.75rem",
        xxs: "0.6875rem"
    },
    fontWeight: {
        black: "900",
        bold: "700",
        extrabold: "800",
        extralight: "200",
        light: "300",
        medium: "500",
        normal: "400",
        semibold: "600",
        thin: "100"
    },
    headerHeight: "var(--header-height)",
    letterSpacing: {
        normal: "0em",
        tight: "-0.025em",
        tighter: "-0.05em",
        wide: "0.025em",
        wider: "0.05em",
        widest: "0.1em"
    },
    maxWidth: "93rem",
    maxWidthPadding: "var(--max-width-padding)",
    spacing: (increment: number): string => `${(increment * 0.25).toString()}rem`
} as const;

export type ThemeType = typeof Theme;
