const Util = imports.misc.util;
const GTop = imports.gi.GTop;
const Lang = imports.lang;
const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const FactoryModule = Me.imports.factory;
const Promise = Me.imports.helpers.promise.Promise;

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
     *
     * Update process list asynchronously and return the result of the last update.
     * @return Promise
     */
    getIds: function() {
        if (Processes.status === 'idle') {
            Processes.status = 'pending';
            GLib.idle_add(GLib.PRIORITY_LOW, Lang.bind(this, this._updateProcessIds));
        }

        return Processes.ids;
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
    },

    _updateProcessIds: function() {
        Processes.ids = new Promise(resolve => {
            let proclist = new GTop.glibtop_proclist;
            let pid_list = GTop.glibtop_get_proclist(proclist, GTop.GLIBTOP_EXCLUDE_SYSTEM, 0);
            let ids = [];
            for (let pid of pid_list) {
              ids.push(pid);
            }

            Processes.status = 'idle';
            resolve(ids);
        });

        return GLib.SOURCE_REMOVE;
    }
});

Processes.ids = new Promise(resolve => {
    resolve([]);
});
Processes.status = 'idle';

let Directories = new Lang.Class({
    Name: "Directories",

    /**
     * Get the list of directories using the most space.
     *
     * @param array directory_stats List of directory data.
     * @param string attribute Name of the attribute to comapre.
     * @param integer limit Limit results of the first N items.
     * @return array Items from directory_stats parameter.
     */
    getTopDirectories: function(directory_stats, attribute, limit) {
        directory_stats.sort(function(a, b) {
            return (a[attribute] < b[attribute]) ? 1 : (a[attribute] > b[attribute] ? -1 : 0);
        });

        directory_stats = directory_stats.splice(0, limit);

        return directory_stats;
    },

    /**
     * Format the input bytes to the closet possible size unit.
     *
     * @param int bytes Bytes to format
     * @param int decimals Number of decimals to display. Defaults is 2.
     * @return string
     */
    formatBytes: function(bytes, decimals) {
        if (bytes == 0) {
            return '0 Byte';
        }
        let kilo = 1000;
        let expected_decimals = decimals || 2;
        let sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        let i = Math.floor(Math.log(bytes) / Math.log(kilo));
        return parseFloat((bytes / Math.pow(kilo, i)).toFixed(expected_decimals)) + ' ' + sizes[i];
    }
});

let Swap = new Lang.Class({
    Name: "Swap",

    _init: function(id) {
        this._statistics = {};
        this._processes = new Processes;
    },

    /**
     * Get swap usage information per process
     *
     * Update data asynchronously and return the result of the last update.
     * @return Promise Keys are process IDs, values are objects like {vm_swap: 1234}
     */
    getStatisticsPerProcess: function() {
        return this._processes.getIds().then(process_ids => {
            // Remove data of non existent processes.
            for (let pid in this._statistics) {
                if (-1 != process_ids.indexOf(pid)) {
                    delete this._statistics[pid];
                }
            }

            // Update data of processes.
            for (let i = 0; i < process_ids.length; i++) {
              GLib.idle_add(GLib.PRIORITY_LOW, Lang.bind(this, this._getRawStastisticsForProcess, process_ids[i]));
            }
            return this._statistics;
        });
    },

    _getRawStastisticsForProcess: function(pid) {
        var pattern = new RegExp('^VmSwap:\\s*(\\d+)', 'm');
        let promise = FactoryModule.AbstractFactory.create('file', this, '/proc/' + pid + '/status').read().then(contents => {
            let vm_swap = parseInt(contents.match(pattern)[1]);
            this._statistics[pid] = {
                vm_swap: vm_swap
            };
        });

        return GLib.SOURCE_REMOVE;
    }
});

let StopWatch = function () {
    this.startTime = 0;
    this.stopTime = 0;
    this.running = false;
    this.performance = !!window.performance;
};

StopWatch.prototype.currentTime = function () {
    return this.performance ? window.performance.now() : new Date().getTime();
};

StopWatch.prototype.start = function () {
    this.startTime = this.currentTime();
    this.running = true;
};

StopWatch.prototype.stop = function () {
    this.stopTime = this.currentTime();
    this.running = false;
};

StopWatch.prototype.getElapsedMilliseconds = function () {
    if (this.running) {
        this.stopTime = this.currentTime();
    }

    return this.stopTime - this.startTime;
};

StopWatch.prototype.getElapsedSeconds = function () {
    return this.getElapsedMilliseconds() / 1000;
};

StopWatch.prototype.printElapsed = function (name) {
    var currentName = name || 'Elapsed: ';

    window.log(currentName + '[' + this.getElapsedMilliseconds() + 'ms]' + '[' + this.getElapsedSeconds() + 's]');
};
