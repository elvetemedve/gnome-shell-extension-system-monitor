const GTop = imports.gi.GTop;
const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const FactoryModule = Me.imports.factory;
const Util = Me.imports.util;
const Promise = Me.imports.helpers.promise.Promise;

function MeterSubject(options) {
	this.observers = [];
	this.previous_usage = 0;
	this.usage = 0;
    this.activity_threshold = 0;

    this.setActivityThreshold = function(value) {
        if (value < 0 || value > 100) {
            throw `Activity threshold must be within range [0, 100], but got "${value}."`;
        }
        this.activity_threshold = value;
    }

	this.add = function(object) {
		this.observers.push(object);
	};

	this.removeAt = function(index) {
		this.observers.splice(index, 1);
	};

	this.indexOf = function(object) {
		for (let i = 0; i < this.observers.length; i++) {
			if (object === this.observers[i]) {
				return i;
			}
		}

		return -1;
	};

	this.notify = function(percent, processes, interfaces, system_load, directories, gpu, has_activity) {
		for (let i = 0; i < this.observers.length; i++) {
			this.observers[i].update(
				{
					percent: percent,
					processes: processes,
                    interfaces: interfaces,
					system_load: system_load,
					directories: directories,
					gpu: gpu,
					has_activity: has_activity
				}
			);
		}
	};
};

MeterSubject.prototype.addObserver = function(observer) {
	this.add(observer);
};

MeterSubject.prototype.removeObserver = function(observer) {
	this.removeAt(this.indexOf(observer));
};

MeterSubject.prototype.notifyAll = function() {
	if (this.observers.length > 0) {
		Promise.all([
			this.calculateUsage(),
			this.getProcesses(),
            this.getInterfaces(),
			this.getSystemLoad(),
			this.getDirectories(),
			this.getGPU()
		]).then(params => {
            return this.hasActivity().then(activity => {
                params.push(activity);
                return params;
            });
		}).then(params => {
            this.notify.apply(this, params);
            this.previous_usage = this.usage;
        });
	}
};

/**
 * Calculate the resource usage and return a percentage value.
 */
MeterSubject.prototype.calculateUsage = function() {
	return new Promise(resolve => {
		resolve(0.0);
	});
};

/**
 * Return the list of processed associated by the measured resource.
 *
 * The returned array expected to be sorted by usage and be in descending order.
 * A process object should be like this:
 * { "command": "/path/to/binary", "id": 123 }
 */
MeterSubject.prototype.getProcesses = function() {
	return new Promise(resolve => {
		resolve([]);
	});
};

/**
 * Return the list of network interfaces with related data.
 *
 * The returned array expected to be sorted by interface speed in descending order.
 * An object should look like this:
 * { "name": "eth0", "upload": 1234, "download": 4321 }
 */
MeterSubject.prototype.getInterfaces = function() {
	return new Promise(resolve => {
		resolve([]);
	});
};

/**
 * Return GPU related data.
 *
 * A GPU[stats] object should look like this:
 * { name": "GTX 1070", "vendor": "Nvidia", "usage": 0, "mem": 0,"mem_used": 0, "mem_usage": 0, 
 * "mem_unit": 'GB', "temp": 0, "temp_unit": temp_unit, "power_usage": 0, "power_unit": 'W', 
 * "mem_clock": 0, "mem_clock_max": 0, "clock": 0, "clock_max": 0, "clock_unit": "Mhz" }
 */
MeterSubject.prototype.getGPU = function() {
	return new Promise(resolve => {
		resolve([]);
	});
};

/**
 * Return information about system load.
 *
 * See the method body for expected data structure.
 */
MeterSubject.prototype.getSystemLoad = function() {
	return new Promise(resolve => {
		resolve({
			'running_tasks_count': 0,
			'tasks_count': 0,
			'load_average_1': 0,
			'load_average_5': 0,
			'load_average_15': 0
		});
	});
};

/**
 * Return the list of examined directories.
 *
 * A directory item should be like this:
 * { "name": "/tmp", "free_size": 12345 }
 * where "free_size" is in bytes.
 */
MeterSubject.prototype.getDirectories = function() {
	return new Promise(resolve => {
		resolve([]);
	});
};

/**
 * Tell wheter the resource was utilized since the last status update.
 */
MeterSubject.prototype.hasActivity = function() {
	return new Promise(resolve => {
		resolve(this.usage - this.previous_usage >= this.activity_threshold);
	});
};

