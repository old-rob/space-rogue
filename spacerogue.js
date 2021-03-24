//TEST ROGUELIKE VER 0.3.0

class Actor {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.name = "Actor Interface";
    this.sprite = "?";
    this.speed = 10;
    this.los = 3;
    this.maxEnergy = 100;
    this.energy = 100;
    this.maxHealth = 100;
    this.health = 100;
    this.weapon = null;
    this.drops = [new Item("Raw Crystal", "crystal", "material")];
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
  attack(target) {
    if (!this.weapon) { return false; }
    if (this.weapon.currentCharge >= this.weapon.chargeCost
        && this.energy >= this.weapon.useCost) {
      this.weapon.currentCharge -= this.weapon.chargeCost;
      this.energy -= this.weapon.useCost;

      if (target) {
        let damage = this.weapon.getDamage();
        target.health -= damage;
        view.notify(this.name + " hits for " + damage + " damage!");

        if (target.health <= 0) {
          target.die();
        }
      }

      return true;
    } else {
      view.notify("The " + this.name + " looks exhausted.");
    }
  }
  act() {
    alert("Actor is acting");
    //return new Promise(resolve => alert("I'm an actor without acting instructions..."));
  }

  die() {
    let spot = model.getTileAt(this.x, this.y);
    spot.occupant = null;
    engine.scheduler.remove(this);
    //add to list of slain creatures here
    spot.items = this.drops;
  }
}

class Player extends Actor {
  constructor(x, y) {
    super(x, y);
    this.name = "You";
    this.sprite = "player";
    this.maxOxygen = 750;
    this.oxygen = 750;
    this.maxEnergy = 100;
    this.energy = 100;
    this.inventory = {};
    this.weapon = null;
    this.reticle = {
      isActive: false,
      x: 0,
      y: 0,
    }
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

        if (event.keyCode === 75) /*K key for now, this needs to be customizable*/ {
          if (!this.weapon) {
            view.notify("You don't have any weapon equipped.");
            return;
          }
          this.reticle.isActive = !this.reticle.isActive;
          this.reticle.x = this.x;
          this.reticle.y = this.y;
          view.updateDisplay();
        }
        if (this.reticle.isActive) {
          if (this.aim(event)) {
            this.breathe(model.atmosphere);
            window.removeEventListener('keydown', keypressBind);
            resolve();
          }
        } else {
          if (event.keyCode in movementInputs) {
            //Check if desired space is free
            let dir = ROT.DIRS[8][movementInputs[event.keyCode]];
            if (this.attemptMove(dir)) {
              this.breathe(model.atmosphere);
              window.removeEventListener('keydown', keypressBind);
              resolve();
            }
            return;
          } else if (event.keyCode === 13) /*Enter key*/ {
            let currentIndex = this.x + model.width * this.y;
            let currentTile = model.map[currentIndex];
            if (currentTile.special) {
              currentTile.actionTrigger();
            }

            if (currentTile.items.length > 0) {
              for (let item of currentTile.items) {
                this.collect(item);
              }
              currentTile.items = [];
            }
            view.updateDisplay();
          }
        }

      }
    });
  }

  attack(target) {
    if (this.weapon.currentCharge >= this.weapon.chargeCost
        && this.energy >= this.weapon.useCost) {
      this.weapon.currentCharge -= this.weapon.chargeCost;
      this.energy -= this.weapon.useCost;

      if (target) {
        let damage = this.weapon.getDamage();
        target.health -= damage;
        view.notify("You hit for " + damage + " damage! ("
          + target.health + "/" + target.maxHealth + ")");

        if (target.health <= 0) {
          target.die();
        }
      }

      return true;
    } else {
      view.notify("Your weapon does not have enough charge!")
    }
  }

  aim(event) {
    let newX = this.reticle.x;
    let newY = this.reticle.y;
    if (event.keyCode === 13) /*Enter key*/ {
      this.reticle.isActive = false;
      ///Actually have the attack happen here!
      let target = model.getTileAt(newX, newY).occupant;
      if (this.attack(target)) {
        return true;
      } else {
        return false;
      }

      //then take away energy and apply damage segun equipped weapon
      return true;
    } else if (event.keyCode === 65) /*A key*/ {
      newX = this.reticle.x - 1;
    } else if (event.keyCode === 87) /*W key*/ {
      newY = this.reticle.y - 1;
    } else if (event.keyCode === 68) /*D key*/ {
      newX = this.reticle.x + 1;
    } else if (event.keyCode === 83) /*S key*/ {
      newY = this.reticle.y + 1;
    }
    //This needs to be changed to use fov not path
    let shotPath = this.getPathTo(newX, newY);
    if (shotPath.length - 1 > this.weapon.range) {
      view.notify("Your weapon can't reach there.");
      return false;
    }
    this.reticle.x = newX;
    this.reticle.y = newY;
    view.updateDisplay();
    return false;
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
    } else if (newTile.special) {
      newTile.stepTrigger();
    }

    currentTile.occupant = null;
    newTile.occupant = this;

    this.x = newX;
    this.y = newY;

    return true;
  }

  warp() {
    let currentIndex = this.x + model.width * this.y;
    view.notify("The only planet in range is a desolate moon. You've no choice but to search it and hope for the best.");
    model.map[currentIndex].occupant = null;
    model.loadLocation(generator.generateTestLocation());
    view.updateDisplay();
  }

  breathe(atmosphere) {
    if (atmosphere === "inert" || atmosphere === "toxic" || atmosphere === "none") {
      if (this.oxygen >= 1) {
        this.oxygen -= 1;
      } else {
        this.health -= 1;
        //put suffocation code here?
      }
    }
  }

  collect(item) {
    if (this.inventory[item]) {
      this.inventory[item] += 1;
    } else {
      this.inventory[item] = 1;
    }
  }
  equip(weapon) {
    if (this.weapon) {
      this.unequip();
    }
    this.weapon = weapon;
  }
  unequip() {
    this.inventory[this.weapon.name] ? this.inventory[this.weapon.name] += 1 : this.inventory[this.weapon.name] = 1;
    this.weapon = null;
  }
}

