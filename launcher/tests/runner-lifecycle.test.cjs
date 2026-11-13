'use strict';
// Node/VM only. All subprocesses and timers are synthetic; no executable runs.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{EventEmitter}=require('node:events'),{defaultState}=require('../model.cjs');
function harness(t){
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'bloxdy-lifecycle-unit-')),helper=path.join(folder,'inert-helper.txt'),intervals=new Set(),timeouts=new Set();fs.writeFileSync(helper,'inert fixture');
 const schedule=list=>(fn,ms)=>{const timer={fn,ms,unref(){}};list.add(timer);return timer;},module={exports:{}},file=path.resolve(__dirname,'../game-runner.cjs');
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{require:name=>name.startsWith('.')?require(path.resolve(path.dirname(file),name)):require(name),module,exports:module.exports,setInterval:schedule(intervals),clearInterval:t=>intervals.delete(t),setTimeout:schedule(timeouts),clearTimeout:t=>timeouts.delete(t)},{filename:'synthetic-game-runner.cjs'});
 const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{child.killed=true;};const runner=new module.exports.GameRunner(defaultState().profiles[1],false,{data:folder,runner:helper,executable:'INERT-NOT-EXECUTED',root:folder,packaged:true,spawn:()=>child}),closed=[];runner.on('closed',value=>closed.push(value));
 t.after(()=>{assert.ok(folder.startsWith(path.join(os.tmpdir(),'bloxdy-lifecycle-unit-')));fs.rmSync(folder,{recursive:true,force:true});});
 return {runner,child,closed,intervals,timeouts,poll:()=>{for(const timer of [...intervals])timer.fn();},status:(phase,runId=runner.id)=>fs.writeFileSync(path.join(runner.output,'game-start.json'),JSON.stringify({runId,phase}))};
}
async function visible(f){const started=f.runner.start();f.child.stdout.emit('data',Buffer.from('BUDGET_READY 4\n'));f.status('visible');f.poll();await started;}

test('Matching window closure completes before helper exit, ignores stale run IDs and emits exactly once',async t=>{
 const f=harness(t);await visible(f);assert.equal(f.timeouts.size,0);f.status('closed','b'.repeat(24));f.poll();assert.equal(f.closed.length,0);
 f.status('closed');f.poll();assert.equal(f.closed.length,1);assert.equal(f.closed[0].code,0);assert.equal(f.child.killed,undefined);assert.equal(f.intervals.size,0);f.child.emit('exit',1);f.child.emit('error',Error('late helper error'));assert.equal(f.closed.length,1);
});
test('A user closing during startup cancels the wait without a 45-second deadline or process termination',async t=>{
 const f=harness(t),started=f.runner.start();f.status('closed');f.poll();await assert.rejects(started,/closed before showing/);assert.equal(f.closed.length,1);assert.equal(f.intervals.size,0);assert.equal(f.timeouts.size,0);assert.equal(f.child.killed,undefined);
});
test('Process exit remains a close fallback when no window marker can be written',async t=>{
 const f=harness(t);await visible(f);f.child.emit('exit',1);assert.equal(f.closed.length,0);assert.equal(f.intervals.size,0);[...f.timeouts][0].fn();assert.equal(f.closed.length,1);assert.equal(f.closed[0].code,1);
});
test('Final stderr after exit is captured before the close notification, including its signal',async t=>{const f=harness(t);await visible(f);f.child.emit('exit',null,'SIGKILL');f.child.stderr.emit('data',Buffer.from('Final native error token=HIDDEN'));f.child.emit('close',null,'SIGKILL');assert.equal(f.closed.length,1);assert.equal(f.closed[0].signal,'SIGKILL');const log=fs.readFileSync(path.join(f.runner.output,'runner-error.log'),'utf8');assert.match(log,/Final native error/);assert.doesNotMatch(log,/HIDDEN/);assert.equal(f.timeouts.size,0);});
test('Spawn errors reject startup and release all lifecycle observers',async t=>{
 const f=harness(t),started=f.runner.start();f.child.emit('error',Error('Synthetic spawn failure'));await assert.rejects(started,/Synthetic spawn failure/);assert.equal(f.closed.length,1);assert.equal(f.intervals.size,0);assert.equal(f.timeouts.size,0);
});
