"use strict";

const Util = imports.misc.util;
const GTop = imports.gi.GTop;
const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const FactoryModule = Me.imports.factory;
const AsyncModule = Me.imports.helpers.async;

var Process = class {
    #id
    constructor(id) {
        this.#id = id;
    }

    kill() {
        Util.spawn([ 'bash', '-c', 'kill -s TERM ' + parseInt(this.#id) ]);
    }
};

var Processes = class {
    #tasks
    constructor() {
        this.#tasks = new AsyncModule.Tasks();
    }
    /**
     * Get ID list of running processes
     *
     * Update process list asynchronously and return the result of the last update.
     * @return Promise
     */
    getIds() {
        return new Promise((resolve, reject) => {
            this.#tasks.newSubtask(() => {
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
            });
        }).catch(logError);
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

    destroy() {
        this.#tasks.cancel();
        this.#tasks = null;
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
    #processes
    #pattern
    #pidDenylist
    #tasks
    constructor() {
        this.#processes = new Processes;
        this.#pattern = new RegExp('^\\s*VmSwap:\\s*(\\d+)', 'm');
        this.#pidDenylist = [];
        this.#tasks = new AsyncModule.Tasks();
    }

    /**
     * Get swap usage information per process
     *
     * Update data asynchronously.
     * @return Promise Keys are process IDs, values are objects like {vm_swap: 1234}
     */
    getStatisticsPerProcess() {
        return this.#processes.getIds().then(process_ids => {
            // Filter out denied PIDs from the live PID list.
            let filteredProcessIds = process_ids.filter(x => this.#pidDenylist.indexOf(x) === -1);

            return new Promise((resolve, reject) => {
                let that = this;
                this.#tasks.newSubtask(() => {
                    try {
                        let promises = [];
                        for (let i = 0; i < filteredProcessIds.length; i++) {
                            let pid = filteredProcessIds[i];
                            promises.push(that.#getRawStastisticsForProcess(pid).catch(() => {
                                // Add PID resulting in a failed query to the deny list.
                                // Dont't collect statistics for such PIDs next time.
                                that.#pidDenylist.push(pid);
                            }));
                        }

                        Promise.all(promises).then(rawStatistics => {
                            let statistics = {};
                            for (let i = 0; i < rawStatistics.length; i++) {
                                // Skip rejected promises which does not produce a result object.
                                if (Object.prototype.toString.call(rawStatistics[i]) !== '[object Object]') {
                                    continue;
                                }
                                let pid = filteredProcessIds[i];
                                statistics[pid] = rawStatistics[i];
                            }
                            resolve(statistics);
                        });
                    } catch (e) {
                        reject(e);
                    }
                });
            });
        });
    }

    destroy() {
        FactoryModule.AbstractFactory.destroy('file', this);
        this.#processes.destroy();
        this.#processes = null;
        this.#tasks.cancel();
        this.#tasks = null;
    }

    #getRawStastisticsForProcess(pid) {
        return FactoryModule.AbstractFactory.create('file', this, '/proc/' + pid + '/status').read().then(contents => {
            return {
                vm_swap: parseInt(contents.match(this.#pattern)[1])
            };
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
