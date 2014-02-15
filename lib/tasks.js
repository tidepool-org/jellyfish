var es = require('event-stream');

function create (created) {
  return this.db.syncTasks.save({'status': 'starting'}, created);
}

function update (update, callback) {
  task = JSON.parse(JSON.stringify(update));
  this.db.syncTasks.save(task, callback);
}

function progress (task) {
  var $task = this;
  var stream = es.through(write);
  function write (update) {
    var self = this;
    task.status = update.status;
    task.stage = update.stage;
    task.data = update.data;
    task = JSON.parse(JSON.stringify(task));
    $task.update(task, onUpdate);
    function onUpdate (err, updated) {
      stream.emit('data', task);
    };
  }
  return stream;
}

function get (id, callback) {
  this.db.syncTasks.findOne({_id: id}, callback);
}

function Tasks (db) {
  this.db = db;
  return this;
}

Tasks.prototype.get = get;
Tasks.prototype.update = update;
Tasks.prototype.create = create;
Tasks.prototype.progress = progress;

module.exports = function (db) {
  var tasks = new Tasks(db);
  return tasks;
}
