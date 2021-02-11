//TEST ROGUELIKE VER 0.0.6

class Actor {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.symbol = "?";
    this.color = "red";
    this.speed = 10;
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
    this.color = "#ff0";
  }
  //methods
  act() {
    return new Promise((resolve) => {
      let keypressBind = handleKeypress.bind(this);
      window.addEventListener('keydown', keypressBind);
      function handleKeypress(event) {
        let validInputs = {}
        validInputs[37] = 6;
        validInputs[38] = 0;
        validInputs[39] = 2;
        validInputs[40] = 4;

        if (event.keyCode in validInputs) {
          let currentIndex = model.getIndex(this.x, this.y);
          //Check if desired space is free
          let dir = ROT.DIRS[8][validInputs[event.keyCode]];
          let newX = this.x + dir[0];
          let newY = this.y + dir[1];
          let newIndex = model.getIndex(newX, newY);
          let desiredTile = model.map[newIndex];
          desiredTile.explored = true;
          if (desiredTile.type === "wall") {
            return;
          }

          model.map[currentIndex].occupant = null;
          model.map[newIndex].occupant = this;

          this.x = newX;
          this.y = newY;

          window.removeEventListener('keydown', keypressBind);
          resolve();
        }
      }
    });
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

      this.x = x;
      this.y = y;
    }
  }
}

class Tile {
  occupant = null;
  items = null;
  constructor(type, symbol) {
    this.type = type;
    this.symbol = symbol;
    this.explored = false;
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
          this.map[index] = new Tile("empty", ".");
          freeCells.push(index);
        } else {
          this.map[index] = new Tile("wall", "#");
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
    this.display = new ROT.Display({width:this.width, height:this.height, forceSquareRatio: true});
    document.body.appendChild(this.display.getContainer());
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

  updateDisplay() {
    let camX = this.getCameraX(model.player.x, model.width);
    let camY = this.getCameraY(model.player.y, model.height);

    for (let i = 0; i < model.map.length; i++) {
      let x = (i % model.width) - camX;
      let y = Math.floor(i / model.width) - camY;
      if (model.map[i].explored) {
        this.display.draw(x, y, model.map[i].symbol);
      } else {
        this.display.draw(x, y, 0);
      }

    }
    //Draw player
    this.display.draw(model.player.x - camX, model.player.y - camY,
      model.player.symbol, model.player.color);
    for (let actor of model.actors) {
      this.display.draw(actor.x - camX, actor.y - camY, actor.symbol, actor.color);
    }
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
  view = new View(35, 35);
  view.initialize();
  view.updateDisplay(model);
  engine = new Engine();
  engine.run();
});
