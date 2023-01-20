/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin')

const rotateX = plugin(function ({ addUtilities }) {
  addUtilities({
    '.rotate-y-0': {
      transform: 'rotateY(0)',
    },
    '.rotate-y-180': {
      transform: 'rotateY(180deg)',
    },
    '.-rotate-y-180': {
      transform: 'rotateY(-180deg)',
    },
  })
})

module.exports = {
  mode: 'jit',
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    screens: {
      xs: '375px',
      // => @media (min-width: 375px) { ... }

      sm: '640px',
      // => @media (min-width: 640px) { ... }

      md: '768px',
      // => @media (min-width: 768px) { ... }

      lg: '992px',
      // => @media (min-width: 992px) { ... }

      xl: '1280px',
      // => @media (min-width: 1280px) { ... }

      '2xl': '1536px',
      // => @media (min-width: 1536px) { ... }

      hoverable: { raw: '(hover: hover)' },
    },
    fontFamily: {
      arboria: 'arboria, sans-serif',
      roboto: 'roboto, sans-serif',
      robotoMono: 'roboto-mono, monospace',
      inter: 'inter, sans-serif',
      poppins: 'poppins, sans-serif',
      body: 'Urbanist, sans-serif',
      mono: 'IBM Plex Mono, monospace',
    },
    extend: {
      fontSize: {
        xs: ['12px', '1'],
        sm: ['13px', '1'],
        base: ['14px', '22px'],
        base16: ['16px', '24px'],
        base18: ['18px', '1'],
        lg: ['24px', '30px'],
        xl: ['59px', '1.1'],
      },
      colors: {
        transparent: 'transparent',
        current: 'currentColor',
        light: '#E6DAFE',
        dark: '#110F23',
        'dark-300': 'rgba(36, 34, 53, .3)',
        darkGray: '#252236',
        darkGray1: '#242235',
        darkGray2: '#312F47',
        darkGray3: '#2F2C4F',
        darkGray4: '#413E53',
        hoverGray: 'rgba(255, 255, 255, 0.08)',
        beige: '#F1EAEA',
        'beige-300': 'rgba(229, 231, 235, .3)',
        beige2: '#E4DADB',
        beige3: '#D6CACB',
        green: '#15AE6E',
        lightPurple: '#7731EA',
        offPurple: '#745E9D',
        pythPurple: '#7142CF',
        mediumSlateBlue: '#8246FA',
      },
      letterSpacing: {
        wide: '.02em',
        subtitle: '.15em',
      },
      backgroundImage: {
        radial:
          'radial-gradient(100% 628.91% at 95.63% 10.42%, rgba(230, 218, 254, 0) 0%, #E6DAFE 30.71%, #E6DAFE 71.52%, rgba(230, 218, 254, 0) 100%)',
        radial2:
          'radial-gradient(91.27% 628.91% at 95.63% 10.42%, rgba(75, 52, 122, 0.15) 0%, #4B347A 30.71%, #4B347A 71.52%, rgba(75, 52, 122, 0.19) 100%)',
      },

      boxShadow: {
        purple: 'inset 0px 0px 5px rgba(255, 176, 247, 0.25)',
      },
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          lg: '2rem',
          xl: '3.5rem',
        },
        screens: {
          sm: '600px',
          md: '728px',
          lg: '984px',
          xl: '1272px',
        },
      },
      animation: {
        marquee: 'marquee 50s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [rotateX],
}
