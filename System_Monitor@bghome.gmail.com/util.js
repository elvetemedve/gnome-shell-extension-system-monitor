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



var CELSIUS = String.fromCodePoint('℃'.codePointAt(0));
var FAHRENHEIT = String.fromCharCode(0x2109);

var toFahrenheit = (celcius, decimals) => +(1.8 * celcius + 32).toFixed(decimals);
var MiB2GB = (value, decimals) => +(value * 0.001048576).toFixed(decimals);
var MiB2GiB = (value, decimals) => +(value / 1024).toFixed(decimals);
var B2GiB = (value, decimals) => +(value / 1073741824).toFixed(decimals);
var uW2W = (value, decimals) => +(value / 1000000).toFixed(decimals);
var mDeg2Deg = (value, decimals) => +(value / 1000).toFixed(decimals);


var formatDeviceInfo = async function (info, namespace) {
    switch (info.vendor_id) {
        case "v000010DE":
            info.vendor_name = "Nvidia";
            break;
        case "v00001022":
        case "v00001002":
            info.vendor_name = "AMD";
            break
        case "v00008086":
            info.vendor_name = "Intel";
    }
    
    let model = info.model_name.match(/\[(.+?)\]/)[1];
    let regex = null;

    if (info.vendor_name === "Nvidia") {
        if (model.includes("Mobile") && model.includes("Max")) {
            regex = /GeForce|Mobile|\s\/\s/g;  // /GeForce|Mobile|Max([^\s]+)|\//g
        } else {
            regex = /GeForce/;
        }
    } else if (info.vendor_name === "AMD") {
        // Try to Identify the exact model using the chip revision
        if (model.includes("/") && info.pcie_id != "-") {    
            let is_ids_file = await FactoryModule.AbstractFactory.create('file', namespace, "/usr/share/libdrm/amdgpu.ids").exists();
            let is_lspcie = await FactoryModule.AbstractFactory.create('file', namespace, "/usr/bin/lspci").exists();
            
            if (is_ids_file && is_lspcie) {    
                let model_id = info.model_id.replace(/d0+/, "").trim();
                let pcie_id = info.pcie_id.startsWith("0000:") ? info.pcie_id.replace("0000:", "").trim() : info.pcie_id;
                
                let [success, stdout, stderr] = GLib.spawn_command_line_sync("lspci -s " + pcie_id);
                let rev = new TextDecoder().decode(stdout).split(/\(rev\s/)[1].replace(")", "").toUpperCase().trim();

                let amdgpu_info = await FactoryModule.AbstractFactory.create('file', namespace, "/usr/share/libdrm/amdgpu.ids").read().catch(e => log(e));
                let models = amdgpu_info.split("\n").filter(line => line.startsWith(model_id));
                let found = false;

                for (model of models) {
                    let [device_id, revision, name] = model.split(',');
                    if (revision.trim() === rev) {
                        model = name.trim();
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    model = model.split("/")[0];
                }
            }
        }
        regex = /AMD|Radeon|ATI/g;
    } 
    info.model_name = (regex) ? model.replace(regex, "").trim() : model;
}

var deviceInfo = async function (device, namespace, temp_namespace) {
    let info = { pcie_id: "-", vendor_name: "Unknown", vendor_id: "-", model_name: "Unknown", model_id: "-" };
    let pci_usb_hardware_database_dir = "/usr/share/hwdata/";
    let udev_hardware_database_dir = null;

    try {   
        modalias_output = await FactoryModule.AbstractFactory.create('file', temp_namespace, device.modalias).read();
        FactoryModule.AbstractFactory.destroy('file', temp_namespace);

        //Define hardware database file directories for "udev" if "hwdata" is not installed.
        let is_hwdata_dir = await FactoryModule.AbstractFactory.create('file', namespace, pci_usb_hardware_database_dir).exists();

        if (!is_hwdata_dir) {
            pci_usb_hardware_database_dir = null;

            //Define "udev" hardware database file directory.
            udev_hardware_database_dir = "/usr/lib/udev/hwdb.d/";
            
            //Some older Linux distributions use "/lib/" instead of "/usr/lib/" but they are merged under "/usr/lib/" in newer versions.
            let is_udev_dir = await FactoryModule.AbstractFactory.create('file', namespace, udev_hardware_database_dir).exists();

            if (!is_udev_dir) {
                udev_hardware_database_dir = "/lib/udev/hwdb.d/";
            }
        }

        let [device_subtype, device_alias] = modalias_output.split(":");

        //Get device vendor, model if device subtype is PCI.
        if (device_subtype == "pci") {
            // Get device IDs from modalias file content.
            let first_index = device_alias.search("v");
            let last_index = first_index + 8 + 1;
            info.vendor_id = device_alias.slice(first_index, last_index);
            
            first_index = device_alias.search("d");
            last_index = first_index + 8 + 1;
            info.model_id = device_alias.slice(first_index, last_index);

            let search_text1;
            let search_text2;
            let ids_file_output;

            if (udev_hardware_database_dir === null) {
                search_text1 = "\n" + info.vendor_id.slice(5).toLowerCase() + "  ";
                search_text2 = "\n\t" + info.model_id.slice(5).toLowerCase() + "  ";
                ids_file_output = await FactoryModule.AbstractFactory.create("file", namespace, pci_usb_hardware_database_dir + "pci.ids").read();
            } else {
                search_text1 = "pci:" + info.vendor_id + "*" + "\n ID_VENDOR_FROM_DATABASE="
                search_text2 = "pci:" + info.vendor_id + info.model_id + "*" + "\n ID_MODEL_FROM_DATABASE=";
                ids_file_output = await FactoryModule.AbstractFactory.create('file', namespace, udev_hardware_database_dir + "20-pci-vendor-model.hwdb").read();
            }

            if (ids_file_output.includes(search_text1)) {
                let narrowed_output = ids_file_output.split(search_text1)[1];
                info.vendor_name = narrowed_output.split("\n")[0];

                if (narrowed_output.includes(search_text2)) {
                    info.model_name = narrowed_output.split(search_text2)[1].split("\n")[0];
                }
            }

            let pcie_id = "-";
            uevent_output = await FactoryModule.AbstractFactory.create('file', temp_namespace, device.uevent).read().then(content => content.trim().split("\n")).catch(e => "");
            
            for (let line of uevent_output) {
                if (line.startsWith("PCI_SLOT_NAME=")) {
                    pcie_id = line.split("=").pop();
                }
            }
            info.pcie_id = pcie_id;
        }

        await formatDeviceInfo(info, namespace);
    } catch (e) {
        log(e);
    }
    return info; 
}