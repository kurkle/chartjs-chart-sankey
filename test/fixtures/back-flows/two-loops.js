export default {
  "config": {
    "data": {
      "datasets": [
        {
          "colorFrom": "#4e79a7",
          "colorTo": "#f28e2b",
          "data": [
            {
              "from": "Feed",
              "to": "Mix",
              "flow": 50
            },
            {
              "from": "Mix",
              "to": "Reactor",
              "flow": 60
            },
            {
              "from": "Reactor",
              "to": "Separator",
              "flow": 70
            },
            {
              "from": "Separator",
              "to": "Product",
              "flow": 40
            },
            {
              "from": "Separator",
              "to": "Reactor",
              "flow": 20
            },
            {
              "from": "Separator",
              "to": "Mix",
              "flow": 10
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
