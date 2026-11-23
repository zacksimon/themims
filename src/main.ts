import './style.css';
import { Game } from './game';
import { World } from './sim/world';

const world = new World();
// M0 demo structure so rotation and cutaway are visible
world.lot.addRoom(6, 6, 14, 12, 0, 0);
world.lot.addRoom(14, 6, 18, 12, 1, 1);
world.lot.setWall('v:14:8', { kind: 'door', style: 1 });
world.lot.setWall('h:9:12', { kind: 'door', style: 0 });
world.lot.setWall('h:11:6', { kind: 'window', style: 0 });
world.lot.setWall('v:6:8', { kind: 'window', style: 0 });

const game = new Game(world, document.getElementById('view') as HTMLCanvasElement, document.getElementById('ui')!);
game.start();
(window as unknown as { game: Game }).game = game;
