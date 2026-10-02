import test from 'node:test';
import assert from 'node:assert/strict';

test('poll preferences default safely, retain legacy precision, and validate exact whole seconds',async()=>{
  const {normalizePollInterval,validPollInterval,durationToMs}=await import('../src/store/poll-settings.js');
  for(const value of [undefined,null,'60000',NaN,Infinity,0,18000001,{}]) assert.equal(normalizePollInterval(value),60000);
  assert.equal(normalizePollInterval(60000.5),60000.5);
  for(const value of [30000,31000,18000000]) assert.ok(validPollInterval(value));
  for(const value of ['60000',null,NaN,Infinity,29999,30001,18001000]) assert.equal(validPollInterval(value),false);
  assert.equal(durationToMs('0.5','minutes'),30000);
  assert.equal(durationToMs('.5','minutes'),30000);
  assert.equal(durationToMs('3.1e1','seconds'),31000);
  assert.equal(durationToMs('0.1','hours'),360000);
  assert.equal(durationToMs('31','seconds'),31000);
  assert.equal(durationToMs('5','hours'),18000000);
  for(const [value,unit] of [['','seconds'],['abc','minutes'],['29','seconds'],['5.1','hours'],['30.000000000000001','seconds'],['1','unknown'],['Infinity','hours']]) assert.equal(durationToMs(value,unit),null);
});
