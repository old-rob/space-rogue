//TEST ROGUELIKE VER 0.1.9

class Actor {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.symbol = "?";
    //this.color = "red";
    this.speed = 10;
    this.los = 3;
  }
  //methods
  getSpeed() {
    return this.speed;
  }
  getPathTo(x, y) {
    let passableCallback = function(x, y) {
      let terrain = model.map[x + model.width * y].type;
      if (terrain === "wall") {
        return false;
      } else {
        return true;
      }
    }
    let astar = new ROT.Path.AStar(x, y, passableCallback, {topology:4});

    let path = [];
    //////////////////////////
    let pathCallback = function(x, y) {
      path.push([x, y]);
    }
    astar.compute(this.x, this.y, pathCallback);
    return path;
  }
  act() {
    alert("Actor is acting");
    //return new Promise(resolve => alert("I'm an actor without acting instructions..."));
  }
}

class Player extends Actor {
  constructor(x, y) {
    super(x, y);
    this.symbol = "@";
    //this.color = "#ff0";
    this.maxOxygen = 1000;
    this.oxygen = 1000;
  }
  //methods
  act() {
    return new Promise((resolve) => {
      let keypressBind = handleKeypress.bind(this);
      window.addEventListener('keydown', keypressBind);
      function handleKeypress(event) {
        let movementInputs = {}
        movementInputs[65] = 6; //a - 37 is leftKey
        movementInputs[87] = 0; //w - 38 is upKey
        movementInputs[68] = 2; //d - 39 is rightKey
        movementInputs[83] = 4; //s - 40 is downKey

        if (event.keyCode in movementInputs) {
          //Check if desired space is free
          let dir = ROT.DIRS[8][movementInputs[event.keyCode]];
          if (this.attemptMove(dir)) {
            this.oxygen -= 1;
            window.removeEventListener('keydown', keypressBind);
            resolve();
          }
          return;
        }
      }
    });
  }

  attemptMove(dir) {
    let newX = this.x + dir[0];
    let newY = this.y + dir[1];

    let currentIndex = model.getIndex(this.x, this.y);
    let newIndex = model.getIndex(newX, newY);
    let currentTile = model.map[currentIndex];
    let newTile = model.map[newIndex];

    if (newTile.type === "wall") {
      return false;
    } else if (newTile.occupant) {
      return false;
    }

    currentTile.occupant = null;
    newTile.occupant = this;

    this.x = newX;
    this.y = newY;

    return true;
  }
}

class Crab extends Actor {
  constructor(x, y) {
    super(x, y);
    this.symbol = "C";
    this.speed = 5;
  }
  act() {
    let path = this.getPathTo(model.player.x, model.player.y);
    path.shift(); /* remove position of actor */
    if (path.length <= 1) {
      alert("Tag, you're it!");
    } else {
      let x = path[0][0];
      let y = path[0][1];

      let currentTile = model.map[model.getIndex(this.x, this.y)]
      let newTile = model.map[model.getIndex(x, y)]

      if (newTile.occupant) {
        return;
      } else {
        currentTile.occupant = null;
        newTile.occupant = this;
        this.x = x;
        this.y = y;
      }
    }
  }
}

class Tile {
  occupant = null;
  items = null;
  constructor(x, y, type, symbol, lucent) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.symbol = symbol;
    this.explored = false;
    this.translucent = lucent;
  }
}

class Model {
  constructor(height, width) {
    this.height = height;
    this.width = width;
    this.map = [];
    this.actors = [];
    this.player = null;
  }

  getIndex(x, y) {
    return x + this.width * y;
  }
  getX(index) {
    return index % this.width;
  }
  getY(index) {
    return Math.floor(index/this.width);
  }
  getTileAt(x, y) {
    return this.map[x + this.width * y];
  }

  // [21, 22, 44, 46, 47]
  createActor(type, freeIndexs) {
    let index = freeIndexs[Math.floor(ROT.RNG.getUniform() * freeIndexs.length)];
    let actor = new type(this.getX(index), this.getY(index));
    this.map[index].occupant = actor;
    if (type === Player) {
      this.player = actor;
    } else {
      this.actors.push(actor);
    }
    return actor;
  }

  /*
  generateStars(numStars, availableCells) {
    for (let i = 0; i < numStars; i++) {
      let index = Math.floor(ROT.RNG.getUniform() * availableCells.length);
      let key = availableCells.splice(index, 1)[0];
      this.map[key] = "*";
    }
  }
  */

  generateDugMap() {
    let digger = new ROT.Map.Digger(this.height, this.width);
    let freeCells = [];
    let digCallback = function(x, y, value) {
        let index = this.getIndex(x, y);
        // We have an empty space
        if (value === 0) {
          this.map[index] = new Tile(x, y, "empty", ".", true);
          freeCells.push(index);
        } else {
          this.map[index] = new Tile(x, y, "wall", "#", false);
        }
    }
    digger.create(digCallback.bind(this));

    //this.generateStars(10, freeCells);
    this.createActor(Player, freeCells);
    this.createActor(Crab, freeCells);
    this.createActor(Crab, freeCells);
  }

}

