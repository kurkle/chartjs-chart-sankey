export default {
  "config": {
    "data": {
      "datasets": [
        {
          "colorFrom": "#4e79a7",
          "colorTo": "#f28e2b",
          "data": [
            {
              "from": "a",
              "to": "b",
              "flow": 10
            },
            {
              "from": "b",
              "to": "c",
              "flow": 10
            },
            {
              "from": "c",
              "to": "a",
              "flow": 10
            }
          ],
          "orientation": "vertical"
        }
      ]
    },
    "type": "sankey"
  },
  "options": {
    "canvas": {
      "height": 400,
      "width": 720
    },
    "spriteText": true
  }
}