class Crab extends Actor {
  constructor(x, y) {
    super(x, y);
    this.name = "Aculeate Carcinid";
    this.sprite = "crab";
    this.speed = 5;
    this.maxHealth = 25;
    this.health = 25;
    this.weapon = new Weapon("Crystal Claw", "claw", "melee", 1, 0, 0, 0, 0, 5);
  }
  act() {
    let path = this.getPathTo(model.player.x, model.player.y);
    path.shift(); /* remove position of actor */
    if (path.length === 0) {
      return;
    } else if (path.length === 1) {
      let target = model.getTileAt(path[0][0], path[0][1]).occupant;
      this.attack(target);
    } else {
      let x = path[0][0];
      let y = path[0][1];

      let currentTile = model.map[this.x + model.width * this.y];
      let newTile = model.map[x + model.width * y];

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

class Item {
  constructor(name, sprite, type) {
    this.name = name;
    this.sprite = sprite;
    this.type = type;
  }
}

class Weapon extends Item {
  constructor(name, sprite, type, range, useCost, chargeCost, maxCharge, minDamage, maxDamage) {
    super(name, sprite, type);
    this.range = range;
    this.useCost = useCost;
    this.chargeCost = chargeCost;
    this.currentCharge = 0;
    this.maxCharge = maxCharge;
    this.minDamage = minDamage;
    this.maxDamage = maxDamage;
  }

  getDamage() {
    return this.getIntBetween(this.minDamage, this.maxDamage);
  }

  //this needs a better home
  //random int from min to max, both included
  getIntBetween(min, max) {
    return Math.floor(ROT.RNG.getUniform() * (max - min + 1) ) + min;
  }
}

class Tile {
  occupant = null;
  constructor(x, y, type, sprite, lucent) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.sprite = sprite;
    this.explored = false;
    this.translucent = lucent;
    this.items = [];
    this.special = false;
    //set special to true and add triggers for special tiles
    //actionTrigger()
    //stepTrigger()
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
    this.atmosphere = "safe";

    let wrench = new Weapon("Wrench", "wrench", "melee", 1, 0, 0, 0, 3, 7);
    let revolver = new Weapon("Revolver", "gun", "pistol", 5, 0, 25, 6, 5, 20);
    let blaster = new Weapon("Blaster", "gun", "pistol", 5, 5, 0, 0, 5, 20);

    this.player.equip(blaster);
  }

  loadLocation(location) {
    this.height = location.height;
    this.width = location.width;
    this.map = location.map;
    this.revealed = location.revealed;
    this.actors = location.actors;
    this.landingIndex = location.landingIndex;
    this.atmosphere = location.atmosphere;

    this.map[this.landingIndex].occupant = this.player;
    this.player.x = this.landingIndex % this.width;
    this.player.y = Math.floor(this.landingIndex/this.width);

    if (engine) { engine.reset(); }
    if (view) {
      view.setTiles(location.tileset, location.tilemap);
      view.updateDisplay();
    }
  }

  getTileAt(x, y) {
    return this.map[x + this.width * y];
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
    let doorTile = new Tile(doorX, doorY, "shipDoor", "shipDoor", true);
    doorTile.special = true;
    doorTile.actionTrigger = () => {
      view.notify("You enter the ship...");
      model.loadLocation(shipMenu);
    };
    doorTile.stepTrigger = () => {
      view.notify("Press Enter to board ship.");
    };

    location.map[location.landingIndex] = doorTile; //Door
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

    let rooms = digger.getRooms();
    let roomCenters = [];
    for (let room of rooms) {
      let center = room.getCenter();
      roomCenters.push(this.getIndex(center[0], center[1]));
    }

    this.placeShip(testLocation, roomCenters);

    //this.generateStars(10, freeCells);
    this.createActor(Crab, testLocation, freeCells);
    this.createActor(Crab, testLocation, freeCells);
    this.createActor(Crab, testLocation, freeCells);
    this.createActor(Crab, testLocation, freeCells);
    this.createActor(Crab, testLocation, freeCells);

    testLocation.atmosphere = "none";
    testLocation.tileset = "./images/tiles_greymoon.png";
    testLocation.tilemap = {
      "player": [0, 0],
      "floor": [0, 16],
      "wall": [64, 16],
      "shipUpLeft": [0, 32], "shipUpMid": [16, 32], "shipUpRight": [32, 32],
      "shipLowLeft": [0, 48], "shipDoor": [16, 48], "shipLowRight": [32, 48],
      "stars": [64, 64],
      "crystal": [64, 64],
      "crab": [0, 64],
    }
    return testLocation;
  }

  createFromString(string, h, w) {
    let location = new Location(h, w);
    for (let i = 0; i < string.length; i++) {
      let x = i % w;
      let y = Math.floor(i/w);
      let tile;

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
        case "N": //Navigation
          tile = new Tile(x, y, "navigation", "floor", true);
          tile.special = true;
          tile.actionTrigger = () => {
            model.player.warp();
          };
          tile.stepTrigger = () => {
            view.notify("Naivigation: Press Enter to set course.");
          };
          location.map[i] = tile;
          break;
        case "O": //Oxygen Tanks
          tile = new Tile(x, y, "charging", "floor", true);
          tile.special = true;
          tile.actionTrigger = () => {
            model.player.oxygen = model.player.maxOxygen;
          };
          tile.stepTrigger = () => {
            view.notify("Oxygen: Press Enter to refill tanks.");
          };
          location.map[i] = tile;
          break;
        case "B": //Batteries
          tile = new Tile(x, y, "charging", "floor", true);
          tile.special = true;
          tile.actionTrigger = () => {
            model.player.energy = model.player.maxEnergy;
          };
          tile.stepTrigger = () => {
            view.notify("Charging Station: Press Enter to switch batteries.");
          };
          location.map[i] = tile;
          break;
        case "M": //Medical
          tile = new Tile(x, y, "charging", "floor", true);
          tile.special = true;
          tile.actionTrigger = () => {
            model.player.health = model.player.maxHealth;
          };
          tile.stepTrigger = () => {
            view.notify("Medical Assistant: Press Enter to recieve care.");
          };
          location.map[i] = tile;
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
    this.statsWindow = document.getElementById("stats_window");
    this.mainWindow = document.getElementById("main_window");
    this.textWindow = document.getElementById("text_window");
  }

  initialize() {
    this.statsDisplay = new ROT.Display({width:18, height:35});
    //document.body.appendChild(this.statsDisplay.getContainer());
    this.statsWindow.appendChild(this.statsDisplay.getContainer());

    this.setTiles("./images/tiles_greymoon.png", {
        "player": [0, 0],
        "floor": [0, 16],
        "wall": [64, 16],
        "shipUpLeft": [0, 32], "shipUpMid": [16, 32], "shipUpRight": [32, 32],
        "shipLowLeft": [0, 48], "shipDoor": [16, 48], "shipLowRight": [32, 48],
        "stars": [64, 64],
        "crystal": [64, 64],
        "crab": [0, 64],
    });

    this.fov = new ROT.FOV.PreciseShadowcasting(this.lightPasses);

    this.textDisplay = new ROT.Display({width:74, height:7});
    //document.body.appendChild(this.textDisplay.getContainer());
    this.textWindow.appendChild(this.textDisplay.getContainer());
    this.notify("Use WASD to move, Press K to attack");

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
    while (this.mainWindow.hasChildNodes()) {
      this.mainWindow.removeChild(this.mainWindow.firstChild);
    }
    //this.mainWindow.appendChild(this.mapDisplay.getContainer());
    //this.mainWindow.appendChild(elt("div", {class: "game"}, this.mapDisplay.getContainer());
    this.mainWindow.appendChild(elt("div", {style: "display:inline-block; position:absolute; width:100%; left:20%"}, this.mapDisplay.getContainer()));
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
        let shader = "transparent";
        let sprites = [tile.sprite];

        if (tile.items.length > 0) {
          sprites.push(tile.items[0].sprite);
          shader = "rgba(20, 20, 20, 0.1)";
        }
        if (tile.occupant) {
          sprites.push(tile.occupant.sprite);
          shader = "rgba(20, 20, 20, 0.1)";
        }
        if (model.player.reticle.isActive && model.player.reticle.x === tile.x && model.player.reticle.y === tile.y) {
          shader = "rgba(120, 20, 20, 0.3)";
        }

        this.mapDisplay.draw(tile.x - camX, tile.y - camY, sprites, shader);
      }
    } else /*Revealed map*/ {
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

    this.statsDisplay.drawText(1, 7, "Health:");
    this.statsDisplay.drawText(1, 8, model.player.health + "/" + model.player.maxHealth);

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
"****||*#..#NNN#..#*||****" +
"****||#...........#||****" +
"****||#...........#||****" +
"****||#...........#||****" +
"****||#===.....####||****" +
"****||#MBO........#||****" +
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

//elt("div", {class: "game"}, drawGrid(level));
function elt(type, attrs, ...children) {
  let dom = document.createElement(type);
  if (attrs) {
    for (let attr of Object.keys(attrs)) {
      dom.setAttribute(attr, attrs[attr]);
    }
  }
  for (let child of children) {
    if (typeof child != "string") dom.appendChild(child);
    else dom.appendChild(document.createTextNode(child));
  }
  return dom;
}

let shipMenu = generator.createFromString(shipString, 27, 25);
shipMenu.revealed = true;
shipMenu.atmosphere = "safe";
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