class View {
  constructor(height, width) {
    this.height = height;
    this.width = width;
  }

  initialize() {
    this.statsDisplay = new ROT.Display({width:18, height:35});
    document.body.appendChild(this.statsDisplay.getContainer());

    let tileSet = document.createElement("img");
    tileSet.src = "./images/tiles_greymoon.png";

    let options = {
        layout: "tile",
        bg: "transparent",
        tileWidth: 16,
        tileHeight: 16,
        tileSet: tileSet,
        tileMap: {
            "@": [0, 0],
            ".": [0, 16],
            "#": [64, 16],
            "C": [0, 48],
        },
        tileColorize: true,
        width: this.width,
        height: this.height,
    }

    this.mapDisplay = new ROT.Display(options);
    //this.mapDisplay = new ROT.Display({width:this.width, height:this.height, forceSquareRatio: true});
    document.body.appendChild(this.mapDisplay.getContainer());
    this.fov = new ROT.FOV.PreciseShadowcasting(this.lightPasses);

    this.textDisplay = new ROT.Display({width:74, height:5});
    document.body.appendChild(this.textDisplay.getContainer());
    this.textDisplay.drawText(1, 1, "Welcome to the Cosmos, use WASD to move.", 56);
  }

  getCameraPos(playerPos, viewSize, mapSize) {
    let halfView = viewSize / 2;
    if (playerPos < halfView) {
      return 0;
    } else if (playerPos >= mapSize - halfView) {
      return mapSize - viewSize;
    } else {
      return playerPos - halfView;
    }
  }
  getCameraX(playerX, mapSize) {
    let halfView = this.width / 2;
    if (playerX < halfView) {
      return 0;
    } else if (playerX >= mapSize - halfView) {
      return mapSize - this.width;
    } else {
      return playerX - halfView;
    }
  }
  getCameraY(playerY, mapSize) {
    let halfView = this.height / 2;
    if (playerY < halfView) {
      return 0;
    } else if (playerY >= mapSize - halfView) {
      return mapSize - this.height;
    } else {
      return playerY - halfView;
    }
  }

  /* FOV input callback */
  lightPasses(x, y) {
    let tile = model.getTileAt(x, y);
    if (tile) {
      return tile.translucent;
    } else {
      return false;
    }
  }

  updateMapDisplay() {
    let camX = this.getCameraX(model.player.x, model.width);
    let camY = this.getCameraY(model.player.y, model.height);
    let fovTiles = [];

    /* output callback */
    view.fov.compute(model.player.x, model.player.y, model.player.los, function(x, y, r, visibility) {
        fovTiles.push(model.map[model.getIndex(x, y)]);
    });

    for (let i = 0; i < model.map.length; i++) {
      let x = model.map[i].x - camX;
      let y = model.map[i].y - camY;
      if (model.map[i].explored) {
        this.mapDisplay.draw(x, y, model.map[i].symbol, "rgba(20, 20, 20, 0.7)");
      } else {
        this.mapDisplay.draw(x, y, 0);
      }

    }
    //Draw all visible tiles and actors
    for (let tile of fovTiles) {
      tile.explored = true;
      this.mapDisplay.draw(tile.x - camX, tile.y - camY, tile.symbol, "transparent");
      let actor = tile.occupant;
      if (actor) {
        this.mapDisplay.draw(actor.x - camX, actor.y - camY, [tile.symbol, actor.symbol], "rgba(20, 20, 20, 0.1)");
        //drawing as transparent makes it have the fog of war shading for some reason
        //so here we draw with a small shadow
      }
    }
  }
  updateStatsDisplay() {
    this.statsDisplay.clear();
    this.statsDisplay.drawText(1, 1, "Oxygen:");
    this.statsDisplay.drawText(1, 2, model.player.oxygen + "/" + model.player.maxOxygen);

    this.statsDisplay.drawText(1, 4, "Oxygen:");
    this.statsDisplay.drawText(1, 5, model.player.oxygen + "/" + model.player.maxOxygen);

    //model.player
  }

  updateDisplay() {
    this.updateMapDisplay();
    this.updateStatsDisplay();
  }
}

class Engine {
  constructor() {
    this.scheduler = new ROT.Scheduler.Speed();
    if (model.player) { this.scheduler.add(model.player, true); }
    for (let actor of model.actors) {
      this.scheduler.add(actor, true);
    }
  }

  async run() {
    while (true) {
      let actor = this.scheduler.next();
      if (!actor) { break; }
      await actor.act(model);
      view.updateDisplay(model);
    }
  }
}

let model = null;
let view = null;
let engine = null;

window.addEventListener("load", function() {
  model = new Model(100, 100);
  model.generateDugMap();
  view = new View(35, 45);
  view.initialize();
  view.updateDisplay(model);
  engine = new Engine();
  engine.run();
});
