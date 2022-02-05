import {isArray, isNullOrUndef} from 'chart.js/helpers';

/**
 * @param {string | Array<string>} raw
 * @return {Array<string>}
 */
export function toTextLines(raw) {
  const lines = [];
  const inputs = isArray(raw) ? raw : isNullOrUndef(raw) ? [] : [raw];

  while (inputs.length) {
    const input = inputs.pop();
    if (typeof input === 'string') {
      lines.unshift.apply(lines, input.split('\n'));
    } else if (Array.isArray(input)) {
      inputs.push.apply(inputs, input);
    } else if (!isNullOrUndef(inputs)) {
      lines.unshift('' + input);
    }
  }

  return lines;
}

/**
* @param {any} size
* @return {'min' | 'max'}
*/
export function validateSizeValue(size) {
  if (!size || ['min', 'max'].indexOf(size) === -1) {
    return 'max';
  }
  return size;
}
