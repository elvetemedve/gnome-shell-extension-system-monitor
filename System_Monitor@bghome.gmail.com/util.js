const Util = imports.misc.util;
const GTop = imports.gi.GTop;
const Lang = imports.lang;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const FactoryModule = Me.imports.factory;

let Process = new Lang.Class({
    Name: "Process",

    _init: function(id) {
        this._id = id;
    },

    kill: function() {
        Util.spawn([ 'bash', '-c', 'kill -s TERM ' + parseInt(this._id) ]);
    }
});

let Processes = new Lang.Class({
    Name: "Processes",

    /**
     * Get ID list of running processes
     */
    getIds: function() {
        let file = FactoryModule.AbstractFactory.create('file', this, '/proc');
		let files = file.list();
		let ids = [];
		for (let i in files) {
			let id = parseInt(files[i]);
			if (!isNaN(id)) {
				ids.push(id);
			}
		}
		return ids;
    },

    /**
     * Get the top processes from the statistics
     *
     * @param array process_stats Items must have "pid" attributes and a value attribute for comarison.
     * @param string attribute Name of the attribute to compare.
     * @param integer limit Limit results to the first N items.
     * @return array Items have "pid" and "command" attributes. 
     */
    getTopProcesses: function(process_stats, attribute, limit) {
        process_stats.sort(function(a, b) {
			return (a[attribute] > b[attribute]) ? -1 : (a[attribute] < b[attribute] ? 1 : 0);
		});

        process_stats = process_stats.slice(0, limit);

		let process_args = new GTop.glibtop_proc_args();
		let result = [];
		for (let i = 0; i < process_stats.length; i++) {
			let pid = process_stats[i].pid;
			let args = GTop.glibtop_get_proc_args(process_args, pid, 0);
			result.push({"command": args, "pid": pid});
		}
        return result;
    }
});
