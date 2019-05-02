const Util = imports.misc.util;
const GTop = imports.gi.GTop;
const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const FactoryModule = Me.imports.factory;
const Promise = Me.imports.helpers.promise.Promise;

var Process = class {
    constructor(id) {
        this._id = id;
    }

    kill() {
        Util.spawn([ 'bash', '-c', 'kill -s TERM ' + parseInt(this._id) ]);
    }
};

var Processes = class {
    /**
     * Get ID list of running processes
     *
     * Update process list asynchronously and return the result of the last update.
     * @return Promise
     */
    getIds() {
        return new Promise((resolve, reject) => {
            GLib.idle_add(GLib.PRIORITY_LOW, function() {
                try {
                    let proclist = new GTop.glibtop_proclist;
                    let pid_list = GTop.glibtop_get_proclist(proclist, 0, 0);
                    let ids = [];
                    for (let pid of pid_list) {
                        if (pid > 0) {
                            ids.push(pid);
                        }
                    }
                    resolve(ids);
                } catch(e) {
                    reject(e);
                }
                return GLib.SOURCE_REMOVE;
            });
        });
    }

    /**
     * Get the top processes from the statistics
     *
     * @param array process_stats Items must have "pid" attributes and a value attribute for comarison.
     * @param string attribute Name of the attribute to compare.
     * @param integer limit Limit results to the first N items.
     * @return array Items have "pid" and "command" attributes.
     */
    getTopProcesses(process_stats, attribute, limit) {
        process_stats.sort(function(a, b) {
            return (a[attribute] > b[attribute]) ? -1 : (a[attribute] < b[attribute] ? 1 : 0);
        });

        let process_args = new GTop.glibtop_proc_args();
        let result = [];
        for (let i = 0; i < process_stats.length; i++) {
            let pid = process_stats[i].pid;
            let args = GTop.glibtop_get_proc_args(process_args, pid, 0);
            if (args.length > 0) {
                result.push({"command": args, "pid": pid});
                if (result.length == limit) break;
            }
        }
        return result;
    }
};

var Directories = class {
    /**
     * Get the list of directories using the most space.
     *
     * @param array directory_stats List of directory data.
     * @param string attribute Name of the attribute to comapre.
     * @param integer limit Limit results of the first N items.
     * @return array Items from directory_stats parameter.
     */
    getTopDirectories(directory_stats, attribute, limit) {
        directory_stats.sort(function(a, b) {
            return (a[attribute] < b[attribute]) ? 1 : (a[attribute] > b[attribute] ? -1 : 0);
        });

        directory_stats = directory_stats.splice(0, limit);

        return directory_stats;
    }

    /**
     * Format the input bytes to the closet possible size unit.
     *
     * @param int bytes Bytes to format
     * @param int decimals Number of decimals to display. Defaults is 2.
     * @return string
     */
    formatBytes(bytes, decimals) {
        if (bytes == 0) {
            return '0 Byte';
        }
        let kilo = 1000;
        let expected_decimals = decimals || 2;
        let sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        let i = Math.floor(Math.log(bytes) / Math.log(kilo));
        return parseFloat((bytes / Math.pow(kilo, i)).toFixed(expected_decimals)) + ' ' + sizes[i];
    }
};

var Network = class {
    /**
     * Format the input bytes to the closet possible size unit.
     *
     * @param int bytes Bytes to format
     * @param int decimals Number of decimals to display. Defaults is 2.
     * @return string
     */
    formatBytes(bytes, decimals) {
        if (bytes == 0) {
            return '0 B';
        }
        let kilo = 1000;
        let expected_decimals = decimals || 2;
        let sizes = ['B/s', 'kb/s', 'Mb/s', 'Gb/s', 'Tb/s', 'Pb/s', 'Eb/s', 'Zb/s', 'Yb/s'];
        let i = Math.floor(Math.log(bytes) / Math.log(kilo));
        return parseFloat((bytes / Math.pow(kilo, i)).toFixed(expected_decimals)) + ' ' + sizes[i];
    }
};

var Swap = class {
    constructor(id) {
        this._processes = new Processes;
        this._pattern = new RegExp('^VmSwap:\\s*(\\d+)', 'm');
    }

    /**
     * Get swap usage information per process
     *
     * Update data asynchronously.
     * @return Promise Keys are process IDs, values are objects like {vm_swap: 1234}
     */
    getStatisticsPerProcess() {
        return this._processes.getIds().then(process_ids => {
            return new Promise((resolve, reject) => {
                let that = this;
                GLib.idle_add(GLib.PRIORITY_LOW, function() {
					try {
                        let promises = [];
                        for (let i = 0; i < process_ids.length; i++) {
                            let pid = process_ids[i];
                            promises.push(that._getRawStastisticsForProcess(pid));
                        }

                        Promise.all(promises).then(rawStatistics => {
                            let statistics = {};
                            for (let i = 0; i < rawStatistics.length; i++) {
                                let pid = process_ids[i];
                                statistics[pid] = rawStatistics[i];
                            }
                            resolve(statistics);
                        });
                    } catch (e) {
                        reject(e);
                    }
                    return GLib.SOURCE_REMOVE;
                });
            });
        });
    }

    _getRawStastisticsForProcess(pid) {
        let pattern = this._pattern;
        return FactoryModule.AbstractFactory.create('file', this, '/proc/' + pid + '/status').read().then(contents => {
            try {
                return { vm_swap: parseInt(contents.match(pattern)[1]) };
            } catch (e) {
                return { vm_swap: 0 };
            }
        }, () => {
            return { vm_swap: 0 };
        });
    }
};

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
