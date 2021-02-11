//TEST ROGUELIKE VER 0.0.3

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
  getPathTo(x, y) {
    let passableCallback = function(x, y) {
      return (x+","+y in Game.map);
    }
    let astar = new ROT.Path.AStar(x, y, passableCallback, {topology:4});

    let path = [];
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
          //Check if desired space is free
          let dir = ROT.DIRS[8][validInputs[event.keyCode]];
          let newX = this.x + dir[0];
          let newY = this.y + dir[1];
          let newKey = newX + "," + newY;
          if (!(newKey in Game.map)) {
            return;
          }
          //Draw over old spot
          Game.display.draw(this.x, this.y, Game.map[this.x+","+this.y]);
          //Move and redraw self
          this.x = newX;
          this.y = newY;
          this.draw();

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
    let path = this.getPathTo(Game.player.x, Game.player.y);
    path.shift(); /* remove position of actor */
    if (path.length == 1) {
      alert("Tag, you're it!");
    } else {
      let x = path[0][0];
      let y = path[0][1];
      Game.display.draw(this.x, this.y, Game.map[this.x+","+this.y]);
      this.x = x;
      this.y = y;
      this.draw();
    }
  }
}

Game = {
  display: null,
  w: 35,
  h: 35,
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

  getCameraPos: function(playerPos, viewSize, mapSize) {
    let halfView = viewSize / 2;
    if (playerPos < halfView) {
      return 0;
    } else if (playerPos >= mapSize - halfView) {
      return mapSize - viewSize;
    } else {
      return playerPos - halfView;
    }
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
        if (!actor) { break; }
        await actor.act();
    }
}



window.addEventListener("load", function() {
  let builder = new MapBuilder(Game.w, Game.h);
  Game.initialize(builder.generateDugMap());
});


/*
1D and 2D array conversion (width, index) {
  index = x + width * y;
  x = index % width;
  y = index / width;
}
*/


/*

singalen commented on Mar 12, 2013
Add onClick(x, y) and onHover(x, y) callbacks to level and/or display.
Maybe even onSwipeProgress(x1, y1, x2, y2),
onSwipeEnd(x1, y1, x2, y2) and so on for pinch for touch devices.

ondras commented on Mar 15, 2013
How exactly does this differ from addEventListener("click") or "mouseover" etc?

singalen commented on Mar 16, 2013
They would refer to a map coordinates instead of DOM element.
Currently the map view is a single Canvas, if I get it right,
and it I didn't see yet how to find the clicked/hovered map cell.

ondras commented on Mar 16, 2013
Okay, well it is probably sufficient to divide the mouse coord by
the width/height of the map.
But a helper function for this conversion (which would be far
more complicated in hex layout) might be feasible. Accepting :-)

ondras commented on Mar 17, 2013
Implemented as ROT.Display::eventToPosition(e) -
http://ondras.github.com/rot.js/doc/symbols/ROT.Display.html#eventToPosition

*/
