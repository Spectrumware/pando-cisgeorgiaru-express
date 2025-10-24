const colors = require('tailwindcss/colors');
const plugin = require('tailwindcss/plugin');

module.exports = {
  content: ['./views/**/*.html', './public/css/source.css', './views/**/*.js'],
  theme: {
    extend: {
      fontFamily: {
        nunito: ['Nunito Sans', 'sans-serif'],
        arial: ['Arial', 'sans-serif'],
        courier: ['Courier New', 'monospace'],
        georgia: ['Georgia', 'serif'],
        times: ['Times New Roman', 'serif'],
        verdana: ['Verdana', 'sans-serif']
      },
      colors: {
        'brand-green': {
          '50': '#fbfaea',
          '100': '#f6f5d1',
          '200': '#ededa9',
          '300': '#dee076',
          '400': '#ccd04b',
          '500': '#bec531',
          '600': '#899020',
          '700': '#676e1d',
          '800': '#53581c',
          '900': '#454b1c',
          '950': '#25290a'
        },
        'dark-green': {
          '50': '#f1fcfb',
          '100': '#d0f7f6',
          '200': '#a1eeed',
          '300': '#69dddf',
          '400': '#3bbec6',
          '500': '#21a2ab',
          '600': '#187f89',
          '700': '#165f67',
          '800': '#175158',
          '900': '#184349',
          '950': '#08252b'
        },
        'danger': {
          '50': '#fef2f2',
          '100': '#fde3e4',
          '200': '#fdcbcd',
          '300': '#faa7aa',
          '400': '#f4757a',
          '500': '#ea494f',
          '600': '#c9262c',
          '700': '#b52025',
          '800': '#951f23',
          '900': '#7c2023',
          '950': '#430c0e'
        },
        'input': {
          'border': colors.slate[600]
        }
      },
      spacing: {
        '128': '32rem',
        '144': '36rem',
        '160': '40rem'
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))'
      },
      screens: {
        'pw400': {'max': '400px'},
        'pw600': {'max': '600px'},
        'pw900': {'max': '900px'},
        'screen': {'raw': 'screen'}
      }
    }
  },
  plugins: [
    require('tailwind-scrollbar')({nocompatible: true}),
    plugin(function({addComponents, addBase, addVariant}) {
      addComponents({
        '.custom-header': {
          '@apply rounded-t-lg border border-input-border bg-slate-50 p-2 text-slate-800': {}
        },
        '.custom-body': {
          '@apply rounded-b-lg border border-t-0 border-slate-400 p-2 text-slate-800': {}
        },
        '.form-group': {
          '@apply m-3 mx-0 flex flex-col': {}
        },
        '.form-group-row': {
          '@apply flex': {}
        },
        '.form-group-button': {
          '@apply box-border rounded-md border border-slate-400 bg-white p-2 py-1': {}
        },
        '.form-control': {
          '@apply box-border rounded-md border border-input-border text-slate-800': {}
        },
        '.wrapped': {
          '@apply m-2 mx-0 rounded-lg border-2 border-slate-400 p-2': {}
        },
        '.btn': {
          '@apply box-border inline-block rounded-md border-0 bg-slate-200 p-2 py-1 no-underline ring-1 ring-inset ring-slate-400': {}
        },
        '.nav-logos': {
          '@apply flex shrink pw400:flex-col-reverse pw400:items-stretch pw400:justify-stretch pw400:h-[95px]': {}
        },
        '.nav-bar': {
          '@apply m-0 mx-1 flex flex-row items-end': {}
        },
        '.backend-columns': {
          '@apply flex flex-row-reverse mt-[-96px] pt-[96px]': {},
          'min-height': '100vh'
        },
        '.backend-column-right': {
          '@apply shrink-0 z-[2] w-[315px] pw900:w-0 pw900:justify-end pw900:border-l pw900:border-white': {}
        },
        '.backend-column-left': {
          '@apply flex w-full shrink flex-col justify-start z-[1]': {}
        },
        '.auth-form': {
          '@apply m-auto my-4 w-full max-w-5xl w-[calc(100%_-_16px)]': {}
        },
        '.light-error': {
          '--error-color': '#e35050'
        },
        '.dark-error': {
          '--error-color': '#902424'
        }
      });
    })
  ]
};
