import './style.css';
import { Game } from './game';
import { World } from './sim/world';
import { addFumblewicks, buildStarterHouse } from './content/starter';

const world = new World();
buildStarterHouse(world);
addFumblewicks(world);
const bartley = world.mims[0];

const game = new Game(world, document.getElementById('view') as HTMLCanvasElement, document.getElementById('ui')!);
game.camera.cx = 11;
game.camera.cy = 11;
game.select(bartley.id);
game.start();
(window as unknown as { game: Game }).game = game;
