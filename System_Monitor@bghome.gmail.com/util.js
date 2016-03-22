const Util = imports.misc.util;
const Lang = imports.lang;

let Process = new Lang.Class({
    Name: "Process",

    _init: function(id) {
        this._id = id;
    },

    kill: function() {
        Util.spawn([ 'bash', '-c', 'kill -s TERM ' + parseInt(this._id) ]);
    }
});
