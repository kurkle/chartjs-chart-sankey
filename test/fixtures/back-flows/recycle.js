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
