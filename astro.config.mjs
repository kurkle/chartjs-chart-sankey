import mdx from '@astrojs/mdx'
import starlight from '@astrojs/starlight'
import chartEditor from '@kurkle/astro-chartjs-editor'
import { defineConfig } from 'astro/config'

export default defineConfig({
  integrations: [
    chartEditor({
      runtime: './docs/chart-runtime.js',
      sourceBaseUrl: 'https://github.com/kurkle/chartjs-chart-sankey/blob/main/',
    }),
    starlight({
      customCss: ['./docs/styles/starlight.css'],
      description: 'Chart.js module for creating sankey diagrams',
      favicon: '/favicon.ico',
      head: [
        {
          attrs: { href: '/favicon-96x96.png', rel: 'icon', sizes: '96x96', type: 'image/png' },
          tag: 'link',
        },
        {
          attrs: { href: '/favicon.svg', rel: 'icon', type: 'image/svg+xml' },
          tag: 'link',
        },
        {
          attrs: { href: '/favicon.ico', rel: 'shortcut icon' },
          tag: 'link',
        },
        {
          attrs: { href: '/apple-touch-icon.png', rel: 'apple-touch-icon', sizes: '180x180' },
          tag: 'link',
        },
        {
          attrs: { href: '/site.webmanifest', rel: 'manifest' },
          tag: 'link',
        },
      ],
      sidebar: [
        {
          items: [
            { label: 'Getting Started', link: '/' },
            { label: 'Integration', link: '/integration/' },
            { label: 'Usage', link: '/usage/' },
          ],
          label: 'Guide',
        },
        {
          items: [
            { label: 'Basic', link: '/samples/basic/' },
            { label: 'Energy', link: '/samples/energy/' },
            { label: 'Flow Colors', link: '/samples/flow-colors/' },
            { label: 'Flow Labels', link: '/samples/flow-labels/' },
            { label: 'Labels', link: '/samples/labels/' },
            { label: 'Layout', link: '/samples/layout/' },
            { label: 'Node Labels', link: '/samples/node-labels/' },
            { label: 'Parsing', link: '/samples/parsing/' },
            { label: 'Refugee Hosting', link: '/samples/refugee-hosting-2025/' },
            { label: 'U.S. Energy Consumption', link: '/samples/us-energy-2023/' },
            { label: 'Vertical', link: '/samples/vertical/' },
          ],
          label: 'Samples',
        },
        {
          items: [
            {
              attrs: { rel: 'noopener noreferrer', target: '_blank' },
              label: 'Awesome Chart.js',
              link: 'https://github.com/chartjs/awesome',
            },
            {
              label: 'chartjs-chart-matrix',
              link: 'https://chartjs-chart-matrix.pages.dev/',
            },
            {
              label: 'chartjs-chart-treemap',
              link: 'https://chartjs-chart-treemap.pages.dev/',
            },
            {
              label: 'chartjs-plugin-autocolors',
              link: 'https://chartjs-plugin-autocolors.pages.dev/',
            },
            {
              label: 'chartjs-plugin-gradient',
              link: 'https://chartjs-plugin-gradient.pages.dev/',
            },
          ],
          label: 'Ecosystem',
        },
      ],
      social: [
        { href: 'https://github.com/kurkle/chartjs-chart-sankey', icon: 'github', label: 'GitHub' },
      ],
      title: 'chartjs-chart-sankey',
    }),
    mdx(),
  ],
  outDir: './dist/docs',
  publicDir: './docs/public',
  site: 'https://chartjs-chart-sankey.pages.dev',
})