MeterSubject.prototype.destroy = function() {
	// FIXME cancel all pending Promises.
};

var CpuMeter = function(options) {
    if (options && options.activity_threshold) {
        this.setActivityThreshold(options.activity_threshold);
    }
	this.observers = [];
	this._statistics = {
		cpu: { user:0, nice:0, guest:0, guest_nice:0, system:0, irq: 0, softirq: 0, idle: 0, iowait: 0, steal: 0 },
		proc: {}
	};
	let processes = new Util.Processes;
	let process_time = new GTop.glibtop_proc_time();

	this.loadData = function() {
		return FactoryModule.AbstractFactory.create('file', this, '/proc/stat').read().then(contents => {
			let statistics = {};
			let reverse_data = contents.match(/^cpu.+/)[0].match(/\d+/g).reverse();
			let columns = ['user','nice','system','idle','iowait','irq','softirq','steal','guest','guest_nice'];
			for (let index in columns) {
				statistics[columns[index]] = parseInt(reverse_data.pop());
			}
			return statistics;
		});
	};

	this.calculateUsage = function() {
		return this.loadData().then(stat => {
			let time_calculator = function(stat) {
				let result = {};
				result.user = stat.user - stat.guest;
				result.nice = stat.nice - stat.guest_nice;
				result.virtall = stat.guest + stat.guest_nice;
				result.systemall = stat.system + stat.irq + stat.softirq;
				result.idleall = stat.idle + stat.iowait;
				result.guest = stat.guest;
				result.steal = stat.steal;
				result.total = result.user + result.nice + result.systemall + result.idleall + stat.steal + result.virtall;
				return result;
			};
			let usage_calculator = function(periods) {
				return (periods.user + periods.nice + periods.systemall + periods.steal + periods.guest) / periods.total * 100;
			};

			let times = time_calculator(stat), previous_times = time_calculator(this._statistics.cpu);
			this._statistics.cpu = stat;
			let periods = {};
			for (let index in times) {
				periods[index] = times[index] - previous_times[index];
			}

            this.usage = usage_calculator(periods);
			return this.usage;
		});
	};

	this.getProcesses = function() {
		return processes.getIds().then(process_ids => {
			return new Promise((resolve, reject) => {
				let that = this;
				GLib.idle_add(GLib.PRIORITY_LOW, function() {
					try {
						let process_stats = [];
						for (let i = 0; i < process_ids.length; i++) {
							GTop.glibtop_get_proc_time(process_time, process_ids[i]);
							let previous_rtime = that._statistics.proc[process_ids[i]] || process_time.rtime;
							that._statistics.proc[process_ids[i]] = process_time.rtime;
							process_stats.push ({"pid": process_ids[i], "time": process_time.rtime - previous_rtime});
						}
						resolve(processes.getTopProcesses(process_stats, "time", 3));
					} catch (e) {
						reject(e);
					}
                	return GLib.SOURCE_REMOVE;
            	});
			});
		});
	};

	this.destroy = function() {
		FactoryModule.AbstractFactory.destroy('file', this);
	};
};

CpuMeter.prototype = new MeterSubject();


var MemoryMeter = function(options) {
    if (options && options.activity_threshold) {
        this.setActivityThreshold(options.activity_threshold);
    }
    if (options && options.calculation_method) {
        var calculation_method = options.calculation_method;
    } else {
        throw 'MemoryMeter expects to get a calculation method.';
    }
	this.observers = [];
	if (-1 == ['ram_only', 'all'].indexOf(calculation_method)) {
			throw new RangeError('Unknown memory calculation method given: ' + calculation_method);
	}
	this._calculation_method = calculation_method;
	let processes = new Util.Processes;
	let process_memory = new GTop.glibtop_proc_mem();

	this.loadData = function() {
		return FactoryModule.AbstractFactory.create('file', this, '/proc/meminfo').read().then(contents => {
			let statistics = {};
			let columns = ["memtotal", "memavailable"];

			for (let index in columns) {
				statistics[columns[index]] = parseInt(contents.match(new RegExp(columns[index] + '.*?(\\d+)', 'i')).pop());
			}
			return statistics;
		});
	};

	this.calculateUsage = function() {
		return this.loadData().then(stat => {
			let used = stat.memtotal - stat.memavailable;
			this.usage = used / stat.memtotal * 100;
			return this.usage;
		});
	};

	this.getProcesses = function() {
		let calculation_method = this._calculation_method == 'ram_only' ? calculateRamOnly : calculateAllRam;

		return processes.getIds().then(process_ids => {
			return new Promise((resolve, reject) => {
				GLib.idle_add(GLib.PRIORITY_LOW, function() {
					try {
						let process_stats = [];
						for (let i = 0; i < process_ids.length; i++) {
							GTop.glibtop_get_proc_mem(process_memory, process_ids[i]);
							process_stats.push (
								{
									"pid": process_ids[i],
									"memory": calculation_method(process_memory)
								}
							);
						}
						resolve(processes.getTopProcesses(process_stats, "memory", 3));
					} catch (e) {
						reject(e);
					}
					return GLib.SOURCE_REMOVE;
				});
			});
		});
	};

	this.destroy = function() {
		FactoryModule.AbstractFactory.destroy('file', this);
	};

	let calculateRamOnly = function(process_memory) {
		return process_memory.resident;
	};

	let calculateAllRam = function(process_memory) {
		return process_memory.vsize + process_memory.resident + process_memory.share;
	};
};

