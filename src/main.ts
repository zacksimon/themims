import './style.css';
import { Game } from './game';
import { World } from './sim/world';
import { randomLook } from './content/looks';
import { buildStarterHouse } from './content/starter';

const world = new World();
buildStarterHouse(world);
const bartley = world.addMim('Bartley Fumblewick', randomLook(world.rng), 9, 12);

const game = new Game(world, document.getElementById('view') as HTMLCanvasElement, document.getElementById('ui')!);
game.camera.cx = 11;
game.camera.cy = 11;
game.select(bartley.id);
game.start();
(window as unknown as { game: Game }).game = game;
