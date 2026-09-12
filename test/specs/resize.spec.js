import { acquireChart } from '../utils'

/** Non-transparent, non-(near)white pixel share of a canvas's current bitmap. */
function ink(canvas) {
  const { data, height, width } = canvas
    .getContext('2d')
    .getImageData(0, 0, canvas.width, canvas.height)
  let painted = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0 && (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250)) {
      painted++
    }
  }
  return painted / (width * height)
}

function raf() {
  return new Promise((resolve) => requestAnimationFrame(resolve))
}

const data = [
  { flow: 15, from: 'Oil', to: 'Fossil fuels' },
  { flow: 20, from: 'Natural gas', to: 'Fossil fuels' },
  { flow: 25, from: 'Coal', to: 'Fossil fuels' },
  { flow: 60, from: 'Fossil fuels', to: 'Energy' },
  { flow: 10, from: 'Nuclear', to: 'Energy' },
  { flow: 30, from: 'Renewables', to: 'Energy' },
  { flow: 40, from: 'Energy', to: 'Electricity' },
  { flow: 35, from: 'Energy', to: 'Heat' },
  { flow: 25, from: 'Energy', to: 'Lost' },
]

describe('resize', () => {
  it('should keep painting a frame while the container is being resized (#70)', async () => {
    let resolveInitialAnimation
    const initialAnimation = new Promise((resolve) => {
      resolveInitialAnimation = resolve
    })

    const chart = acquireChart(
      {
        data: {
          datasets: [{ borderWidth: 2, colorFrom: 'red', colorTo: 'green', data }],
        },
        options: {
          animation: {
            onComplete: () => resolveInitialAnimation(),
          },
          maintainAspectRatio: false,
          responsive: true,
        },
        type: 'sankey',
      },
      {
        wrapper: { style: 'height: 400px; width: 800px;' },
      }
    )

    // Let the first render's progress animation finish before touching size:
    // this is the animation the fix must leave untouched.
    await initialAnimation
    const stableInk = ink(chart.canvas)
    expect(stableInk).toBeGreaterThan(0)

    chart.canvas.parentElement.style.width = '500px'

    const frames = []
    for (let i = 0; i < 6; i++) {
      await raf()
      frames.push(ink(chart.canvas))
    }

    for (const [i, frame] of frames.entries()) {
      expect(frame, `frame ${i}: ${JSON.stringify(frames)}`).toBeGreaterThan(stableInk / 2)
    }
  })
})