MemoryMeter.prototype = new MeterSubject();


var StorageMeter = function(options) {
    if (options && options.activity_threshold) {
        this.setActivityThreshold(options.activity_threshold);
    }
	this.observers = [];
	let mount_entry_pattern = new RegExp('^\\S+\\s+(\\S+)\\s+(\\S+)');
	let fs_types_to_measure = [
		'btrfs', 'exfat', 'ext2', 'ext3', 'ext4', 'f2fs',
	 	'hfs', 'jfs', 'nilfs2', 'ntfs', 'reiser4', 'reiserfs', 'vfat', 'xfs',
		'zfs'
	];
	let usage = new GTop.glibtop_fsusage();
	let directories = new Util.Directories;

	this.loadData = function() {
		GTop.glibtop_get_fsusage(usage, '/');
		return (usage.blocks - usage.bavail) / usage.blocks * 100;
	}

	this.calculateUsage = function() {
		return new Promise(resolve => {
			this.usage = this.loadData();
			resolve(this.usage);
		});
	};

	this.getDirectories = function() {
		return FactoryModule.AbstractFactory.create('file', this, '/proc/mounts').read().then(contents => {
			return new Promise((resolve, reject) => {
				GLib.idle_add(GLib.PRIORITY_LOW, function() {
					try {
						let mount_list = contents.split("\n").filter(function(mount_entry) {
                            return mount_entry.trim().length > 0;
                        });
						let directory_stats = [];
						for (let i = 0; i < mount_list.length; i++) {
							let [, mount_dir, fs_type] = mount_list[i].match(mount_entry_pattern);
							if (fs_types_to_measure.indexOf(fs_type) == -1) {
								continue;
							}
							GTop.glibtop_get_fsusage(usage, mount_dir);
							directory_stats.push({
								'name': mount_dir,
								'free_size': usage.bavail * usage.block_size
							});
						}
						resolve(directories.getTopDirectories(directory_stats, 'free_size', 3));
					} catch (e) {
						reject(e);
					}
					return GLib.SOURCE_REMOVE;
				});
			});
		});
	};
};

StorageMeter.prototype = new MeterSubject();


