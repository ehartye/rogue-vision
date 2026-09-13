import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeKey, createInputFilter } from '../src/input.js';
test('wrist keyCode wins, empty precursor is ignored, desktop fallback works',()=>{
  assert.equal(decodeKey({keyCode:38,key:'Unidentified',code:''}),'up');
  assert.equal(decodeKey({keyCode:0,key:'Unidentified',code:''}),null);
  assert.equal(decodeKey({keyCode:40,key:'ArrowUp'}),'down');
  assert.equal(decodeKey({key:'Enter'}),'select');
  assert.equal(decodeKey({code:'Escape'}),'back');
});
test('repeats and duplicate keydowns cannot spend extra turns',()=>{
  const filter=createInputFilter();
  assert.equal(filter({keyCode:39},100),'right');
  assert.equal(filter({keyCode:39},125),null);
  assert.equal(filter({keyCode:39},300),'right');
  assert.equal(filter({keyCode:39,repeat:true},400),null);
  assert.equal(filter({keyCode:0,key:'Unidentified'},410),null);
  assert.equal(filter({keyCode:37},420),'left');
});
