export default {
  "config": {
    "data": {
      "datasets": [
        {
          "colorFrom": "#4e79a7",
          "colorTo": "#f28e2b",
          "data": [
            {
              "from": "A",
              "to": "B",
              "flow": 20
            },
            {
              "from": "B",
              "to": "B",
              "flow": 10
            },
            {
              "from": "B",
              "to": "C",
              "flow": 20
            }
          ]
        }
      ]
    },
    "type": "sankey"
  },
  "options": {
    "canvas": {
      "height": 340,
      "width": 620
    },
    "spriteText": true
  }
}
