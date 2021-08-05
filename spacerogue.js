//TEST ROGUELIKE VER 0.3.4

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
    this.fov = new ROT.FOV.PreciseShadowcasting(this.lightPasses, {topology:4});
    this.intent = "rest";
  }
  //methods
  //Speed getter for turn order determination
  getSpeed() {
    return this.speed;
  }
  //Passability callback for pathfinding
  //Can be overwritten to allow flight etc.
  canTraverse(x, y) {
    let terrain = model.map[x + model.width * y].type;
    if (terrain === "wall") {
      return false;
    } else {
      return true;
    }
  }
  getPathTo(x, y) {
    let passableCallback = this.canTraverse;
    let astar = new ROT.Path.AStar(x, y, passableCallback, {topology:4});
    let path = [];
    //////////////////////////
    let pathCallback = function(x, y) {
      path.push([x, y]);
    }
    astar.compute(this.x, this.y, pathCallback);
    return path;
  }
  attemptMove(dir) {
    let newX = this.x + dir[0];
    let newY = this.y + dir[1];

    let currentIndex = this.x + model.width * this.y;
    let newIndex = newX + model.width * newY;
    let currentTile = model.map[currentIndex];
    let newTile = model.map[newIndex];

    if (!this.canTraverse(newX, newY)) {
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
    if (this.intent === "rest") {
      this.actionRest();
    } else if (this.intent === "wander") {
      this.actionWander();
    }
  }

  die() {
    let spot = model.getTileAt(this.x, this.y);
    spot.occupant = null;
    engine.scheduler.remove(this);
    //TODO
    //add to list of slain creatures here
    //ALSO MAKE IT SO ITEMS CAN STACK, CURRENTLY DOESN'T WORK
    spot.items = this.drops;
  }

  //Methods for the action depending on what "mood" the actor is in
  //These are defaults, but of course they can be overridden for different personalities
  actionRest() {
    return;
  }
  actionWander() {
    while (true) {
      let dir = ROT.DIRS[8][ROT.RNG.getItem([0, 2, 4, 6])];
      if (this.attemptMove(dir)) {
        return;
      }
    }
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
    this.warpSelect = false;
    this.warpChoices = [];
    this.selection = 0;
  }
  //methods
  act() {
    return new Promise((resolve) => {
      let keypressBind = handleKeypress.bind(this);
      window.addEventListener('keydown', keypressBind);
      function handleKeypress(event) {
        if (this.warpSelect) {
          //makeSelection returns true when a decision has been made
          if ( this.makeSelection(event) ) {
            this.warp();
            this.warpSelect = false;
            view.updateDisplay(model);
          }
          window.removeEventListener('keydown', keypressBind);
          resolve();
        } else {
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
      return true;
    }
    //Or if we want to move the reticle
    else if (event.keyCode === 65) /*A key*/ {
      newX = this.reticle.x - 1;
    } else if (event.keyCode === 87) /*W key*/ {
      newY = this.reticle.y - 1;
    } else if (event.keyCode === 68) /*D key*/ {
      newX = this.reticle.x + 1;
    } else if (event.keyCode === 83) /*S key*/ {
      newY = this.reticle.y + 1;
    }
    //It would be more efficient to calculate beforehand
    //Then you might also be able to display the entire reachable area
    let tilesInRange = []
    this.weapon.inRange.compute(this.x, this.y, this.weapon.range, function(x, y, r, visibility) {
          tilesInRange.push(model.map[x + model.width * y]);
    });
    //If the desired tile is not in range for the current weapon
    if ( !tilesInRange.includes(model.map[newX + model.width * newY]) ) {
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

  initWarp() {
    this.selection = 0;
    //Select a new location
    //Randomly make 2-4 choices
    let choices = []
    //TODO REPLACE WITH DIFFERENT SCENARIOS
    choices[0] = generator.generateTestLocation();
    choices[1] = generator.generateMoonCrater();
    choices[2] = generator.generateTestLocation();
    choices[1].type = "Moon"
    choices[2].type = "Planet"

    this.warpChoices = choices;
    this.warpSelect = true;

    view.notify("Initiating warp drive. Please select destination, then press Enter.");

    /*
    //Warp process pseudocode
    when Warp
    with a random chance choose one of the following categories

    You see a moon with a few interesting locations on it
      //generate 2-3 moon maps
      // display is round moon display
      // set choice highlight zones
    You see a gas giant with several interesting looking moons
      //generate 2-3 moon maps
      //display is gas giant
    You come across an asteroid belt with objects that look suitable to land on
      //generate 2-3 asteroid maps, and occasionally add a satelite map
    You find a sun with several planets oribiting it nearby
      //generate 2-3 planet maps
    */

  }

  warp() {
    //Remove self from previous map
    let currentIndex = this.x + model.width * this.y;
    model.map[currentIndex].occupant = null;

    model.loadLocation(this.warpChoices[this.selection])
    view.notify("The only planet in range is a desolate moon. You've no choice but to search it and hope for the best.");

    setTimeout(view.updateDisplay.bind(view), 500);
  }

  makeSelection(event) {
    let choices = this.warpChoices;
    if (event.keyCode === 13) /*Enter key*/ {
      return true;
    } else if (event.keyCode === 65) /*A key*/ {
      this.selection > 0 ? this.selection -= 1 : this.selection = choices.length - 1;
    } else if (event.keyCode === 87) /*W key*/ {
      this.selection < choices.length - 1 ? this.selection += 1 : this.selection = 0;
    } else if (event.keyCode === 68) /*D key*/ {
      this.selection < choices.length - 1 ? this.selection += 1 : this.selection = 0;
    } else if (event.keyCode === 83) /*S key*/ {
      this.selection > 0 ? this.selection -= 1 : this.selection = choices.length - 1;
    }
    view.displayWarpChoice(choices[this.selection]);
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
    if (this.inventory[item.name]) {
      this.inventory[item.name] += 1;
    } else {
      this.inventory[item.name] = 1;
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
  die() {
    view.notify("You Died");
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

class Pilbug extends Actor {
  constructor(x, y) {
    super(x, y);
    this.name = "Pilbug";
    this.sprite = "pil";
    this.speed = 8;
    this.maxHealth = 25;
    this.health = 25;
    this.weapon = new Weapon("Crystal Claw", "claw", "melee", 1, 0, 0, 0, 0, 5);
  }
  act() {
    this.actionWander();
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
    this.inRange = new ROT.FOV.PreciseShadowcasting(this.lightPasses);
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

  /* FOV input callback */
  lightPasses(x, y) {
    let tile = model.map[x + model.width * y];
    if (tile) {
      //FEEL FREE TO MAKE A NEW TILE ATTR
      //  if there is something you can see but not shoot through
      return tile.translucent;
    } else {
      return false;
    }
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

    //Generation information (for warp decisions)
    this.type = "Moon";
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
      //TODO: REMOVE INDEX FROM availableCells AND RETURN IT SO WE KNOW NOT TO PUT SOMETHING ELSE THERE --------------------------------------------------------- TODO ANNOYING LONG LINE
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

    //Add some explored empty spaces to reduce chance of being trapped
    let exitSpace = new Tile(doorX, doorY + 1, "floor", "floor", true);
    exitSpace.explored = true;
    location.map[this.getIndex(doorX, doorY + 1)] = exitSpace;
  }

  generateTestLocation() {
    let testLocation = new Location(this.height, this.width);

    //Add information for warp decisions
    testLocation.type = "Test"

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

  generateMoonCrater() {
    let loc = new Location(this.height, this.width);

    //Add information for warp decisions
    loc.type = "Moon Crater"

    let mapper = new ROT.Map.Cellular(this.width, this.height, {
        born: [4, 5, 6, 7, 8],
        survive: [2, 3, 4, 5]
    });

    let freeCells = [];
    let mapCallback = function(x, y, value) {
        let index = this.getIndex(x, y);
        // We have an empty space
        if (value === 0) {
          loc.map[index] = new Tile(x, y, "floor", "floor", true);
          freeCells.push(index);
        } else {
          loc.map[index] = new Tile(x, y, "wall", "wall", false);
        }
    }
    mapper.randomize(0.9);
    for (var i=48; i>=0; i--) {
      mapper.create();
    }
    mapper.create(mapCallback.bind(this));

    //let rooms = digger.getRooms();
    //let roomCenters = [];
    //for (let room of rooms) {
    //  let center = room.getCenter();
    //  roomCenters.push(this.getIndex(center[0], center[1]));
    //}

    this.placeShip(loc, [550,750,1250]);

    //this.generateStars(10, freeCells);
    this.createActor(Crab, loc, freeCells);
    this.createActor(Crab, loc, freeCells);
    this.createActor(Pilbug, loc, freeCells);
    this.createActor(Pilbug, loc, freeCells);
    this.createActor(Pilbug, loc, freeCells);
    this.createActor(Pilbug, loc, freeCells);
    this.createActor(Pilbug, loc, freeCells);

    loc.atmosphere = "none";
    loc.tileset = "./images/tiles_greymoon.png";
    loc.tilemap = {
      "player": [0, 0],
      "floor": [0, 16],
      "wall": [64, 16],
      "shipUpLeft": [0, 32], "shipUpMid": [16, 32], "shipUpRight": [32, 32],
      "shipLowLeft": [0, 48], "shipDoor": [16, 48], "shipLowRight": [32, 48],
      "stars": [64, 64],
      "crystal": [64, 64],
      "crab": [0, 64],  "redcrab": [0, 80], "pil": [0, 96],
    }
    return loc;
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
            model.player.initWarp();
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
        case "V": //Upgrade Visual
          tile = new Tile(x, y, "upgrade", "floor", true);
          tile.special = true;
          tile.actionTrigger = () => {
            if (model.player.inventory["Raw Crystal"] > 1 * model.player.los) {
              model.player.inventory["Raw Crystal"] -= (1 * model.player.los);
              model.player.los += 1;
              view.notify("Suit lights upgraded")
            } else {
              view.notify("Insufficient material.")
              view.notify("Perhaps with some crystals the power and focus of your lights could be improved.")
            }
          };
          tile.stepTrigger = () => {
            view.notify("Optical Workstation: Press Enter to upgrade visuals.");
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
    this.notifications = ["Welcome to your interstellar journey."];
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

    this.fov = new ROT.FOV.PreciseShadowcasting(this.lightPasses, {topology:4});

    this.textDisplay = new ROT.Display({width:74, height:7});
    //document.body.appendChild(this.textDisplay.getContainer());
    this.textWindow.appendChild(this.textDisplay.getContainer());
    this.notify("Use WASD to move, Press K to aim and Enter to attack");

    setTimeout(view.updateDisplay.bind(this), 500);
  }

  notify(text) {
    this.textDisplay.clear();
    if (this.notifications.length > 2) { this.notifications.shift(); }
    //Add the new notification
    this.notifications.push(text);
    //Display all notifications
    for (let i = 0; i < this.notifications.length; i++) {
      this.textDisplay.drawText(1, (i * 2) + 1, this.notifications[i]);
    }
  }

  //Used for showing information on the selected option during warp
  displayWarpChoice(location) {
    this.textDisplay.clear();
    this.textDisplay.drawText(3, 2, "%c{white}Select");
    this.textDisplay.drawText(4, 3, "%c{white}your     :");
    this.textDisplay.drawText(1, 4, "%c{white}destination");

    this.textDisplay.drawText(15, 1, "Type: " + location.type);
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
    //the %c{} means make the text color
    this.statsDisplay.drawText(1, 1, "%c{cyan}Oxygen:");
    this.statsDisplay.drawText(1, 2, model.player.oxygen + "/" + model.player.maxOxygen);

    this.statsDisplay.drawText(1, 4, "%c{yellow}Energy:");
    this.statsDisplay.drawText(1, 5, model.player.energy + "/" + model.player.maxEnergy);

    this.statsDisplay.drawText(1, 7, "%c{magenta}Health:");
    this.statsDisplay.drawText(1, 8, model.player.health + "/" + model.player.maxHealth);

    this.statsDisplay.drawText(1, 10, "%c{red}Weapon:");
    if (model.player.weapon) {
      let w = model.player.weapon;
      this.statsDisplay.drawText(1, 11, "%c{white}" + w.name);
      this.statsDisplay.drawText(1, 12, "Charges: " + w.currentCharge);
      this.statsDisplay.drawText(1, 13, "Charge cost: " + w.chargeCost);
      this.statsDisplay.drawText(1, 14, "Energy cost: " + w.useCost);
      this.statsDisplay.drawText(1, 15, "Range: " + w.range);
      this.statsDisplay.drawText(1, 16, "Damage: " + w.minDamage + "-" + w.maxDamage);
    } else {
      this.statsDisplay.drawText(1, 11, "None");
    }

    //Temporary, show crystal count
    this.statsDisplay.drawText(1, 18, "%c{white}Inventory:");
    for (let item in model.player.inventory) {
      this.statsDisplay.drawText(1, 19, item + ": " + model.player.inventory[item]);
    }

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
"*********************************************" +
"*********************************************" +
"*********************************************" +
"*********************************************" +
"*********************************************" +
"*********************************************" +
"********************#####********************" +
"*******************#.....#*******************" +
"**************^***#.......#***^**************" +
"**************|***#.......#***|**************" +
"**************||*#...===...#*||**************" +
"**************||*#..#NNN#..#*||**************" +
"**************||#...........#||**************" +
"**************||#...........#||**************" +
"**************||#...........#||**************" +
"**************||#===.....####||**************" +
"**************||#MBO........#||**************" +
"**************||#.....@.....#||**************" +
"**************||#...........#||**************" +
"**************||####.....#=##||**************" +
"**************||#.........V.#||**************" +
"**************||#...........#||**************" +
"**************||#...........#||**************" +
"**************||#...#####...#||**************" +
"**************||#..#*****#..#||**************" +
"**************||###*******###||**************" +
"**************||#|*********|#||**************" +
"**************v||v*********v||v**************" +
"**************|**|*********|**|**************" +
"*********************************************" +
"*********************************************" +
"*********************************************" +
"*********************************************" +
"*********************************************" +
"*********************************************";

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

let shipMenu = generator.createFromString(shipString, 35, 45);
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
