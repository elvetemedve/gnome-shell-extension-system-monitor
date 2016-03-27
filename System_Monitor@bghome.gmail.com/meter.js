const GTop = imports.gi.GTop;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const FactoryModule = Me.imports.factory;
const Util = Me.imports.util;

function MeterSubject() {
	this.observers = [];

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

	this.notify = function(percent, processes, system_load, directories) {
		for (let i = 0; i < this.observers.length; i++) {
			this.observers[i].update(
				{
					percent: percent,
					processes: processes,
					system_load: system_load,
					directories: directories
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
		this.notify(
			this.calculateUsage(),
			this.getProcesses(),
			this.getSystemLoad(),
			this.getDirectories()
		);
	}
};

/**
 * Calculate the resource usage and return a percentage value.
 */
MeterSubject.prototype.calculateUsage = function() {
	return 0.0;
};

/**
 * Return the list of processed associated by the measured resource.
 *
 * The returned array expected to be sorted by usage and be in descending order.
 * A process object should be like this:
 * { "command": "/path/to/binary", "id": 123 }
 */
MeterSubject.prototype.getProcesses = function() {
	return [];
};

/**
 * Return information about system load.
 *
 * See the method body for expected data structure.
 */
MeterSubject.prototype.getSystemLoad = function() {
	return {
		'running_tasks_count': 0,
		'tasks_count': 0,
		'load_average_1': 0,
		'load_average_5': 0,
		'load_average_15': 0
	};
};

/**
 * Return the list of examined directories.
 *
 * A directory item should be like this:
 * { "name": "/tmp", "free_size": 12345 }
 * where "free_size" is in bytes.
 */
MeterSubject.prototype.getDirectories = function() {
	return [];
};

MeterSubject.prototype.destroy = function() {};

const CpuMeter = function() {
	this.observers = [];
	this._statistics = {cpu:{}};
	this.usage = 0;

	this.loadData = function() {
		let statistics = {cpu:{}};
		let file = FactoryModule.AbstractFactory.create('file', this, '/proc/stat');
		let reverse_data = file.getContents().match(/^cpu.+/)[0].match(/\d+/g).reverse();
		let columns = ['user','nice','system','idle','iowait','irq','softirq','steal','guest','guest_nice'];
		for (let index in columns) {
			statistics.cpu[columns[index]] = parseInt(reverse_data.pop());
		}
		return statistics;
	};

	this.calculateUsage = function() {
		let stat = this.loadData();
		let periods = {cpu:{}};
		let time_calculator = function(stat) {
			let result = {};
			result.user = stat.user - stat.guest || 0;
			result.nice = stat.nice - stat.guest_nice || 0;
			result.virtall = stat.guest + stat.guest_nice || 0;
			result.systemall = stat.system + stat.irq + stat.softirq || 0;
			result.idleall = stat.idle + stat.iowait || 0;
			result.guest = stat.guest || 0;
			result.steal = stat.steal || 0;
			result.total = result.user + result.nice + result.systemall + result.idleall + stat.steal + result.virtall || 0;
			return result;
		};
		let usage_calculator = function(periods) {
			return (periods.user + periods.nice + periods.systemall + periods.steal + periods.guest) / periods.total * 100;
		};

		let times = time_calculator(stat.cpu), previous_times = time_calculator(this._statistics.cpu);
		this._statistics = stat;
		for (let index in times) {
			periods.cpu[index] = times[index] - previous_times[index];
		}

		this.usage = usage_calculator(periods.cpu);
		return this.usage;
	};

	this.getProcesses = function() {
		let processes = new Util.Processes;
		let process_ids = processes.getIds();
		let process_time = new GTop.glibtop_proc_time();
		let process_stats = [];
		for (let i = 0; i < process_ids.length; i++) {
			GTop.glibtop_get_proc_time(process_time, process_ids[i]);
			process_stats.push ({"pid": process_ids[i], "time": process_time.rtime});
		}

		return processes.getTopProcesses(process_stats, "time", 3);
	};

	this.destroy = function() {
		FactoryModule.AbstractFactory.destroy('file', this);
	};
};

CpuMeter.prototype = new MeterSubject();


const MemoryMeter = function() {
	this.observers = [];
	this.usage = 0;

	this.loadData = function() {
		let statistics = {};
		let file = FactoryModule.AbstractFactory.create('file', this, '/proc/meminfo');
		let columns = ['memtotal','memfree','buffers','cached'];

		for (let index in columns) {
			statistics[columns[index]] = parseInt(file.getContents().match(new RegExp(columns[index] + '.*?(\\d+)', 'i')).pop());
		}
		return statistics;
	};

	this.calculateUsage = function() {
		let stat = this.loadData();
		let used = stat.memtotal - stat.memfree - stat.buffers - stat.cached;
		this.usage = used / stat.memtotal * 100;
		return this.usage;
	};

	this.getProcesses = function() {
		let processes = new Util.Processes;
		let process_ids = processes.getIds();
		let process_memory = new GTop.glibtop_proc_mem();
		let process_stats = [];
		for (let i = 0; i < process_ids.length; i++) {
			GTop.glibtop_get_proc_mem(process_memory, process_ids[i]);
			process_stats.push (
				{
					"pid": process_ids[i],
					"memory": process_memory.vsize + process_memory.resident + process_memory.share
				}
			);
		}

		return processes.getTopProcesses(process_stats, "memory", 3);
	};

	this.destroy = function() {
		FactoryModule.AbstractFactory.destroy('file', this);
	};
};

MemoryMeter.prototype = new MeterSubject();


const StorageMeter = function() {
	this.observers = [];
	let mount_entry = new RegExp('^\\S+\\s+(\\S+)\\s+(\\S+)');
	let fs_types_to_measure = [
		'btrfs', 'exfat', 'ext2', 'ext3', 'ext4', 'f2fs',
	 	'hfs', 'jfs', 'nilfs2', 'ntfs', 'reiser4', 'reiserfs', 'vfat', 'xfs',
		'zfs'
	];

	this.loadData = function() {
		let usage = new GTop.glibtop_fsusage();
		GTop.glibtop_get_fsusage(usage, '/');
		return (usage.blocks - usage.bavail) / usage.blocks * 100;
	}

	this.calculateUsage = function() {
		return this.loadData();
	};

	this.getDirectories = function() {
		let directories = new Util.Directories;
		let usage = new GTop.glibtop_fsusage();
		let file = FactoryModule.AbstractFactory.create('file', this, '/proc/mounts');
		let mount_list = file.getContents().split("\n");
		mount_list.splice(-2);	// remove the last two empty lines
		let directory_stats = [];
		for (let i = 0; i < mount_list.length; i++) {
			[, mount_dir, fs_type] = mount_list[i].match(mount_entry);
			if (fs_types_to_measure.indexOf(fs_type) == -1) {
				continue;
			}
			GTop.glibtop_get_fsusage(usage, mount_dir);
			directory_stats.push({
				'name': mount_dir,
				'free_size': usage.bavail * usage.block_size
			});
		}

		return directories.getTopDirectories(directory_stats, 'free_size', 3);
	};
};

StorageMeter.prototype = new MeterSubject();


const NetworkMeter = function() {
	this.observers = [];
	this._statistics = {};
	this._bandwidths = {};

	this.loadData = function() {
		let statistics = {};
		let interfaces_directory = FactoryModule.AbstractFactory.create('file', this, '/sys/class/net');

		for (let device_name of interfaces_directory.list()) {
			let file = FactoryModule.AbstractFactory.create('file', this, '/sys/class/net/' + device_name + '/operstate');
			if (file.getContents().trim() == 'up') {
				statistics[device_name] = {};
				file = FactoryModule.AbstractFactory.create('file', this, '/sys/class/net/' + device_name + '/statistics/rx_bytes');
				statistics[device_name].rx_bytes = parseInt(file.getContents());
				file = FactoryModule.AbstractFactory.create('file', this, '/sys/class/net/' + device_name + '/statistics/tx_bytes');
				statistics[device_name].tx_bytes = parseInt(file.getContents());
			}
		}

		return statistics;
	};

	this.calculateUsage = function() {
		let statistics = this.loadData();

		let calculate_speeds = function(statistics) {
			let speeds = {};
			for (let index in statistics) {
				speeds[index] = {};
				speeds[index].upload = statistics[index].tx_bytes - (this._statistics[index] != undefined ? this._statistics[index].tx_bytes : statistics[index].tx_bytes);
				speeds[index].download = statistics[index].rx_bytes - (this._statistics[index] != undefined ? this._statistics[index].rx_bytes : statistics[index].rx_bytes);
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

		let speeds = calculate_speeds.call(this, statistics);
		this._bandwidths = calculate_bandwidths.call(this, speeds);
		let usages = calculate_interface_usages.call(this, speeds);
		let sum_percent = 0;
		for (let index in usages) {
			sum_percent += usages[index];
		}
		let total = Object.keys(usages).length * 100 || 1;

		this._statistics = statistics;

		return Math.round(sum_percent / total * 100);
	};

	this.destroy = function() {
		FactoryModule.AbstractFactory.destroy('file', this);
	};
};

NetworkMeter.prototype = new MeterSubject();


const SwapMeter = function() {
	this.observers = [];

	this.loadData = function() {
		let statistics = {};
		let file = FactoryModule.AbstractFactory.create('file', this, '/proc/meminfo');
		let columns = ['swaptotal','swapfree'];

		for (let index in columns) {
			statistics[columns[index]] = parseInt(file.getContents().match(new RegExp(columns[index] + '.*?(\\d+)', 'i')).pop());
		}
		return statistics;
	};

	this.calculateUsage = function() {
		let stat = this.loadData();
		let used = stat.swaptotal - stat.swapfree;
		this.usage = stat.swaptotal == 0 ? 0 : used / stat.swaptotal * 100;
		return this.usage;
	};

	this.getProcesses = function() {
		let processes = new Util.Processes;
		let process_ids = processes.getIds();
		let process_stats = [];
		for (let i = 0; i < process_ids.length; i++) {
			let number_of_pages_swapped;
			try {
				let file = FactoryModule.AbstractFactory.create('file', this, '/proc/' + process_ids[i] + '/stat');
				number_of_pages_swapped = parseInt(file.getContents().split(' ')[35]);
			} catch (e) {
				number_of_pages_swapped = 0;
			}

			if (number_of_pages_swapped > 0) {
				process_stats.push (
					{
						"pid": process_ids[i],
						"memory": number_of_pages_swapped
					}
				);
			}
		}

		return processes.getTopProcesses(process_stats, "memory", 3);
	};

	this.destroy = function() {
		FactoryModule.AbstractFactory.destroy('file', this);
	};
};

SwapMeter.prototype = new MeterSubject();


const SystemLoadMeter = function() {
	this.observers = [];
	this._number_of_cpu_cores = null;

	this._getNumberOfCPUCores = function() {
		if (this._number_of_cpu_cores == null) {
			let file = FactoryModule.AbstractFactory.create('file', this, '/proc/cpuinfo');
			this._number_of_cpu_cores = file.getContents().match(new RegExp('^processor', 'gm')).length;
		}

		return this._number_of_cpu_cores;
	};

	this.loadData = function() {
		let statistics = {};
		let file = FactoryModule.AbstractFactory.create('file', this, '/proc/loadavg');
		let reverse_data = file.getContents().split(' ').reverse();
		let columns = ['oneminute'];

		for (let index in columns) {
			statistics[columns[index]] = parseFloat(reverse_data.pop());
		}
		return statistics;
	};

	this.calculateUsage = function() {
		let stat = this.loadData();
		this.usage = stat.oneminute / this._getNumberOfCPUCores() * 100;
		this.usage = this.usage > 100 ? 100 : this.usage;
		return this.usage;
	};

	this.getSystemLoad = function() {
		let load = new GTop.glibtop_loadavg();
		GTop.glibtop_get_loadavg(load);
		return {
			'running_tasks_count': load.nr_running,
			'tasks_count': load.nr_tasks,
			'load_average_1': load.loadavg[0],
			'load_average_5': load.loadavg[1],
			'load_average_15': load.loadavg[2]
		};
	};

	this.destroy = function() {
		FactoryModule.AbstractFactory.destroy('file', this);
	};
};

SystemLoadMeter.prototype = new MeterSubject();
