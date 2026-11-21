export default {
  "config": {
    "data": {
      "datasets": [
        {
          "colorFrom": "#4e79a7",
          "colorTo": "#f28e2b",
          "data": [
            {
              "from": "Raw",
              "to": "Factory",
              "flow": 60
            },
            {
              "from": "Factory",
              "to": "Product",
              "flow": 70
            },
            {
              "from": "Factory",
              "to": "Waste",
              "flow": 10
            },
            {
              "from": "Product",
              "to": "Use",
              "flow": 70
            },
            {
              "from": "Use",
              "to": "Landfill",
              "flow": 50
            },
            {
              "from": "Use",
              "to": "Factory",
              "flow": 20
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
      "height": 620,
      "width": 340
    },
    "spriteText": true
  }
}