var NetworkMeter = function(options) {
    if (options && options.activity_threshold) {
        this.setActivityThreshold(options.activity_threshold);
    }
    if (options && options.refresh_interval) {
        this._refresh_interval = options.refresh_interval;
    } else {
        throw 'NetworkMeter expects to get a refresh interval.';
    }
	this.observers = [];
	this._statistics = {};
	this._bandwidths = {};
    this._speeds = [];

	this.loadData = function() {
		return FactoryModule.AbstractFactory.create('file', this, '/sys/class/net').list().then(files => {
			let device_names = [];
			let promises = [];
			let callback = function(device_name) {
				return contents => {
					let is_loopback_interface = parseInt(contents) == 772;
					return FactoryModule.AbstractFactory.create('file', this, '/sys/class/net/' + device_name + '/operstate').read().then(contents => {
                        let is_interface_up = contents.trim() == 'up';
						if (is_loopback_interface || is_interface_up) {
							let receive_promise = FactoryModule.AbstractFactory.create('file', this, '/sys/class/net/' + device_name + '/statistics/rx_bytes').read().then(contents => {
								return parseInt(contents);
							});

							let transmit_promise = FactoryModule.AbstractFactory.create('file', this, '/sys/class/net/' + device_name + '/statistics/tx_bytes').read().then(contents => {
								return parseInt(contents);
							});

                            let is_wireless_interface = FactoryModule.AbstractFactory.create('file', this, '/sys/class/net/' + device_name + '/wireless').exists().then(exists => {
                                return exists;
                            });

							return Promise.all([receive_promise, transmit_promise, is_wireless_interface]).then(bytes => {
								return {
									rx_bytes: bytes[0],
									tx_bytes: bytes[1],
                                    type: is_loopback_interface ? 'loopback' : (bytes[2] ? 'wireless' : 'wired')
								};
							});
						}
						return new Promise(resolve => {
							resolve({});
						});
					});
				}
			};
			for (let device_name of files) {
				let promise = FactoryModule.AbstractFactory.create('file', this, '/sys/class/net/' + device_name + '/type').read().then(new callback(device_name));
				device_names.push(device_name);
				promises.push(promise);
			}

			return Promise.all(promises).then((raw_statistics) => {
				let statistics = {};
				for (var i = 0; i < raw_statistics.length; i++) {
					if (Object.keys(raw_statistics[i]).length >= 2) {
						statistics[device_names[i]] = raw_statistics[i];
					}
				}
				return statistics;
			});
		});
	};

	this.calculateUsage = function() {
		return this.loadData().then(statistics => {
			let calculate_speeds = function(statistics) {
				let speeds = {};
				for (let index in statistics) {
					speeds[index] = {};
					speeds[index].upload = (statistics[index].tx_bytes - (this._statistics[index] != undefined ? this._statistics[index].tx_bytes : statistics[index].tx_bytes)) / this._refresh_interval;
					speeds[index].download = (statistics[index].rx_bytes - (this._statistics[index] != undefined ? this._statistics[index].rx_bytes : statistics[index].rx_bytes)) / this._refresh_interval;
                    speeds[index].type = statistics[index].type;
				}
				return speeds;
			};
			let calculate_bandwidths = function(speeds) {
				let bandwidths = {};
				for (let index in speeds) {
					let speed = speeds[index];
					bandwidths[index] = {};
					bandwidths[index].upload = Math.max(speed.upload, (this._bandwidths[index] != undefined ? this._bandwidths[index].upload : 1));
					bandwidths[index].download = Math.max(speed.download, (this._bandwidths[index] != undefined ? this._bandwidths[index].download : 1));
				}
				return bandwidths;
			};
			let calculate_interface_usages = function(speeds) {
				let usages = {};
				for (let index in speeds) {
					let speed = speeds[index];
					let upload_rate = this._bandwidths[index] != undefined ? speed.upload / this._bandwidths[index].upload : 0;
					let download_rate = this._bandwidths[index] != undefined ? speed.download / this._bandwidths[index].download : 0;
					usages[index] = Math.round(Math.max(upload_rate, download_rate) * 100);
				}
				return usages;
			}

			this._speeds = calculate_speeds.call(this, statistics);
			this._bandwidths = calculate_bandwidths.call(this, this._speeds);
			let usages = calculate_interface_usages.call(this, this._speeds);
			let sum_percent = 0;
			for (let index in usages) {
				sum_percent += usages[index];
			}
			let total = Object.keys(usages).length * 100 || 1;

			this._statistics = statistics;

			this.usage = Math.round(sum_percent / total * 100);
			return this.usage;
		});
	};

    this.getInterfaces = function() {
    	return new Promise(resolve => {
            let interfaces = [];
            for (let i in this._speeds) {
                interfaces.push({name: i, upload: this._speeds[i].upload, download: this._speeds[i].download, type: this._speeds[i].type});
            }
            interfaces.sort(function(a, b) {
                return (a.upload + a.download > b.upload + b.download) ? -1 : (a.upload + a.download < b.upload + b.download ? 1 : 0);
            });
    		resolve(interfaces);
    	});
    };

	this.destroy = function() {
		FactoryModule.AbstractFactory.destroy('file', this);
	};
};

NetworkMeter.prototype = new MeterSubject();


