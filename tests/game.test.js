import test from 'node:test';
import assert from 'node:assert/strict';
import { newRun, act, chooseUpgrade, encodeSave, decodeSave, UPGRADES, DISTRICTS } from '../src/game.js';

function arena() {
  const s = newRun(123);
  s.tiles = Array.from({length:11}, (_,y) => Array.from({length:11},(_,x) => x===0||y===0||x===10||y===10 ? 1 : 0));
  s.player.x=5; s.player.y=5; s.enemies=[]; s.items=[];
  return s;
}
test('seeded maps are repeatable, varied, and every walkable tile is reachable', () => {
  assert.deepEqual(newRun(7), newRun(7));
  assert.notDeepEqual(newRun(7).tiles, newRun(8).tiles);
  for(let seed=1;seed<=120;seed++) {
    const s=newRun(seed), queue=[[1,1]], seen=new Set(['1,1']);
    for(const [x,y] of queue) for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx,ny=y+dy,key=`${nx},${ny}`;
      if(s.tiles[ny]?.[nx]===0&&!seen.has(key)) {seen.add(key);queue.push([nx,ny]);}
    }
    assert.ok(seen.has(`${s.exit.x},${s.exit.y}`));
    assert.equal(seen.size,s.tiles.flat().filter(t=>t===0).length);
    const occupants=[...s.enemies,...s.items,s.exit,s.player].map(p=>`${p.x},${p.y}`);
    assert.equal(new Set(occupants).size,occupants.length);
  }
});
test('a wall or unavailable pulse costs no turn; movement advances exactly once',()=>{
  const s=arena();s.player.x=1;
  act(s,'left');assert.equal(s.turn,0);
  s.player.charges=0;act(s,'pulse');assert.equal(s.turn,0);
  act(s,'right');assert.equal(s.turn,1);assert.equal(s.player.x,2);
});
test('bump combat and marked enemy strikes permit dodging',()=>{
  const s=arena();s.enemies=[{id:1,kind:'husk',x:6,y:5,hp:5,maxHp:5,intent:[],stun:0}];
  act(s,'right');assert.equal(s.player.x,5);assert.equal(s.enemies[0].hp,2);
  assert.deepEqual(s.enemies[0].intent,[{x:5,y:5}]);
  const hp=s.player.hp;act(s,'up');assert.equal(s.player.hp,hp);
});
test('pulse consumes a charge, damages nearby hostiles and cancels their strike',()=>{
  const s=arena();s.enemies=[{id:1,kind:'husk',x:6,y:5,hp:6,maxHp:6,intent:[{x:5,y:5}],stun:0}];
  const hp=s.player.hp;act(s,'pulse');
  assert.equal(s.player.charges,1);assert.equal(s.enemies[0].hp,2);assert.equal(s.player.hp,hp);
});
test('kills recharge pulses and siphon restores health',()=>{
  const s=arena();s.player.charges=0;s.player.hp=8;s.player.siphon=1;s.kills=2;
  s.enemies=[{id:1,kind:'husk',x:6,y:5,hp:1,maxHp:4,intent:[],stun:0}];
  act(s,'right');assert.equal(s.kills,3);assert.equal(s.player.charges,1);assert.equal(s.player.hp,9);
});
test('supplies resolve on arrival and cannot be collected twice',()=>{
  const s=arena();s.player.hp=10;s.items=[{x:6,y:5,kind:'med'}];
  act(s,'right');assert.equal(s.player.hp,15);assert.equal(s.items.length,0);
  act(s,'left');act(s,'right');assert.equal(s.player.hp,15);
});
test('exit offers three unique upgrades and selection carries build to next district',()=>{
  const s=arena();s.player.x=8;s.player.y=9;
  act(s,'right');assert.equal(s.phase,'upgrade');assert.equal(new Set(s.choices).size,3);
  const turn=s.turn;act(s,'left');assert.equal(s.turn,turn);
  const chosen=s.choices[0];assert.ok(UPGRADES[chosen]);
  chooseUpgrade(s,chosen);assert.equal(s.floor,1);assert.equal(s.phase,'playing');assert.ok(s.relics.includes(chosen));
  assert.equal(s.player.x,1);assert.equal(s.player.y,1);
});
test('boss gates final extraction; dead and won runs cannot advance',()=>{
  const s=arena();s.floor=DISTRICTS.length-1;s.player.x=8;s.player.y=9;
  s.enemies=[{id:1,kind:'conductor',x:7,y:7,hp:12,maxHp:12,intent:[],stun:0}];
  act(s,'right');assert.equal(s.phase,'playing');
  s.enemies=[];act(s,'left');act(s,'right');assert.equal(s.phase,'won');
  const t=s.turn;act(s,'wait');assert.equal(s.turn,t);
  const d=arena();d.player.hp=1;d.enemies=[{id:1,kind:'husk',x:6,y:5,hp:5,maxHp:5,intent:[{x:5,y:5}],stun:0}];
  act(d,'wait');assert.equal(d.phase,'dead');const dt=d.turn;act(d,'up');assert.equal(d.turn,dt);
});
test('save roundtrip preserves deterministic continuation and rejects damaged data',()=>{
  const s=newRun(44);act(s,'right');const copy=decodeSave(encodeSave(s));assert.deepEqual(copy,s);
  act(copy,'down');act(s,'down');assert.deepEqual(copy,s);
  for(const bad of ['bad','{}','null','{"version":99}',JSON.stringify({version:1,state:{...s,tiles:[]}})]) assert.equal(decodeSave(bad),null);
  const invalid=structuredClone(s);invalid.player.hp=NaN;assert.equal(decodeSave(encodeSave(invalid)),null);
});
