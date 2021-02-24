//TEST ROGUELIKE VER 0.2.7

class Actor {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.sprite = "?";
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
    this.sprite = "player";
    this.maxOxygen = 750;
    this.oxygen = 750;
    this.maxEnergy = 250;
    this.energy = 250;
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
        } else if (event.keyCode === 13) /*Enter key*/ {
          let currentIndex = this.x + model.width * this.y;
          if (model.map[currentIndex].type === "shipDoor") {
            view.notify("You enter the ship...");
            model.loadLocation(shipMenu);
          }
        }

      }
    });
  }

  attemptMove(dir) {
    let newX = this.x + dir[0];
    let newY = this.y + dir[1];

    let currentIndex = this.x + model.width * this.y;
    let newIndex = newX + model.width * newY;
    let currentTile = model.map[currentIndex];
    let newTile = model.map[newIndex];

    if (newTile.type === "wall") {
      return false;
    } else if (newTile.occupant) {
      return false;
    } else if (newTile.type === "shipDoor") {
      view.notify("Press Enter to board ship.");
    } else if (newTile.type === "navigation") {
      view.notify("Naivigation: Press Enter to set course.");
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
    this.sprite = "crab";
    this.speed = 5;
  }
  act() {
    let path = this.getPathTo(model.player.x, model.player.y);
    path.shift(); /* remove position of actor */
    if (path.length <= 1) {
      view.notify("Aculeate Carcinid says: Tag, you're it!");
    } else {
      let x = path[0][0];
      let y = path[0][1];

      let currentTile = model.map[this.x + model.width * this.y]
      let newTile = model.map[x + model.width * y]

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
  constructor(x, y, type, sprite, lucent) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.sprite = sprite;
    this.explored = false;
    this.translucent = lucent;
  }
}

class Location {
  constructor(height, width) {
    this.height = height;
    this.width = width;
    this.map = [];
    this.revealed = false;
    this.actors = [];
    this.landingIndex = [0];
    this.tileset = "./images/tiles_greymoon.png";
  }
}

class Model {
  constructor() {
    this.height = 100;
    this.width = 100;
    this.map = [];
    this.revealed = false;
    this.actors = [];
    this.player = new Player(0, 0);
  }

  loadLocation(location) {
    this.height = location.height;
    this.width = location.width;
    this.map = location.map;
    this.revealed = location.revealed;
    this.actors = location.actors;
    this.landingIndex = location.landingIndex;

    this.map[this.landingIndex].occupant = this.player;
    this.player.x = this.landingIndex % this.width;
    this.player.y = Math.floor(this.landingIndex/this.width);

    if (engine) { engine.reset(); }
    if (view) {
      view.setTiles(location.tileset, location.tilemap);
      view.updateDisplay();
    }
  }
}


class LocationGenerator {
  constructor(height, width, type) {
    this.height = height;
    this.width = width;
    this.type = type;
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
  createActor(type, location, freeIndexes) {
    let index = freeIndexes[Math.floor(ROT.RNG.getUniform() * freeIndexes.length)];
    let actor = new type(this.getX(index), this.getY(index));
    location.map[index].occupant = actor;
    if (type === Player) {
      model.player = actor;
    } else {
      location.actors.push(actor);
    }
    return actor;
  }

  //There is currently no way to see or interact with items
  generateItems(numItems, item, location, availableCells) {
    for (let i = 0; i < numItems; i++) {
      let index = Math.floor(ROT.RNG.getUniform() * availableCells.length);
      location.map[index].items.push(item);
    }
  }

  placeShip(location, availableCells) {
    location.landingIndex = availableCells[Math.floor(ROT.RNG.getUniform() * availableCells.length)];
    let doorX = this.getX(location.landingIndex);
    let doorY = this.getY(location.landingIndex);

    location.map[location.landingIndex] = new Tile(doorX, doorY, "shipDoor", "shipDoor", true); //Door
    location.map[location.landingIndex - 1] = new Tile(doorX - 1, doorY, "wall", "shipLowLeft", true); //lowleft
    location.map[location.landingIndex + 1] = new Tile(doorX + 1, doorY, "wall", "shipLowRight", true); //lowright
    location.map[this.getIndex(doorX - 1, doorY - 1)] = new Tile(doorX - 1, doorY - 1, "wall", "shipUpLeft", false); //upleft
    location.map[this.getIndex(doorX, doorY - 1)] = new Tile(doorX, doorY - 1, "wall", "shipUpMid", false); //upmid
    location.map[this.getIndex(doorX + 1, doorY - 1)] = new Tile(doorX + 1, doorY - 1, "wall", "shipUpRight", false); //upright
  }

  generateTestLocation() {
    let testLocation = new Location(this.height, this.width);

    let digger = new ROT.Map.Digger(this.height, this.width);
    let freeCells = [];
    let digCallback = function(x, y, value) {
        let index = this.getIndex(x, y);
        // We have an empty space
        if (value === 0) {
          testLocation.map[index] = new Tile(x, y, "floor", "floor", true);
          freeCells.push(index);
        } else {
          testLocation.map[index] = new Tile(x, y, "wall", "wall", false);
        }
    }
    digger.create(digCallback.bind(this));

    this.placeShip(testLocation, freeCells);

    //this.generateStars(10, freeCells);
    this.createActor(Crab, testLocation, freeCells);
    this.createActor(Crab, testLocation, freeCells);

    testLocation.tileset = "./images/tiles_greymoon.png";
    testLocation.tilemap = {
      "player": [0, 0],
      "floor": [0, 16],
      "wall": [64, 16],
      "shipUpLeft": [0, 32], "shipUpMid": [16, 32], "shipUpRight": [32, 32],
      "shipLowLeft": [0, 48], "shipDoor": [16, 48], "shipLowRight": [32, 48],
      "stars": [64, 64],
      "crab": [0, 64],
    }
    return testLocation;
  }

  createFromString(string, h, w) {
    let location = new Location(h, w);
    for (let i = 0; i < string.length; i++) {
      let x = i % w;
      let y = Math.floor(i/w);

      switch (string[i]) {
        case "*":
          location.map[i] = new Tile(x, y, "space", "stars", true);
          break;
        case "#":
          location.map[i] = new Tile(x, y, "wall", "wall", true);
          break;
        case ".":
          location.map[i] = new Tile(x, y, "floor", "floor", true);
          break;
        case "^":
          location.map[i] = new Tile(x, y, "wall", "wall", true);
          break;
        case "|":
          location.map[i] = new Tile(x, y, "wall", "wall", true);
          break;
        case "v":
          location.map[i] = new Tile(x, y, "wall", "wall", true);
          break;
        case "~":
          location.map[i] = new Tile(x, y, "navigation", "floor", true);
          break;
        case "=":
          location.map[i] = new Tile(x, y, "wall", "computer", true);
          break;
        case "@":
          location.landingIndex = i;
          location.map[i] = new Tile(x, y, "floor", "floor", true);
          break;
        default:
          alert(string[i]);
      }
    }
    return location;
  }
}

class View {
  constructor(height, width) {
    this.height = height;
    this.width = width;
    this.tileSet = document.createElement("img");
    this.notifications = ["Welcome message."];
  }

  initialize() {
    this.statsDisplay = new ROT.Display({width:18, height:35});
    document.body.appendChild(this.statsDisplay.getContainer());

    this.setTiles("./images/tiles_greymoon.png", {
        "player": [0, 0],
        "floor": [0, 16],
        "wall": [64, 16],
        "shipUpLeft": [0, 32], "shipUpMid": [16, 32], "shipUpRight": [32, 32],
        "shipLowLeft": [0, 48], "shipDoor": [16, 48], "shipLowRight": [32, 48],
        "stars": [64, 64],
        "crab": [0, 64],
    });

    this.fov = new ROT.FOV.PreciseShadowcasting(this.lightPasses);

    this.textDisplay = new ROT.Display({width:74, height:7});
    document.body.appendChild(this.textDisplay.getContainer());
    this.notify("Use WASD to move.");

    this.updateDisplay();
  }

  notify(text) {
    this.textDisplay.clear();
    if (this.notifications.length > 2) { this.notifications.shift(); }
    this.notifications.push(text);
    for (let i = 0; i < this.notifications.length; i++) {
      this.textDisplay.drawText(1, (i * 2) + 1, this.notifications[i]);
    }
  }

  setTiles(tilesetSource, tileMappings) {
    this.tileSet.src = tilesetSource;
    let options = {
        layout: "tile",
        bg: "transparent",
        tileWidth: 16,
        tileHeight: 16,
        tileSet: this.tileSet,
        tileMap: tileMappings,
        tileColorize: true,
        width: this.width,
        height: this.height,
    }

    this.mapDisplay = new ROT.Display(options);
    document.body.appendChild(this.mapDisplay.getContainer());
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
    let tile = model.map[x + model.width * y];
    if (tile) {
      return tile.translucent;
    } else {
      return false;
    }
  }

  updateMapDisplay() {
    let camX = this.getCameraX(model.player.x, model.width);
    let camY = this.getCameraY(model.player.y, model.height);
    if (model.revealed === false) {
      let fovTiles = [];

      /* output callback */
      view.fov.compute(model.player.x, model.player.y, model.player.los, function(x, y, r, visibility) {
          fovTiles.push(model.map[x + model.width * y]);
      });

      for (let i = 0; i < model.map.length; i++) {
        let x = model.map[i].x - camX;
        let y = model.map[i].y - camY;
        if (model.map[i].explored) {
          this.mapDisplay.draw(x, y, model.map[i].sprite, "rgba(20, 20, 20, 0.7)");
        } else {
          this.mapDisplay.draw(x, y, 0);
        }

      }
      //Draw all visible tiles and actors
      for (let tile of fovTiles) {
        tile.explored = true;
        this.mapDisplay.draw(tile.x - camX, tile.y - camY, tile.sprite, "transparent");
        let actor = tile.occupant;
        if (actor) {
          this.mapDisplay.draw(actor.x - camX, actor.y - camY, [tile.sprite, actor.sprite], "rgba(20, 20, 20, 0.1)");
          //drawing as transparent makes it have the fog of war shading for some reason
          //so here we draw with a small shadow
        }
      }
    } else {
      for (let i = 0; i < model.map.length; i++) {
        let x = model.map[i].x - camX;
        let y = model.map[i].y - camY;
        this.mapDisplay.draw(x, y, model.map[i].sprite, "transparent");
        let actor = model.map[i].occupant;
        if (actor) {
          this.mapDisplay.draw(actor.x - camX, actor.y - camY, [model.map[i].sprite, actor.sprite], "rgba(20, 20, 20, 0.1)");
        }
      }
    }

  }
  updateStatsDisplay() {
    this.statsDisplay.clear();
    this.statsDisplay.drawText(1, 1, "Oxygen:");
    this.statsDisplay.drawText(1, 2, model.player.oxygen + "/" + model.player.maxOxygen);

    this.statsDisplay.drawText(1, 4, "Energy:");
    this.statsDisplay.drawText(1, 5, model.player.energy + "/" + model.player.maxEnergy);

    //model.player
  }

  updateDisplay() {
    this.updateMapDisplay();
    this.updateStatsDisplay();
  }
}

class Engine {
  constructor() {
    this.go = true;
    this.scheduler = new ROT.Scheduler.Speed();
    if (model.player) { this.scheduler.add(model.player, true); }
    for (let actor of model.actors) {
      this.scheduler.add(actor, true);
    }
  }

  reset() {
    this.go = false;
    this.scheduler = new ROT.Scheduler.Speed();
    if (model.player) { this.scheduler.add(model.player, true); }
    for (let actor of model.actors) {
      this.scheduler.add(actor, true);
    }
    this.go = true;
  }

  async run() {
    while (this.go) {
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
let generator = new LocationGenerator(100, 100);
let shipString =
"*************************" +
"*************************" +
"**********#####**********" +
"*********#.....#*********" +
"****^***#.......#***^****" +
"****|***#.......#***|****" +
"****||*#...===...#*||****" +
"****||*#..#~~~#..#*||****" +
"****||#...........#||****" +
"****||#...........#||****" +
"****||#...........#||****" +
"****||####.....####||****" +
"****||#...........#||****" +
"****||#.....@.....#||****" +
"****||#...........#||****" +
"****||####.....####||****" +
"****||#...........#||****" +
"****||#...........#||****" +
"****||#...........#||****" +
"****||#...#####...#||****" +
"****||#..#*****#..#||****" +
"****||###*******###||****" +
"****||#|*********|#||****" +
"****v||v*********v||v****" +
"****|**|*********|**|****" +
"*************************" +
"*************************";

let shipMenu = generator.createFromString(shipString, 27, 25);
shipMenu.revealed = true;
shipMenu.tileset = "./images/tiles_ship.png";
shipMenu.tilemap = {
  "player": [0, 0],
  "floor": [0, 16],
  "stars": [48, 16],
  "wall": [64, 16],
  "computer": [0, 64],
}

window.addEventListener("load", function() {
  model = new Model(100, 100);
  model.loadLocation(generator.generateTestLocation());
  view = new View(35, 45);
  view.initialize();
  view.updateDisplay(model);
  engine = new Engine();
  engine.run();
});