var SwapMeter = function(options) {
    if (options && options.activity_threshold) {
        this.setActivityThreshold(options.activity_threshold);
    }
	this.observers = [];
	let swap_utility = new Util.Swap;
	let processes = new Util.Processes;
	this._patterns = {
		'swaptotal': new RegExp('swaptotal.*?(\\d+)', 'i'),
		'swapfree': new RegExp('swapfree.*?(\\d+)', 'i'),
	};

	this.loadData = function() {
		let patterns = this._patterns;
		return FactoryModule.AbstractFactory.create('file', this, '/proc/meminfo').read().then(contents => {
			let statistics = {};
			for (let column in patterns) {
				statistics[column] = parseInt(contents.match(patterns[column]).pop());
			}
			return statistics;
		});
	};

	this.calculateUsage = function() {
		return this.loadData().then(stat => {
			let used = stat.swaptotal - stat.swapfree;
			this.usage = stat.swaptotal == 0 ? 0 : used / stat.swaptotal * 100;
			return this.usage;
		});
	};

	this.getProcesses = function() {
		return swap_utility.getStatisticsPerProcess().then(raw_statistics => {
			let process_stats = [];
			for (let pid in raw_statistics) {
				if (raw_statistics[pid].vm_swap > 0) {
					process_stats.push(
						{
							"pid": pid,
							"memory": raw_statistics[pid].vm_swap
						}
					);
				}
			}

			return processes.getTopProcesses(process_stats, "memory", 3);
		});
	};

	this.destroy = function() {
		FactoryModule.AbstractFactory.destroy('file', this);
	};
};

SwapMeter.prototype = new MeterSubject();


var SystemLoadMeter = function(options) {
    if (options && options.activity_threshold) {
        this.setActivityThreshold(options.activity_threshold);
    }
	this.observers = [];
	this._number_of_cpu_cores = null;
	let load = new GTop.glibtop_loadavg();

	this._getNumberOfCPUCores = function() {
		return new Promise(resolve => {
			if (this._number_of_cpu_cores !== null) {
				return resolve(this._number_of_cpu_cores);
			}

			FactoryModule.AbstractFactory.create('file', this, '/proc/cpuinfo').read().then(contents => {
				this._number_of_cpu_cores = contents.match(new RegExp('^processor', 'gm')).length;
				resolve(this._number_of_cpu_cores);
			});

			return false;
		});
	};

	this.loadData = function() {
		return FactoryModule.AbstractFactory.create('file', this, '/proc/loadavg').read().then(contents => {
			let statistics = {};
			let reverse_data = contents.split(' ').reverse();
			let columns = ['oneminute'];

			for (let index in columns) {
				statistics[columns[index]] = parseFloat(reverse_data.pop());
			}
			return statistics;
		});
	};

	this.calculateUsage = function() {
		return this.loadData().then(stat => {
			return this._getNumberOfCPUCores().then(count => {
				this.usage = stat.oneminute / count * 100;
				this.usage = this.usage > 100 ? 100 : this.usage;
				return this.usage;
			});
		});
	};

	this.getSystemLoad = function() {
		return new Promise(resolve => {
			GTop.glibtop_get_loadavg(load);
			resolve({
				'running_tasks_count': load.nr_running,
				'tasks_count': load.nr_tasks,
				'load_average_1': load.loadavg[0],
				'load_average_5': load.loadavg[1],
				'load_average_15': load.loadavg[2]
			});
		});
	};

	this.destroy = function() {
		FactoryModule.AbstractFactory.destroy('file', this);
	};
};

SystemLoadMeter.prototype = new MeterSubject();



