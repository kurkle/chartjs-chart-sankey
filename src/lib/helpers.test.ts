import { defined, toTextLines, validateSizeValue } from './helpers.js'

function formatValue(value: any) {
  if (Number.isNaN(value)) {
    return 'NaN'
  }
  return value === undefined ? 'undefined' : JSON.stringify(value)
}

function formatDescription(description: string, args: any[]) {
  let index = 0
  return description.replaceAll('%p', () => formatValue(args[index++]))
}

function each(cases: any[][]) {
  return (description: string, fn: (...args: any[]) => void) => {
    cases.forEach((args) => {
      it(formatDescription(description, args), () => fn(...args))
    })
  }
}

describe('lib/helpers', () => {
  describe('defined', () => {
    each([
      [false, undefined],
      [true, null],
      [true, 0],
      [true, 'abba'],
      [true, []],
      [true, {}],
      [true, NaN],
    ])('should return %p for %p', (expected, input) => {
      expect(defined(input)).toBe(expected)
    })
  })
  describe('toTxtLines', () => {
    each([
      [[], undefined],
      [['123'], 123],
      [['test'], 'test'],
      [['test'], ['test']],
      [['a', 'b'], 'a\nb'],
      [['a', 'b'], ['a\nb']],
      [
        ['a', 'b', 'c', 'd', 'e', 'f', 'g', '1', '2', '3'],
        ['a\nb', ['c', 'd', 'e\nf\ng'], 1, [2, 3]],
      ],
    ])('should return %p when input is %p', (expected, input) => {
      expect(toTextLines(input)).toEqual(expected)
    })
  })
  describe('validateSizeValue', () => {
    each([
      ['min', 'min'],
      ['max', 'max'],
      ['max', 'foo'],
      ['max', undefined],
    ])('should return %p when input is %p', (expected, input) => {
      expect(validateSizeValue(input)).toEqual(expected)
    })
  })
})
