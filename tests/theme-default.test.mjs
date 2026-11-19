import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../dist/theme.js',import.meta.url),'utf8');
function loadPage(){
  const root={dataset:{}},handlers={};let toggle;
  const button={setAttribute(){},addEventListener(type,callback){if(type==='click')toggle=callback;}};
  const document={documentElement:root,
    querySelector:selector=>selector.startsWith('meta')?{setAttribute(){}}:button,
    addEventListener:(type,callback)=>handlers[type]=callback};
  vm.runInNewContext(source,{document,
    localStorage:{getItem(){throw new Error('Saved preference must not override light');}},
    window:{matchMedia(){throw new Error('System preference must not override light');},addEventListener(){}}
  });
  handlers.DOMContentLoaded();return {root,toggle:()=>toggle()};
}
test('each page starts light without consulting system or saved dark preferences',()=>{
  assert.equal(loadPage().root.dataset.theme,'light');
});
test('an explicit dark toggle works but a new page still opens light',()=>{
  const page=loadPage();page.toggle();assert.equal(page.root.dataset.theme,'dark');
  assert.equal(loadPage().root.dataset.theme,'light');page.toggle();assert.equal(page.root.dataset.theme,'light');
});