var GPUMeter = function(options) {
    if (options && options.activity_threshold) {
        this.setActivityThreshold(options.activity_threshold);
    }
    if (options && options.refresh_interval) {
        this._refresh_interval = options.refresh_interval;
    } else {
        throw 'GPUMeter expects to get a refresh interval.';
	}

	if (options && options.temp_unit) {
		this.temp_unit = options.temp_unit;		
	} else {
		this.temp_unit = Util.CELSIUS;
	}

	this.observers = [];
	this.amd_gpu_loads = [];
	this.amd_glib_source = null;
	this._gpu = GPUMeter.createGPU(this.temp_unit);

	if (GPUMeter._gpus === null) {
		GPUMeter.loadGPUs(this.temp_unit).then(() => this.selectGPU()).catch(e => logError(e));
	} else {
		this.selectGPU();
	}

	// todo: make it possible to switch between primary and secondary GPU 
	// (need button on widget)
	this.selectGPU = function () {
		// For Intel info is intel_gpu_top needed, which requires sudo privileges
		const unsupported = GPUMeter.is_nvidia_smi ? ["v00008086"] : ["v00008086", "v000010DE"];
		let supported = [];

		for (gpu of GPUMeter._gpus) {
			if (gpu.device.is_boot_vga && !unsupported.includes(gpu.vendor_id)) {
				this._gpu = gpu;
				gpu.stats.temp_unit = this.temp_unit; 
				return;
			} else if (!unsupported.includes(gpu.vendor_id)) {
				supported.push(gpu)
			}
		}

		if (supported.length) {
			this._gpu = supported[0];
			this._gpu.stats.temp_unit = this.temp_unit;
		}
	}

	this.loadData = function() {
		return new Promise(resolve => {
			let gpu = this._gpu;
			// Nvidia gpu using PCIe 
			if (gpu.vendor_id === "v000010DE" && gpu.device.path.startsWith("/sys/class/drm/")) {
				this.getNvidiaInfo(gpu.device.pcie_id).then(stats => {
					Object.assign(gpu.stats, stats);
					resolve(stats.usage);
				}).catch(e => log(e));
			// Amd gpu
			} else if (["v00001022", "v00001002"].includes(gpu.vendor_id)) {
				this.getAMDInfo(gpu.device).then(stats => {
					Object.assign(gpu.stats, stats);
					resolve(stats.usage);
				}).catch(e => log(e));
			} else {
				resolve(0);
			}
		});
	};

	this.calculateUsage = function() {
		return this.loadData().then(usage => {
			this.usage = usage;
			return this.usage;
		});
	};
	
	this.getGPU = function () {
		return new Promise(resolve => {
			let gpu = this._gpu;
			resolve({name: gpu.name, vendor: gpu.vendor, stats: gpu.stats});
    	});
	}

	this.destroy = function () {
		FactoryModule.AbstractFactory.destroy('file', this);

		if (this.amd_glib_source != null) {
			this.amd_glib_source.destroy();
		}
	};

	this.getNvidiaInfo = function (gpu_id) {
		const command = "nvidia-smi --query-gpu=memory.total,memory.used,utilization.memory,utilization.gpu,power.draw,power.limit,clocks.current.memory,clocks.current.graphics,clocks.max.memory,clocks.max.graphics,temperature.gpu --format=csv --id=" + gpu_id;
		return new Promise((resolve, reject) => {
			let [res, stdout, stderr] = GLib.spawn_command_line_sync(command);
			let [keys, data] = new TextDecoder().decode(stdout).split("\n");
			
			let parts = data.split(",");
			let stats = GPUMeter.createStats(this.temp_unit);
	
			stats["temp"] = parts.pop().trim();
			if (this.temp_unit == Util.FAHRENHEIT) {
				stats["temp"] = Util.toFahrenheit(stats["temp"]);
			}
	
			let [value, unit] = parts.pop().trim().split(" ");
			stats["clock_max"] = parseInt(value.trim());
			stats["clock_unit"] = unit.trim();
	
			[value, unit] = parts.pop().trim().split(" ");
			stats["mem_clock_max"] = parseInt(value.trim());
	
			[value, unit] = parts.pop().trim().split(" ");
			stats["clock"] = parseInt(value.trim());
	
			[value, unit] = parts.pop().trim().split(" ");
			stats["mem_clock"] = parseInt(value.trim());

			[value, unit] = parts.pop().trim().split(" ");
			stats["power_limit"] = parseInt(value.trim());
			stats["power_unit"] = unit.trim();
	
			[value, unit] = parts.pop().trim().split(" ");
			stats["power_usage"] = parseFloat(value.trim());
	
			[value, unit] = parts.pop().trim().split(" ");
			stats["usage"] = parseFloat(value.trim());
	
			[value, unit] = parts.pop().trim().split(" ");
			stats["mem_usage"] = parseFloat(value.trim());
	
			[value, unit] = parts.pop().trim().split(" ");
			stats["mem_used"] = parseFloat(value.trim());
			stats["mem_unit"] = unit.trim();
	
			[value, unit] = parts.pop().trim().split(" ");
			stats["mem"] = parseFloat(value.trim());
	
			for (key of ["mem_used", "mem"]) {
				stats[key] = Util.MiB2GiB(stats[key], 1);
			}
			stats["mem_unit"] = "GiB";
	
			resolve(stats);
		});
	};

	// This information is calculated for a very small time and directly plotting this data gives spikes.
	GPUMeter._AMDUsage = function () {
		try {
			this.amd_glib_source.destroy();
		} catch (e) { };
		this.amd_glib_source = GLib.timeout_source_new(1000 / 365);

		FactoryModule.AbstractFactory.create('file', this._gpu.device.path + "device/gpu_busy_percent").read(data => {
			this.amd_gpu_loads.push(parseFloat(data.trim()));
			this.amd_gpu_loads.shift();

			this.amd_glib_source.set_callback(this._AMDUsage);
			this.amd_glib_source.attatch(GLib.MainContext.default());
		});
	}

	GPUMeter.getAMDInfo = function (device) {
		let stats = GPUMeter.createStats(this.temp_unit);
		let temp = Promise.resolve();
		let power = Promise.resolve();
		let namespace = device.name;
		let reader = (path) => FactoryModule.AbstractFactory.create('file', namespace, path).read();
		
		this._AMDUsage();

		return new Promise(resolve => {
			if (device.power_sensor) {
				power = reader(device.power_sensor).then(data => {
					stats.power_usage = Util.uW2W(parseFloat(data.trim()), 1);
					stats.power_unit = "W";
				});
			}
	
			if (device.temp_sensor) {
				temp = reader(device.temp_sensor).then(data => {
					stats.temp = Util.mDeg2Deg(parseFloat(data.trim()), 1);
					if (GPUMeter.temp_unit === Util.FAHRENHEIT) {
						stats.temp = Util.toFahrenheit(stats.temp);
					}
				});
			}
			
			let clock_info = reader(device.path + "device/pp_dpm_sclk").then(result => {
				let output = result.trim().split("\n");
	
				for (line of output) {
					if (line.includes("*")) {
						stats.clock = line.split(":")[1].replace(/\*+$|Mhz/, '').trim();
						stats.clock = parseInt(stats.clock);
						break;
					}
				}
				stats.clock_max = output.pop().split(":")[1].replace(/Mhz/, '').trim();
				stats.clock_max = parseInt(stats.clock_max);
				stats.clock_unit = "Mhz";
			}).catch(e => log(e));
	
			let mem_used = reader(device.path + "device/mem_info_vram_used").then(data => {
				stats.mem_used = Util.B2GiB(parseInt(data.trim()), 1);
			}).catch(e => log(e));
	
			let mem = reader(device.path + "device/mem_info_vram_total").then(data => {
				stats.mem = Util.B2GiB(parseInt(data.trim()), 1);
			}).catch(e => log(e));
	
			Promise.all([temp, power, usage, clock_info, mem_used, mem]).then(l => {
				stats.mem_usage = +(stats.mem_used / stats.mem).toFixed(1);
				let total = this.amd_gpu_loads.reduce((total, curr) => total + curr, 0);
				stats.usage = +(total / this.amd_gpu_loads.length).toFixed(1);
				resolve(stats);
			});
		});
	};
};

