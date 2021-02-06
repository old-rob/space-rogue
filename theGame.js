//TEST ROGUELIKE VER 0.0.2

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
  draw() {
    Game.display.draw(this.x, this.y, this.symbol, this.color);
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
      window.addEventListener('keydown', handleKeypress.bind(this), {once: true});
      function handleKeypress(event) {
        let validInputs = {}
        validInputs[37] = 6;
        validInputs[38] = 0;
        validInputs[39] = 2;
        validInputs[40] = 4;

        if (event.keyCode in validInputs) {
          //Check if desired space is free
          let dir = ROT.DIRS[8][validInputs[event.keyCode]];
          let newX = this.x + dir[0];
          let newY = this.y + dir[1];
          let newKey = newX + "," + newY;
          if (!(newKey in Game.map)) { return; }
          //Draw over old spot
          Game.display.draw(this.x, this.y, Game.map[this.x+","+this.y]);
          //Move and redraw self
          this.x = newX;
          this.y = newY;
          this.draw();

          window.removeEventListener('keydown', handleKeypress);
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
  }
  act() {
    alert("I'm a crab!");
  }
}

Game = {
  display: null,
  w: 25,
  h: 25,
  player: null,
  actors: [],
  scheduler: null,
  map: null,

  initialize: function(map) {
    this.display = new ROT.Display({width:this.w, height:this.h, forceSquareRatio: true});
    document.body.appendChild(this.display.getContainer());

    //This is a mess...
    this.map = map;
    this.drawMap(this.map);

    this.scheduler = new ROT.Scheduler.Speed();
    this.scheduler.add(this.player, true);
    for (let actor of this.actors) {
      this.scheduler.add(actor, true);
    }

    eventLoop();
  },
  drawMap: function(mapData) {
    for (let key in mapData) {
      let coord = key.split(",");
      let x = parseInt(coord[0]);
      let y = parseInt(coord[1]);
      this.display.draw(x, y, mapData[key]);
    }
    this.player.draw();
    for (let actor of this.actors) {
      actor.draw();
    }
  },
}

class MapBuilder {
  constructor(width, height) {
    this.w = width;
    this.h = height;
    this.map = {};
  }

  generateDugMap() {
    let digger = new ROT.Map.Digger(this.w, this.h);
    let freeCells = [];
    this.map = {};
    let digCallback = function(x, y, value) {
        if (value) { return; }

        let key = x+","+y;
        this.map[key] = ".";
        freeCells.push(key);
    }
    digger.create(digCallback.bind(this));

    this.generateStars(10, freeCells);
    Game.player = this.createActor(Player, freeCells);
    Game.actors.push(this.createActor(Crab, freeCells));

    return this.map;
  }
  generateStars(numStars, availableCells) {
    for (let i = 0; i < numStars; i++) {
      let index = Math.floor(ROT.RNG.getUniform() * availableCells.length);
      let key = availableCells.splice(index, 1)[0];
      this.map[key] = "*";
    }
  }

  createActor(type, availableCells) {
    let index = Math.floor(ROT.RNG.getUniform() * availableCells.length);
    let key = availableCells.splice(index, 1)[0];
    let coord = key.split(",");
    let x = parseInt(coord[0]);
    let y = parseInt(coord[1]);
    return new type(x, y);
  }

}

async function eventLoop() {
    while (true) {
        let actor = Game.scheduler.next();
        //alert(actor.symbol);
        if (!actor) { break; }
        await actor.act();
    }
}



window.addEventListener("load", function() {
  let builder = new MapBuilder(25, 25);
  Game.initialize(builder.generateDugMap());
});
