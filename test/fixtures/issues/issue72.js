const data = [
  {
    flow: 23.67,
    from: 'AB',
    to: 'AA',
  },
  {
    flow: 25.33,
    from: 'AB',
    to: 'AC',
  },
  {
    flow: 41,
    from: 'AB',
    to: 'AD',
  },
  {
    flow: 31.33,
    from: 'AB',
    to: 'AE',
  },
  {
    flow: 11.33,
    from: 'AB',
    to: 'AF',
  },
  {
    flow: 15.13,
    from: 'AB',
    to: 'AG',
  },
  {
    flow: 2.67,
    from: 'AB',
    to: 'AH',
  },
  {
    flow: 1.1,
    from: 'AB',
    to: 'AI',
  },
  {
    flow: 8,
    from: 'AB',
    to: 'AJ',
  },
  {
    flow: 18.33,
    from: 'AB',
    to: 'AK',
  },
  {
    flow: 52.33,
    from: 'AB',
    to: 'AC',
  },
  {
    flow: 5.33,
    from: 'AB',
    to: 'AL',
  },
  {
    flow: 16,
    from: 'AB',
    to: 'AM',
  },
  {
    flow: 18.33,
    from: 'AB',
    to: 'AN',
  },
  {
    flow: 16.67,
    from: 'AB',
    to: 'AG',
  },
  {
    flow: 0.67,
    from: 'AB',
    to: 'AN',
  },
  {
    flow: 0.43,
    from: 'AB',
    to: 'AD',
  },
  {
    flow: 1,
    from: 'AB',
    to: 'AH',
  },
  {
    flow: 4,
    from: 'AB',
    to: 'AK',
  },
  {
    flow: 2.47,
    from: 'AB',
    to: 'AJ',
  },
  {
    flow: 48.87,
    from: 'AB',
    to: 'AO',
  },
  {
    flow: 9.13,
    from: 'AB',
    to: 'AG',
  },
  {
    flow: 6,
    from: 'AB',
    to: 'AL',
  },
  {
    flow: 3.13,
    from: 'AB',
    to: 'AJ',
  },
  {
    flow: 22.67,
    from: 'AB',
    to: 'AN',
  },
  {
    flow: 2.53,
    from: 'AB',
    to: 'AG',
  },
  {
    flow: 3.67,
    from: 'AB',
    to: 'AH',
  },
  {
    flow: 41.43,
    from: 'AB',
    to: 'AD',
  },
  {
    flow: 20.33,
    from: 'AB',
    to: 'AE',
  },
  {
    flow: 5.03,
    from: 'AB',
    to: 'AF',
  },
  {
    flow: 52.5,
    from: 'AB',
    to: 'AC',
  },
  {
    flow: 1.7,
    from: 'AB',
    to: 'AP',
  },
  {
    flow: 15.67,
    from: 'AB',
    to: 'AF',
  },
  {
    flow: 6.17,
    from: 'AB',
    to: 'AN',
  },
  {
    flow: 6,
    from: 'AB',
    to: 'AI',
  },
  {
    flow: 17.33,
    from: 'AB',
    to: 'AQ',
  },
  {
    flow: 1.33,
    from: 'AB',
    to: 'AL',
  },
  {
    flow: 2.13,
    from: 'AB',
    to: 'AJ',
  },
  {
    flow: 19.67,
    from: 'AB',
    to: 'AQ',
  },
  {
    flow: 3.33,
    from: 'AB',
    to: 'AD',
  },
  {
    flow: 11.33,
    from: 'AF',
    to: 'AN',
  },
  {
    flow: 4.67,
    from: 'AB',
    to: 'AK',
  },
  {
    flow: 1.67,
    from: 'AF',
    to: 'AK',
  },
  {
    flow: 50.67,
    from: 'AF',
    to: 'AR',
  },
  {
    flow: 1.33,
    from: 'AF',
    to: 'AL',
  },
  {
    flow: 1.13,
    from: 'AF',
    to: 'AJ',
  },
  {
    flow: 7,
    from: 'AF',
    to: 'AS',
  },
  {
    flow: 11.33,
    from: 'AF',
    to: 'AN',
  },
  {
    flow: 54,
    from: 'AB',
    to: 'AT',
  },
  {
    flow: 15.67,
    from: 'AB',
    to: 'AN',
  },
  {
    flow: 4.37,
    from: 'AB',
    to: 'AS',
  },
  {
    flow: 28,
    from: 'AF',
    to: 'AU',
  },
  {
    flow: 13,
    from: 'AF',
    to: 'AV',
  },
  {
    flow: 9.67,
    from: 'AB',
    to: 'AW',
  },
  {
    flow: 3.5,
    from: 'AF',
    to: 'AN',
  },
  {
    flow: 3.67,
    from: 'AF',
    to: 'AH',
  },
  {
    flow: 17.5,
    from: 'AF',
    to: 'AC',
  },
  {
    flow: 21,
    from: 'AF',
    to: 'AA',
  },
  {
    flow: 2.93,
    from: 'AF',
    to: 'AI',
  },
  {
    flow: 4.2,
    from: 'AF',
    to: 'AN',
  },
  {
    flow: 3.77,
    from: 'AF',
    to: 'AI',
  },
  {
    flow: 6.17,
    from: 'AF',
    to: 'AJ',
  },
  {
    flow: 20.6,
    from: 'AF',
    to: 'AQ',
  },
  {
    flow: 2.4,
    from: 'AF',
    to: 'AI',
  },
  {
    flow: 4,
    from: 'AF',
    to: 'AA',
  },
  {
    flow: 7.9,
    from: 'AF',
    to: 'AX',
  },
  {
    flow: 77.93,
    from: 'AF',
    to: 'AD',
  },
  {
    flow: 60.03,
    from: 'AF',
    to: 'AN',
  },
  {
    flow: 50.1,
    from: 'AF',
    to: 'AY',
  },
  {
    flow: 66.77,
    from: 'AF',
    to: 'AZ',
  },
  {
    flow: 7,
    from: 'AF',
    to: 'AQ',
  },
  {
    flow: 73.33,
    from: 'AF',
    to: 'AC',
  },
  {
    flow: 29.67,
    from: 'AF',
    to: 'AN',
  },
  {
    flow: 20.17,
    from: 'AF',
    to: 'AQ',
  },
  {
    flow: 7.17,
    from: 'AF',
    to: 'AI',
  },
  {
    flow: 20,
    from: 'AF',
    to: 'AQ',
  },
  {
    flow: 22.67,
    from: 'AF',
    to: 'AC',
  },
  {
    flow: 7.33,
    from: 'AF',
    to: 'AG',
  },
  {
    flow: 6.33,
    from: 'AF',
    to: 'AD',
  },
  {
    flow: 1.67,
    from: 'AF',
    to: 'AK',
  },
  {
    flow: 14,
    from: 'AF',
    to: 'AQ',
  },
  {
    flow: 0,
    from: 'AF',
    to: 'AA',
  },
  {
    flow: 8,
    from: 'AF',
    to: 'AN',
  },
  {
    flow: 25.33,
    from: 'AF',
    to: 'AN',
  },
  {
    flow: 62,
    from: 'AF',
    to: 'AW',
  },
  {
    flow: 12,
    from: 'AB',
    to: 'AN',
  },
  {
    flow: 4,
    from: 'AB',
    to: 'AO',
  },
  {
    flow: 19,
    from: 'AB',
    to: 'AU',
  },
  {
    flow: 7.67,
    from: 'AB',
    to: 'AG',
  },
  {
    flow: 3.33,
    from: 'AB',
    to: 'BA',
  },
  {
    flow: 1.67,
    from: 'AB',
    to: 'AP',
  },
  {
    flow: 1,
    from: 'AB',
    to: 'AL',
  },
  {
    flow: 1.67,
    from: 'AB',
    to: 'AJ',
  },
  {
    flow: 4,
    from: 'AB',
    to: 'AQ',
  },
  {
    flow: 3.33,
    from: 'AB',
    to: 'AW',
  },
  {
    flow: 3.33,
    from: 'AB',
    to: 'AD',
  },
  {
    flow: 3.33,
    from: 'AB',
    to: 'AT',
  },
  {
    flow: 1,
    from: 'AB',
    to: 'BB',
  },
  {
    flow: 1,
    from: 'AB',
    to: 'AA',
  },
  {
    flow: 1,
    from: 'AB',
    to: 'AK',
  },
  {
    flow: 10,
    from: 'AB',
    to: 'AE',
  },
  {
    flow: 1,
    from: 'AB',
    to: 'AF',
  },
  {
    flow: 3.33,
    from: 'AB',
    to: 'BC',
  },
  {
    flow: 3.33,
    from: 'AB',
    to: 'BD',
  },
  {
    flow: 4.67,
    from: 'AB',
    to: 'BE',
  },
  {
    flow: 3.33,
    from: 'AB',
    to: 'BF',
  },
  {
    flow: 10,
    from: 'AB',
    to: 'AF',
  },
  {
    flow: 1,
    from: 'AB',
    to: 'AV',
  },
  {
    flow: 4,
    from: 'AB',
    to: 'BG',
  },
  {
    flow: 1.67,
    from: 'AB',
    to: 'AH',
  },
  {
    flow: 0.77,
    from: 'AB',
    to: 'BH',
  },
  {
    flow: 50,
    from: 'AF',
    to: 'BI',
  },
  {
    flow: 62,
    from: 'AF',
    to: 'BI',
  },
  {
    flow: 9.67,
    from: 'AF',
    to: 'AB',
  },
  {
    flow: 27,
    from: 'BI',
    to: 'AF',
  },
  {
    flow: 11.33,
    from: 'BI',
    to: 'AF',
  },
  {
    flow: 10.67,
    from: 'BI',
    to: 'AF',
  },
  {
    flow: 7,
    from: 'BK',
    to: 'BJ',
  },
  {
    flow: 2.17,
    from: 'AB',
    to: 'AP',
  },
  {
    flow: 18.93,
    from: 'AB',
    to: 'BL',
  },
  {
    flow: 1.43,
    from: 'AB',
    to: 'AF',
  },
  {
    flow: 3,
    from: 'AB',
    to: 'AO',
  },
  {
    flow: 1,
    from: 'AB',
    to: 'BM',
  },
  {
    flow: 0.6,
    from: 'AB',
    to: 'BN',
  },
  {
    flow: 3.33,
    from: 'AB',
    to: 'BO',
  },
  {
    flow: 0.33,
    from: 'AB',
    to: 'BP',
  },
  {
    flow: 34,
    from: 'AB',
    to: 'AC',
  },
  {
    flow: 20.33,
    from: 'AB',
    to: 'AU',
  },
  {
    flow: 19.67,
    from: 'AB',
    to: 'AN',
  },
  {
    flow: 2.1,
    from: 'AB',
    to: 'BH',
  },
  {
    flow: 1.67,
    from: 'AB',
    to: 'AK',
  },
  {
    flow: 7.33,
    from: 'AB',
    to: 'AP',
  },
  {
    flow: 0.93,
    from: 'AB',
    to: 'BJ',
  },
  {
    flow: 21,
    from: 'AK',
    to: 'AD',
  },
  {
    flow: 5.67,
    from: 'AF',
    to: 'BN',
  },
  {
    flow: 4.67,
    from: 'AF',
    to: 'AP',
  },
  {
    flow: 19.67,
    from: 'AF',
    to: 'AU',
  },
  {
    flow: 4.67,
    from: 'AF',
    to: 'BQ',
  },
  {
    flow: 66.33,
    from: 'BJ',
    to: 'AE',
  },
  {
    flow: 4.67,
    from: 'AF',
    to: 'BR',
  },
  {
    flow: 31.33,
    from: 'AL',
    to: 'AU',
  },
  {
    flow: 36.67,
    from: 'AL',
    to: 'AU',
  },
  {
    flow: 50.37,
    from: 'AL',
    to: 'AO',
  },
  {
    flow: 51.67,
    from: 'AF',
    to: 'BI',
  },
  {
    flow: 13,
    from: 'AD',
    to: 'AN',
  },
  {
    flow: 3.67,
    from: 'AD',
    to: 'AH',
  },
  {
    flow: 29.67,
    from: 'AD',
    to: 'AC',
  },
  {
    flow: 21,
    from: 'AD',
    to: 'AA',
  },
  {
    flow: 4.33,
    from: 'AD',
    to: 'AI',
  },
  {
    flow: 3.5,
    from: 'AD',
    to: 'AN',
  },
  {
    flow: 22.67,
    from: 'AD',
    to: 'AI',
  },
  {
    flow: 17.5,
    from: 'AD',
    to: 'AQ',
  },
  {
    flow: 21,
    from: 'AD',
    to: 'AJ',
  },
  {
    flow: 15.67,
    from: 'AD',
    to: 'AI',
  },
  {
    flow: 5.67,
    from: 'AD',
    to: 'AA',
  },
  {
    flow: 59.33,
    from: 'AD',
    to: 'AX',
  },
  {
    flow: 43.67,
    from: 'AD',
    to: 'AN',
  },
  {
    flow: 52.5,
    from: 'AD',
    to: 'AY',
  },
  {
    flow: 59.33,
    from: 'AD',
    to: 'AZ',
  },
  {
    flow: 12.33,
    from: 'AD',
    to: 'AQ',
  },
  {
    flow: 7,
    from: 'AK',
    to: 'AN',
  },
  {
    flow: 2.33,
    from: 'AD',
    to: 'AB',
  },
  {
    flow: 0.47,
    from: 'AF',
    to: 'AP',
  },
  {
    flow: 9.67,
    from: 'AQ',
    to: 'AG',
  },
  {
    flow: 8.67,
    from: 'AQ',
    to: 'AK',
  },
  {
    flow: 7.67,
    from: 'AQ',
    to: 'AL',
  },
  {
    flow: 15.67,
    from: 'AQ',
    to: 'AJ',
  },
  {
    flow: 22,
    from: 'AQ',
    to: 'AI',
  },
  {
    flow: 2,
    from: 'AQ',
    to: 'AI',
  },
  {
    flow: 12,
    from: 'AQ',
    to: 'AD',
  },
  {
    flow: 4.33,
    from: 'AQ',
    to: 'AA',
  },
  {
    flow: 33.17,
    from: 'AQ',
    to: 'AE',
  },
  {
    flow: 7,
    from: 'AQ',
    to: 'BH',
  },
  {
    flow: 0,
    from: 'AQ',
    to: 'AX',
  },
  {
    flow: 20,
    from: 'AQ',
    to: 'BH',
  },
  {
    flow: 34,
    from: 'AQ',
    to: 'BS',
  },
  {
    flow: 16.67,
    from: 'AQ',
    to: 'BT',
  },
  {
    flow: 34,
    from: 'AQ',
    to: 'AW',
  },
  {
    flow: 7,
    from: 'AK',
    to: 'AJ',
  },
  {
    flow: 31.77,
    from: 'AK',
    to: 'AQ',
  },
  {
    flow: 19,
    from: 'AQ',
    to: 'AT',
  },
  {
    flow: 6.33,
    from: 'AQ',
    to: 'AF',
  },
  {
    flow: 25.33,
    from: 'AQ',
    to: 'BU',
  },
  {
    flow: 25.33,
    from: 'AQ',
    to: 'BV',
  },
  {
    flow: 6.33,
    from: 'AQ',
    to: 'BW',
  },
  {
    flow: 18.33,
    from: 'AQ',
    to: 'AU',
  },
  {
    flow: 2.43,
    from: 'AQ',
    to: 'AU',
  },
  {
    flow: 9.67,
    from: 'AQ',
    to: 'BX',
  },
  {
    flow: 7.67,
    from: 'AQ',
    to: 'BX',
  },
  {
    flow: 21.67,
    from: 'AF',
    to: 'BY',
  },
  {
    flow: 14,
    from: 'AF',
    to: 'BA',
  },
  {
    flow: 6.33,
    from: 'AF',
    to: 'AO',
  },
  {
    flow: 11.33,
    from: 'AI',
    to: 'BJ',
  },
  {
    flow: 6.33,
    from: 'AN',
    to: 'AK',
  },
  {
    flow: 18.33,
    from: 'BK',
    to: 'AB',
  },
  {
    flow: 0.33,
    from: 'AF',
    to: 'AB',
  },
  {
    flow: 39.33,
    from: 'AK',
    to: 'AY',
  },
  {
    flow: 1,
    from: 'AQ',
    to: 'AK',
  },
  {
    flow: 1,
    from: 'AQ',
    to: 'AS',
  },
  {
    flow: 4,
    from: 'AQ',
    to: 'BG',
  },
  {
    flow: 3,
    from: 'AQ',
    to: 'AF',
  },
  {
    flow: 5,
    from: 'AQ',
    to: 'AN',
  },
  {
    flow: 15,
    from: 'AQ',
    to: 'AS',
  },
  {
    flow: 10.33,
    from: 'AQ',
    to: 'AN',
  },
  {
    flow: 21,
    from: 'AK',
    to: 'AQ',
  },
  {
    flow: 68,
    from: 'AN',
    to: 'AE',
  },
  {
    flow: 84.67,
    from: 'AN',
    to: 'AC',
  },
  {
    flow: 33,
    from: 'AN',
    to: 'BZ',
  },
  {
    flow: 57.67,
    from: 'AN',
    to: 'AY',
  },
  {
    flow: 55,
    from: 'AN',
    to: 'AD',
  },
  {
    flow: 52.33,
    from: 'AN',
    to: 'AR',
  },
  {
    flow: 80.33,
    from: 'AN',
    to: 'AZ',
  },
  {
    flow: 8.67,
    from: 'AN',
    to: 'BJ',
  },
  {
    flow: 56.67,
    from: 'AP',
    to: 'AO',
  },
  {
    flow: 6,
    from: 'AP',
    to: 'AB',
  },
  {
    flow: 48,
    from: 'AU',
    to: 'AC',
  },
  {
    flow: 27.17,
    from: 'AU',
    to: 'AQ',
  },
  {
    flow: 3.67,
    from: 'AU',
    to: 'AI',
  },
  {
    flow: 15.67,
    from: 'AU',
    to: 'AN',
  },
  {
    flow: 3.93,
    from: 'AY',
    to: 'BJ',
  },
  {
    flow: 27,
    from: 'BJ',
    to: 'AR',
  },
  {
    flow: 5.17,
    from: 'AB',
    to: 'AP',
  },
  {
    flow: 14.67,
    from: 'AB',
    to: 'AO',
  },
  {
    flow: 12.67,
    from: 'AB',
    to: 'AG',
  },
  {
    flow: 13.33,
    from: 'AB',
    to: 'CA',
  },
  {
    flow: 7.43,
    from: 'AB',
    to: 'AF',
  },
  {
    flow: 1,
    from: 'AB',
    to: 'CB',
  },
  {
    flow: 0.77,
    from: 'AB',
    to: 'CC',
  },
  {
    flow: 2.17,
    from: 'AB',
    to: 'AP',
  },
  {
    flow: 1,
    from: 'AB',
    to: 'CD',
  },
  {
    flow: 1,
    from: 'AB',
    to: 'CE',
  },
  {
    flow: 1,
    from: 'AB',
    to: 'BM',
  },
  {
    flow: 12,
    from: 'AB',
    to: 'AU',
  },
  {
    flow: 1,
    from: 'AB',
    to: 'CF',
  },
  {
    flow: 1,
    from: 'AB',
    to: 'CG',
  },
  {
    flow: 3.1,
    from: 'AB',
    to: 'AF',
  },
  {
    flow: 25.5,
    from: 'AB',
    to: 'AR',
  },
  {
    flow: 1.67,
    from: 'AB',
    to: 'AA',
  },
  {
    flow: 9.67,
    from: 'AG',
    to: 'AF',
  },
  {
    flow: 17.33,
    from: 'AG',
    to: 'AB',
  },
  {
    flow: 59.33,
    from: 'AG',
    to: 'AO',
  },
  {
    flow: 10.33,
    from: 'AG',
    to: 'AP',
  },
  {
    flow: 34,
    from: 'BA',
    to: 'AQ',
  },
  {
    flow: 14,
    from: 'BA',
    to: 'AI',
  },
  {
    flow: 12.03,
    from: 'BA',
    to: 'AN',
  },
  {
    flow: 7.67,
    from: 'BA',
    to: 'BX',
  },
  {
    flow: 3,
    from: 'BA',
    to: 'BK',
  },
  {
    flow: 20.33,
    from: 'BA',
    to: 'AQ',
  },
  {
    flow: 3.67,
    from: 'BA',
    to: 'AL',
  },
  {
    flow: 4.67,
    from: 'BA',
    to: 'AK',
  },
  {
    flow: 8.67,
    from: 'AG',
    to: 'BX',
  },
  {
    flow: 11.33,
    from: 'AG',
    to: 'AN',
  },
  {
    flow: 18.33,
    from: 'AK',
    to: 'BH',
  },
  {
    flow: 6.33,
    from: 'AY',
    to: 'BJ',
  },
  {
    flow: 3,
    from: 'AN',
    to: 'BJ',
  },
  {
    flow: 6,
    from: 'AV',
    to: 'BJ',
  },
  {
    flow: 13,
    from: 'AK',
    to: 'AC',
  },
  {
    flow: 49.67,
    from: 'AG',
    to: 'CH',
  },
  {
    flow: 10.67,
    from: 'AK',
    to: 'AG',
  },
  {
    flow: 25.33,
    from: 'AK',
    to: 'AC',
  },
  {
    flow: 41,
    from: 'AG',
    to: 'CI',
  },
  {
    flow: 4.77,
    from: 'AB',
    to: 'AP',
  },
  {
    flow: 8.77,
    from: 'AB',
    to: 'AF',
  },
  {
    flow: 19.67,
    from: 'AS',
    to: 'AA',
  },
  {
    flow: 8.33,
    from: 'AB',
    to: 'AA',
  },
  {
    flow: 2.33,
    from: 'BJ',
    to: 'AV',
  },
  {
    flow: 7,
    from: 'AV',
    to: 'BJ',
  },
  {
    flow: 4.33,
    from: 'AN',
    to: 'BJ',
  },
  {
    flow: 6.33,
    from: 'AN',
    to: 'AM',
  },
  {
    flow: 5,
    from: 'CJ',
    to: 'BJ',
  },
  {
    flow: 15,
    from: 'AN',
    to: 'AS',
  },
  {
    flow: 50,
    from: 'AN',
    to: 'AQ',
  },
  {
    flow: 9.67,
    from: 'AN',
    to: 'AG',
  },
  {
    flow: 13,
    from: 'AQ',
    to: 'AN',
  },
  {
    flow: 15,
    from: 'AQ',
    to: 'AS',
  },
  {
    flow: 2.1,
    from: 'AQ',
    to: 'AH',
  },
  {
    flow: 9.3,
    from: 'AN',
    to: 'AB',
  },
  {
    flow: 17.33,
    from: 'AN',
    to: 'CK',
  },
  {
    flow: 34,
    from: 'AN',
    to: 'AQ',
  },
  {
    flow: 15.67,
    from: 'AP',
    to: 'AC',
  },
  {
    flow: 12,
    from: 'AP',
    to: 'AU',
  },
  {
    flow: 3,
    from: 'AP',
    to: 'CG',
  },
  {
    flow: 12.67,
    from: 'AP',
    to: 'AN',
  },
  {
    flow: 10.8,
    from: 'CL',
    to: 'AB',
  },
  {
    flow: 23,
    from: 'AB',
    to: 'AP',
  },
  {
    flow: 10.67,
    from: 'CL',
    to: 'AA',
  },
  {
    flow: 13.33,
    from: 'AB',
    to: 'CL',
  },
  {
    flow: 27,
    from: 'AB',
    to: 'AN',
  },
  {
    flow: 13,
    from: 'AB',
    to: 'AI',
  },
  {
    flow: 27,
    from: 'AB',
    to: 'AQ',
  },
  {
    flow: 13.33,
    from: 'AB',
    to: 'CM',
  },
  {
    flow: 17.33,
    from: 'AB',
    to: 'BU',
  },
  {
    flow: 29.67,
    from: 'AB',
    to: 'BV',
  },
  {
    flow: 5.33,
    from: 'AB',
    to: 'AJ',
  },
  {
    flow: 25.33,
    from: 'AB',
    to: 'CK',
  },
  {
    flow: 15,
    from: 'AB',
    to: 'CD',
  },
  {
    flow: 12.33,
    from: 'AB',
    to: 'AJ',
  },
  {
    flow: 15,
    from: 'AB',
    to: 'AD',
  },
  {
    flow: 15.83,
    from: 'AB',
    to: 'AE',
  },
  {
    flow: 9.67,
    from: 'AB',
    to: 'AY',
  },
  {
    flow: 10.67,
    from: 'AB',
    to: 'AX',
  },
  {
    flow: 52.63,
    from: 'AB',
    to: 'AZ',
  },
  {
    flow: 6,
    from: 'AB',
    to: 'BH',
  },
  {
    flow: 16.67,
    from: 'AB',
    to: 'AR',
  },
  {
    flow: 55,
    from: 'AB',
    to: 'AN',
  },
  {
    flow: 15.13,
    from: 'AB',
    to: 'AR',
  },
  {
    flow: 8.67,
    from: 'AB',
    to: 'CN',
  },
  {
    flow: 15.67,
    from: 'AB',
    to: 'AL',
  },
  {
    flow: 13,
    from: 'AB',
    to: 'AF',
  },
  {
    flow: 13,
    from: 'AB',
    to: 'AQ',
  },
  {
    flow: 10.67,
    from: 'AB',
    to: 'BF',
  },
  {
    flow: 11.33,
    from: 'AB',
    to: 'CO',
  },
  {
    flow: 0.7,
    from: 'AB',
    to: 'AJ',
  },
  {
    flow: 6.33,
    from: 'AB',
    to: 'AI',
  },
  {
    flow: 2.33,
    from: 'AB',
    to: 'AA',
  },
  {
    flow: 6.33,
    from: 'AB',
    to: 'BU',
  },
  {
    flow: 2.83,
    from: 'AB',
    to: 'AY',
  },
  {
    flow: 8.67,
    from: 'AB',
    to: 'AC',
  },
  {
    flow: 49.7,
    from: 'AB',
    to: 'AO',
  },
  {
    flow: 32.33,
    from: 'AB',
    to: 'CA',
  },
  {
    flow: 4.1,
    from: 'AB',
    to: 'AP',
  },
  {
    flow: 9,
    from: 'AB',
    to: 'AE',
  },
  {
    flow: 1.67,
    from: 'AB',
    to: 'AA',
  },
  {
    flow: 10.67,
    from: 'AB',
    to: 'AD',
  },
  {
    flow: 13,
    from: 'AB',
    to: 'BH',
  },
  {
    flow: 17.33,
    from: 'AB',
    to: 'CP',
  },
  {
    flow: 3.67,
    from: 'AB',
    to: 'AK',
  },
  {
    flow: 6.33,
    from: 'AB',
    to: 'BJ',
  },
  {
    flow: 48,
    from: 'AB',
    to: 'AR',
  },
  {
    flow: 8,
    from: 'AB',
    to: 'AM',
  },
  {
    flow: 7.7,
    from: 'AB',
    to: 'AC',
  },
  {
    flow: 3.67,
    from: 'AB',
    to: 'BK',
  },
  {
    flow: 11.33,
    from: 'AB',
    to: 'AA',
  },
  {
    flow: 7,
    from: 'AB',
    to: 'BH',
  },
  {
    flow: 3.93,
    from: 'AB',
    to: 'BJ',
  },
  {
    flow: 5.33,
    from: 'AB',
    to: 'AJ',
  },
  {
    flow: 70.67,
    from: 'AB',
    to: 'AQ',
  },
  {
    flow: 5.33,
    from: 'AB',
    to: 'AK',
  },
  {
    flow: 21.43,
    from: 'AB',
    to: 'AN',
  },
  {
    flow: 41,
    from: 'AB',
    to: 'AR',
  },
  {
    flow: 7,
    from: 'AB',
    to: 'AJ',
  },
  {
    flow: 51.5,
    from: 'AB',
    to: 'AQ',
  },
  {
    flow: 15.67,
    from: 'AB',
    to: 'CK',
  },
  {
    flow: 10.5,
    from: 'AB',
    to: 'AN',
  },
  {
    flow: 5.67,
    from: 'AB',
    to: 'BK',
  },
  {
    flow: 30.8,
    from: 'AB',
    to: 'AD',
  },
  {
    flow: 15.97,
    from: 'AB',
    to: 'AE',
  },
  {
    flow: 62,
    from: 'AB',
    to: 'BH',
  },
  {
    flow: 37.1,
    from: 'AB',
    to: 'AN',
  },
  {
    flow: 62,
    from: 'AB',
    to: 'CQ',
  },
  {
    flow: 21.33,
    from: 'AB',
    to: 'AA',
  },
  {
    flow: 18.33,
    from: 'AB',
    to: 'AG',
  },
  {
    flow: 70.67,
    from: 'AB',
    to: 'AQ',
  },
  {
    flow: 7,
    from: 'AB',
    to: 'AL',
  },
  {
    flow: 4.67,
    from: 'AB',
    to: 'BJ',
  },
  {
    flow: 73.33,
    from: 'AB',
    to: 'AR',
  },
  {
    flow: 21.67,
    from: 'AB',
    to: 'AY',
  },
  {
    flow: 6.37,
    from: 'AB',
    to: 'AH',
  },
  {
    flow: 27,
    from: 'AB',
    to: 'AE',
  },
  {
    flow: 16.8,
    from: 'AB',
    to: 'AC',
  },
  {
    flow: 11.33,
    from: 'AB',
    to: 'AX',
  },
  {
    flow: 3.67,
    from: 'AB',
    to: 'AA',
  },
  {
    flow: 3,
    from: 'AB',
    to: 'AK',
  },
  {
    flow: 79.33,
    from: 'AB',
    to: 'AZ',
  },
  {
    flow: 7,
    from: 'AF',
    to: 'AA',
  },
  {
    flow: 6.9,
    from: 'AF',
    to: 'AH',
  },
  {
    flow: 4.33,
    from: 'AF',
    to: 'AA',
  },
  {
    flow: 2.83,
    from: 'AF',
    to: 'AH',
  },
  {
    flow: 10.8,
    from: 'AF',
    to: 'AD',
  },
  {
    flow: 20.43,
    from: 'AF',
    to: 'AY',
  },
  {
    flow: 1.73,
    from: 'AF',
    to: 'AX',
  },
  {
    flow: 53.63,
    from: 'AF',
    to: 'AZ',
  },
  {
    flow: 27,
    from: 'AF',
    to: 'AC',
  },
  {
    flow: 8.97,
    from: 'AF',
    to: 'AN',
  },
  {
    flow: 8.57,
    from: 'AF',
    to: 'AG',
  },
  {
    flow: 9.27,
    from: 'AF',
    to: 'AN',
  },
  {
    flow: 7.9,
    from: 'AF',
    to: 'AX',
  },
  {
    flow: 7,
    from: 'AF',
    to: 'AA',
  },
  {
    flow: 14,
    from: 'AF',
    to: 'CQ',
  },
  {
    flow: 27,
    from: 'AF',
    to: 'AR',
  },
  {
    flow: 9,
    from: 'AF',
    to: 'AL',
  },
  {
    flow: 21,
    from: 'AF',
    to: 'AC',
  },
  {
    flow: 15,
    from: 'AF',
    to: 'AG',
  },
  {
    flow: 6.33,
    from: 'AF',
    to: 'AB',
  },
  {
    flow: 11.8,
    from: 'AF',
    to: 'AN',
  },
  {
    flow: 23.67,
    from: 'AF',
    to: 'BU',
  },
  {
    flow: 1.67,
    from: 'AF',
    to: 'AN',
  },
  {
    flow: 3.13,
    from: 'AF',
    to: 'AG',
  },
  {
    flow: 2,
    from: 'AF',
    to: 'AP',
  },
  {
    flow: 7.33,
    from: 'AF',
    to: 'AJ',
  },
  {
    flow: 3.67,
    from: 'AF',
    to: 'AI',
  },
  {
    flow: 10.8,
    from: 'AF',
    to: 'AR',
  },
  {
    flow: 53.33,
    from: 'AF',
    to: 'AQ',
  },
  {
    flow: 10.33,
    from: 'AF',
    to: 'AA',
  },
  {
    flow: 15.67,
    from: 'AF',
    to: 'AV',
  },
  {
    flow: 13.43,
    from: 'AF',
    to: 'AU',
  },
  {
    flow: 6.33,
    from: 'AF',
    to: 'BJ',
  },
  {
    flow: 5,
    from: 'AF',
    to: 'AN',
  },
  {
    flow: 4.77,
    from: 'AF',
    to: 'AO',
  },
  {
    flow: 7.67,
    from: 'AF',
    to: 'AG',
  },
  {
    flow: 3.33,
    from: 'AF',
    to: 'BA',
  },
  {
    flow: 2.33,
    from: 'AF',
    to: 'AP',
  },
  {
    flow: 1,
    from: 'AF',
    to: 'CN',
  },
  {
    flow: 1,
    from: 'AF',
    to: 'AL',
  },
  {
    flow: 1,
    from: 'AF',
    to: 'AJ',
  },
  {
    flow: 1,
    from: 'AF',
    to: 'AM',
  },
  {
    flow: 14.33,
    from: 'AF',
    to: 'AE',
  },
  {
    flow: 4,
    from: 'AF',
    to: 'AQ',
  },
  {
    flow: 3.03,
    from: 'AF',
    to: 'AD',
  },
  {
    flow: 6.33,
    from: 'AF',
    to: 'AC',
  },
  {
    flow: 1.67,
    from: 'AF',
    to: 'CR',
  },
  {
    flow: 1,
    from: 'AF',
    to: 'CP',
  },
  {
    flow: 4.67,
    from: 'AF',
    to: 'AR',
  },
  {
    flow: 1,
    from: 'AF',
    to: 'AA',
  },
  {
    flow: 1,
    from: 'AF',
    to: 'AI',
  },
  {
    flow: 1.67,
    from: 'AF',
    to: 'BJ',
  },
  {
    flow: 1.67,
    from: 'AF',
    to: 'BH',
  },
  {
    flow: 1,
    from: 'AF',
    to: 'AK',
  },
  {
    flow: 1.67,
    from: 'AF',
    to: 'BN',
  },
  {
    flow: 2.33,
    from: 'AF',
    to: 'CO',
  },
  {
    flow: 14,
    from: 'AF',
    to: 'AI',
  },
  {
    flow: 14,
    from: 'AF',
    to: 'AK',
  },
  {
    flow: 9.37,
    from: 'AF',
    to: 'AC',
  },
  {
    flow: 22.67,
    from: 'AF',
    to: 'AN',
  },
  {
    flow: 23.67,
    from: 'AF',
    to: 'BU',
  },
  {
    flow: 9.67,
    from: 'AF',
    to: 'AL',
  },
  {
    flow: 22.67,
    from: 'AF',
    to: 'AR',
  },
  {
    flow: 7,
    from: 'AF',
    to: 'BA',
  },
  {
    flow: 8.67,
    from: 'AF',
    to: 'AQ',
  },
  {
    flow: 6,
    from: 'AF',
    to: 'BK',
  },
  {
    flow: 16.67,
    from: 'AF',
    to: 'AG',
  },
  {
    flow: 13,
    from: 'AF',
    to: 'AY',
  },
  {
    flow: 41,
    from: 'AF',
    to: 'CO',
  },
  {
    flow: 16.67,
    from: 'AF',
    to: 'CP',
  },
  {
    flow: 14,
    from: 'AF',
    to: 'BH',
  },
  {
    flow: 52.33,
    from: 'AF',
    to: 'AB',
  },
  {
    flow: 13,
    from: 'AB',
    to: 'AF',
  },
  {
    flow: 12.47,
    from: 'AF',
    to: 'AN',
  },
  {
    flow: 23.8,
    from: 'AF',
    to: 'AR',
  },
  {
    flow: 11.6,
    from: 'AF',
    to: 'BH',
  },
  {
    flow: 4.33,
    from: 'AF',
    to: 'AJ',
  },
  {
    flow: 5.63,
    from: 'AF',
    to: 'AI',
  },
  {
    flow: 10.67,
    from: 'AF',
    to: 'AK',
  },
  {
    flow: 9.13,
    from: 'AF',
    to: 'AB',
  },
  {
    flow: 21,
    from: 'AF',
    to: 'CK',
  },
  {
    flow: 9.57,
    from: 'AF',
    to: 'AX',
  },
  {
    flow: 9.67,
    from: 'AF',
    to: 'BK',
  },
  {
    flow: 14,
    from: 'AF',
    to: 'AC',
  },
  {
    flow: 35.67,
    from: 'AB',
    to: 'BX',
  },
  {
    flow: 27,
    from: 'BX',
    to: 'BH',
  },
  {
    flow: 56.67,
    from: 'BX',
    to: 'CQ',
  },
  {
    flow: 1.67,
    from: 'AB',
    to: 'CC',
  },
  {
    flow: 0.33,
    from: 'AB',
    to: 'AP',
  },
  {
    flow: 1,
    from: 'AB',
    to: 'CD',
  },
  {
    flow: 33.33,
    from: 'AB',
    to: 'BL',
  },
  {
    flow: 3,
    from: 'AB',
    to: 'AF',
  },
  {
    flow: 0.67,
    from: 'AB',
    to: 'AV',
  },
  {
    flow: 4,
    from: 'AB',
    to: 'BN',
  },
  {
    flow: 34.33,
    from: 'AB',
    to: 'AE',
  },
  {
    flow: 68,
    from: 'AB',
    to: 'AR',
  },
  {
    flow: 7.67,
    from: 'AB',
    to: 'AI',
  },
  {
    flow: 10,
    from: 'AB',
    to: 'AQ',
  },
  {
    flow: 1,
    from: 'AB',
    to: 'AA',
  },
  {
    flow: 3,
    from: 'AB',
    to: 'BH',
  },
  {
    flow: 1.67,
    from: 'AB',
    to: 'AK',
  },
  {
    flow: 7,
    from: 'AB',
    to: 'CO',
  },
  {
    flow: 4,
    from: 'AB',
    to: 'BJ',
  },
  {
    flow: 31.67,
    from: 'AB',
    to: 'BG',
  },
  {
    flow: 19.67,
    from: 'AB',
    to: 'AG',
  },
  {
    flow: 27,
    from: 'AB',
    to: 'AC',
  },
  {
    flow: 9,
    from: 'AB',
    to: 'AD',
  },
  {
    flow: 3.33,
    from: 'AB',
    to: 'AL',
  },
  {
    flow: 10.67,
    from: 'AG',
    to: 'CS',
  },
  {
    flow: 2.33,
    from: 'AG',
    to: 'AF',
  },
  {
    flow: 5.67,
    from: 'AG',
    to: 'AN',
  },
  {
    flow: 6.33,
    from: 'AG',
    to: 'CT',
  },
  {
    flow: 1.67,
    from: 'AG',
    to: 'BJ',
  },
  {
    flow: 4.33,
    from: 'AB',
    to: 'CU',
  },
  {
    flow: 4.67,
    from: 'AN',
    to: 'CJ',
  },
  {
    flow: 19.9,
    from: 'AL',
    to: 'AN',
  },
  {
    flow: 59.33,
    from: 'AL',
    to: 'AX',
  },
  {
    flow: 43.67,
    from: 'AL',
    to: 'AR',
  },
  {
    flow: 7,
    from: 'CJ',
    to: 'BJ',
  },
  {
    flow: 12.33,
    from: 'AK',
    to: 'AI',
  },
  {
    flow: 0,
    from: 'AK',
    to: 'AC',
  },
  {
    flow: 8,
    from: 'AC',
    to: 'AI',
  },
  {
    flow: 11.33,
    from: 'AC',
    to: 'BJ',
  },
  {
    flow: 5.93,
    from: 'AE',
    to: 'AX',
  },
  {
    flow: 13.6,
    from: 'AE',
    to: 'AN',
  },
  {
    flow: 11.33,
    from: 'AM',
    to: 'AL',
  },
  {
    flow: 34,
    from: 'AA',
    to: 'AE',
  },
  {
    flow: 3.67,
    from: 'CR',
    to: 'AJ',
  },
  {
    flow: 6,
    from: 'CR',
    to: 'CN',
  },
  {
    flow: 4.67,
    from: 'AK',
    to: 'BJ',
  },
  {
    flow: 1,
    from: 'AQ',
    to: 'CP',
  },
  {
    flow: 1,
    from: 'AQ',
    to: 'AA',
  },
  {
    flow: 1,
    from: 'AQ',
    to: 'AN',
  },
  {
    flow: 1.67,
    from: 'AQ',
    to: 'AK',
  },
  {
    flow: 5,
    from: 'AQ',
    to: 'AU',
  },
  {
    flow: 2.33,
    from: 'AQ',
    to: 'AI',
  },
  {
    flow: 1,
    from: 'AQ',
    to: 'AS',
  },
  {
    flow: 1,
    from: 'AQ',
    to: 'BK',
  },
  {
    flow: 20.33,
    from: 'AQ',
    to: 'BF',
  },
  {
    flow: 32.33,
    from: 'AQ',
    to: 'AR',
  },
  {
    flow: 6,
    from: 'AQ',
    to: 'AK',
  },
  {
    flow: 34,
    from: 'AQ',
    to: 'AN',
  },
  {
    flow: 4.2,
    from: 'AQ',
    to: 'AB',
  },
  {
    flow: 17.33,
    from: 'AQ',
    to: 'CK',
  },
  {
    flow: 9.67,
    from: 'AQ',
    to: 'BJ',
  },
  {
    flow: 7,
    from: 'AQ',
    to: 'AI',
  },
  {
    flow: 7,
    from: 'AQ',
    to: 'BK',
  },
  {
    flow: 9.67,
    from: 'AQ',
    to: 'AJ',
  },
  {
    flow: 4.33,
    from: 'AQ',
    to: 'AA',
  },
  {
    flow: 29.67,
    from: 'AQ',
    to: 'AG',
  },
  {
    flow: 63.67,
    from: 'AQ',
    to: 'AH',
  },
  {
    flow: 66.33,
    from: 'AQ',
    to: 'AN',
  },
  {
    flow: 29.67,
    from: 'AQ',
    to: 'BH',
  },
  {
    flow: 18.77,
    from: 'AQ',
    to: 'AN',
  },
  {
    flow: 3,
    from: 'BJ',
    to: 'CJ',
  },
  {
    flow: 5,
    from: 'BJ',
    to: 'AU',
  },
  {
    flow: 2.33,
    from: 'BJ',
    to: 'AV',
  },
  {
    flow: 1.67,
    from: 'BJ',
    to: 'CV',
  },
  {
    flow: 6,
    from: 'BJ',
    to: 'AA',
  },
  {
    flow: 8,
    from: 'BJ',
    to: 'AF',
  },
  {
    flow: 7,
    from: 'AU',
    to: 'AA',
  },
  {
    flow: 1.1,
    from: 'AA',
    to: 'AU',
  },
  {
    flow: 1.67,
    from: 'AA',
    to: 'BJ',
  },
  {
    flow: 5.67,
    from: 'AA',
    to: 'AF',
  },
  {
    flow: 0.77,
    from: 'AA',
    to: 'CV',
  },
  {
    flow: 4,
    from: 'AA',
    to: 'CW',
  },
  {
    flow: 2.33,
    from: 'AA',
    to: 'AP',
  },
  {
    flow: 4.67,
    from: 'AA',
    to: 'CX',
  },
  {
    flow: 3,
    from: 'AA',
    to: 'BG',
  },
  {
    flow: 5.33,
    from: 'AA',
    to: 'CY',
  },
  {
    flow: 0.83,
    from: 'AA',
    to: 'AV',
  },
  {
    flow: 4,
    from: 'AA',
    to: 'AQ',
  },
  {
    flow: 7,
    from: 'AV',
    to: 'AA',
  },
  {
    flow: 4.33,
    from: 'CV',
    to: 'AA',
  },
  {
    flow: 7.27,
    from: 'CV',
    to: 'AF',
  },
  {
    flow: 6.33,
    from: 'AP',
    to: 'AF',
  },
  {
    flow: 8,
    from: 'BJ',
    to: 'AM',
  },
  {
    flow: 10.33,
    from: 'BJ',
    to: 'AI',
  },
  {
    flow: 13.33,
    from: 'BJ',
    to: 'CM',
  },
  {
    flow: 62,
    from: 'AN',
    to: 'AQ',
  },
  {
    flow: 56,
    from: 'AN',
    to: 'BV',
  },
  {
    flow: 6.33,
    from: 'AN',
    to: 'BK',
  },
  {
    flow: 16.67,
    from: 'AN',
    to: 'AB',
  },
  {
    flow: 22.67,
    from: 'AN',
    to: 'BA',
  },
  {
    flow: 70.67,
    from: 'AN',
    to: 'AB',
  },
  {
    flow: 10.33,
    from: 'AN',
    to: 'BJ',
  },
  {
    flow: 25.33,
    from: 'AN',
    to: 'CK',
  },
  {
    flow: 5.33,
    from: 'AN',
    to: 'AK',
  },
  {
    flow: 23.67,
    from: 'AN',
    to: 'AL',
  },
  {
    flow: 7.67,
    from: 'AN',
    to: 'AA',
  },
  {
    flow: 3,
    from: 'AN',
    to: 'AK',
  },
  {
    flow: 3.1,
    from: 'AN',
    to: 'CK',
  },
  {
    flow: 3.83,
    from: 'AN',
    to: 'AB',
  },
  {
    flow: 53.33,
    from: 'AN',
    to: 'AQ',
  },
  {
    flow: 5.5,
    from: 'AN',
    to: 'AL',
  },
  {
    flow: 6.03,
    from: 'BK',
    to: 'AB',
  },
  {
    flow: 15.67,
    from: 'BK',
    to: 'BA',
  },
  {
    flow: 29.67,
    from: 'AK',
    to: 'AC',
  },
  {
    flow: 5.47,
    from: 'AK',
    to: 'AD',
  },
  {
    flow: 27,
    from: 'AK',
    to: 'AE',
  },
  {
    flow: 4,
    from: 'AG',
    to: 'AO',
  },
  {
    flow: 0.67,
    from: 'AG',
    to: 'AU',
  },
  {
    flow: 1,
    from: 'AG',
    to: 'BK',
  },
  {
    flow: 4,
    from: 'AG',
    to: 'AQ',
  },
  {
    flow: 3.33,
    from: 'AG',
    to: 'AD',
  },
  {
    flow: 15,
    from: 'AG',
    to: 'AC',
  },
  {
    flow: 1,
    from: 'AG',
    to: 'AV',
  },
  {
    flow: 1,
    from: 'AG',
    to: 'AA',
  },
  {
    flow: 1.67,
    from: 'AG',
    to: 'AI',
  },
  {
    flow: 1.67,
    from: 'AG',
    to: 'AK',
  },
  {
    flow: 1,
    from: 'AG',
    to: 'CP',
  },
  {
    flow: 1.67,
    from: 'AG',
    to: 'AF',
  },
  {
    flow: 15.67,
    from: 'AK',
    to: 'BF',
  },
  {
    flow: 13,
    from: 'AK',
    to: 'CO',
  },
  {
    flow: 50,
    from: 'BJ',
    to: 'AA',
  },
  {
    flow: 4.67,
    from: 'AA',
    to: 'BJ',
  },
  {
    flow: 27,
    from: 'AL',
    to: 'AO',
  },
  {
    flow: 7.67,
    from: 'CS',
    to: 'AG',
  },
  {
    flow: 21,
    from: 'CZ',
    to: 'AY',
  },
  {
    flow: 48,
    from: 'AE',
    to: 'AD',
  },
]

module.exports = {
  config: {
    data: {
      datasets: [
        {
          colorFrom: 'blue',
          colorTo: 'green',
          data,
        },
      ],
    },
    type: 'sankey',
  },
  options: {
    canvas: {
      height: 1024,
      width: 1024,
    },
    spriteText: true,
  },
  threshold: 0.15,
  tolerance: 0.015,
}