GPUMeter.prototype = new MeterSubject();
GPUMeter.is_nvidia_smi = false;
GPUMeter._gpus = null;

GPUMeter.createStats = function (temp_unit) {
	return {
		"usage": 0,
		"mem": 0,
		"mem_used": 0,
		"mem_usage": 0,
		"mem_unit": 'GiB',
		"temp": 0,
		"temp_unit": temp_unit,
		"power_usage": 0,
		"power_limit": 0,
		"power_unit": 'W',
		"mem_clock": 0,
		"mem_clock_max": 0,
		"clock": 0,
		"clock_max": 0,
		"clock_unit": "Mhz"
	};
}

GPUMeter.createGPU = function (temp_unit) {
	return {
		"name": "Unknown",
		"model_id": "",
		"vendor": "-",
		"vendor_id": "",
		"device": {
			"name": "",
			"path": "",
			"boot_vga": "",
			"modalias": "",
			"uevent": "",
			"sensors": [],
			"power_sensor": null,
			"temp_sensor": null,
			"pcie_id": "-", 
			"is_boot_vga": false,
		},
		"stats": GPUMeter.createStats(temp_unit)
	}
}

GPUMeter.getAMDSensors = function (gpu, namespace) {
	return FactoryModule.AbstractFactory.create('file', namespace, gpu.device.path + "device/hwmon/").list();
}

GPUMeter._getAMDSensorsWithPath = function (sensors, paths, namespace) {
	return new Promise(resolve => {
		let promises = [];
		paths.foreach(path => promises.push(FactoryModule.AbstractFactory.create('file', namespace, path).exists()));
		Promise.all(promises).then(bools => {
			resolve(sensors.filter((sensor, i) => bools[i]));
		});
	});
}

