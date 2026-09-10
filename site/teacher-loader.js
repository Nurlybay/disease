/* Page-scoped loading: deduplicate requests, retry failures, bound journal preloading. */
(function(root){
 'use strict';
 root.TeacherLoader={create:function(load,isLoaded){
  var pending=Object.create(null);
  function one(item){
   if(isLoaded(item))return Promise.resolve();
   if(pending[item.file])return pending[item.file];
   pending[item.file]=Promise.resolve().then(function(){return load(item);}).then(function(){
    if(!isLoaded(item))throw new Error('case_not_loaded');
   }).catch(function(error){delete pending[item.file];throw error;});
   return pending[item.file];
  }
  function all(items){
   var next=0;
   function worker(){if(next>=items.length)return Promise.resolve();var item=items[next++];return one(item).then(worker);}
   return Promise.all([worker(),worker(),worker()]);
  }
  return {one:one,all:all};
 }};
})(window);