GPUMeter._setAMDSensor = function (gpu, sensors, key) {
	if (sensors.length === 1) {
		gpu.device[key] = sensors[0];
	} else if (sensors.length > 1) {
		log("GPU[" + gpu.name + "]: " + "Multiple " + "s found, selecting one!");
		gpu.device[key] = sensors[0];
	}
}

GPUMeter.setAMDPowerSensor = function (gpu, namespace) {
	let device = gpu.device;
	let paths = device.sensors.map(sensor => device.path + "device/hwmon/" + sensor + "power1_input");
	return new Promise(resolve => {
		GPUMeter._getAMDSensorsWithPath(device.sensors, paths, namespace).then(sensors => {
			if (sensors.length) {
				resolve(GPUMeter._setAMDSensor(gpu, sensors, "power_sensor"));
			} else {
				log("GPU[" + gpu.name + "]: " + "No instant power sensors found!");
				paths = device.sensors.map(sensor => device.path + "device/hwmon/" + sensor + "power1_average");
				GPUMeter._getAMDSensorsWithPath(device.sensors, paths, namespace).then(sensor => {
					return GPUMeter.setAMDSensor(gpu, sensors, "power_sensor");
				});
			}
		});
	});
}

GPUMeter.setAMDTempSensor = function (gpu, namespace) {
	let paths = gpu.device.sensors.map(sensor => gpu.device.path + "device/hwmon/" + sensor + "temp1_input");
	return GPUMeter._getAMDSensorsWithPath(gpu.device.sensors, paths, namespace).then(sensors => {
		return GPUMeter._setAMDSensor(gpu, sensors);
	});
}

GPUMeter.loadGPUs = async function (temp_unit) {
	let gpus = [];
	const num_regex = new RegExp("[0-9]+$");
	const namespace = this;

	let getBootVGA = function (gpu) {
		return FactoryModule.AbstractFactory.create('file', namespace, gpu.device.boot_vga).read()
			.then(contents => contents.trim() === "1")
			.catch(e => { 
				log(e);
				return false;
			});
	};

	let loadInfo = async function (gpu) {
		id_promise = Util.pcieID(gpu.device.uevent, gpu.device.name).catch(e => "-");
		info = await Util.deviceInfo(gpu.device.modalias, namespace, gpu.device.name);
		
		info = Util.formatDeviceInfo(info);
		gpu.name = info.model_name;
		gpu.model_id = info.model_id;
		gpu.vendor = info.vendor_name;
		gpu.vendor_id = info.vendor_id;
		gpu.device.pcie_id = await id_promise;

		log("GPU: vendor_id: " + info.vendor_id + ", vendor_name: " + info.vendor_name +
			", model_id: " + info.model_id + ", model_name: " + info.model_name +
			", pcie_id: " + gpu.device.pcie_id);
		
		return gpu;
	};

	names = await FactoryModule.AbstractFactory.create('file', this, '/sys/class/drm/').list();

	for (fn of names) {
		if (!fn.includes("-") && fn.replace(num_regex, "") === "card") {
			let gpu = GPUMeter.createGPU(temp_unit);
			gpu.device.name = fn;
			gpu.device.path = "/sys/class/drm/";
			gpu.device.boot_vga = "/sys/class/drm/" + fn + "/device/" + "boot_vga";
			gpu.device.modalias = "/sys/class/drm/" + fn + "/device/" + "modalias";
			gpu.device.uevent = "/sys/class/drm/" + fn + "/device/" + "uevent";
			gpus.push(gpu);
		}
	}

	if (gpus.length == 1) {
		gpus[0].device.is_boot_vga = true;
		await loadInfo(gpus[0]);
	} else {
		// Fixme: unable to get promise.all() to work
		for (let gpu of gpus) {
			gpu.device.is_boot_vga = await getBootVGA(gpu);
			await loadInfo(gpu);
		}
	}
	
	let amd_gpus = gpus.filter(gpu => ["v00001022", "v00001002"].includes(gpu.vendor_id));
	for (let gpu of amd_gpus) {
		gpu.device.sensors = await GPUMeter.getAMDPowerSensors(gpu, namespace);
		await GPUMeter.setAMDPowerSensor(gpu, namespace);
		await GPUMeter.setAMDTempSensor(gpu, namespace);
	}

	GPUMeter.is_nvidia_smi = await FactoryModule.AbstractFactory.create('file', namespace, "/usr/bin/nvidia-smi").exists();
	FactoryModule.AbstractFactory.destroy('file', namespace);

	GPUMeter._gpus = gpus;
	log("GPUs loaded!");
};