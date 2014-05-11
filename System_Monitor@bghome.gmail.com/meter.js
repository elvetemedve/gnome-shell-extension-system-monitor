const GTop = imports.gi.GTop;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const FactoryModule = Me.imports.factory;

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

	this.notify = function(percent, has_activity) {
		for (let i = 0; i < this.observers.length; i++) {
			this.observers[i].update({percent: percent, has_activity: has_activity});
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
		this.notify(this.calculateUsage(), false);
	}
}

const CpuMeter = function() {
	this.observers = [];
	this._statistics = {cpu:{}};
	this.usage = 0;

	this.loadData = function() {
		let statistics = {cpu:{}};
		let file = FactoryModule.AbstractFactory.create('file', '/proc/stat');
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
};

CpuMeter.prototype = new MeterSubject();


const MemoryMeter = function() {
	this.observers = [];
	this.usage = 0;

	this.loadData = function() {
		let statistics = {};
		let file = FactoryModule.AbstractFactory.create('file', '/proc/meminfo');
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
};

MemoryMeter.prototype = new MeterSubject();


const StorageMeter = function() {
	this.observers = [];

	this.loadData = function() {
		let usage = new GTop.glibtop_fsusage();
		GTop.glibtop_get_fsusage(usage, '/');
		return (usage.blocks - usage.bavail) / usage.blocks * 100;
	}

	this.calculateUsage = function() {
		return this.loadData();
	};
};

StorageMeter.prototype = new MeterSubject();


const NetworkMeter = function() {
	this.observers = [];
	this._statistics = {};
	this._bandwidths = {};

	this.loadData = function() {
		let statistics = {};
		let interfaces_directory = FactoryModule.AbstractFactory.create('file', '/sys/class/net');

		for (let device_name of interfaces_directory.list()) {
			let file = FactoryModule.AbstractFactory.create('file', '/sys/class/net/' + device_name + '/operstate');
			if (file.getContents().trim() == 'up') {
				statistics[device_name] = {};
				file = FactoryModule.AbstractFactory.create('file', '/sys/class/net/' + device_name + '/statistics/rx_bytes');
				statistics[device_name].rx_bytes = parseInt(file.getContents());
				file = FactoryModule.AbstractFactory.create('file', '/sys/class/net/' + device_name + '/statistics/tx_bytes');
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
};

NetworkMeter.prototype = new MeterSubject();


const SwapMeter = function() {
	this.observers = [];

	this.loadData = function() {
		let statistics = {};
		let file = FactoryModule.AbstractFactory.create('file', '/proc/meminfo');
		let columns = ['swaptotal','swapfree'];
		
		for (let index in columns) {
			statistics[columns[index]] = parseInt(file.getContents().match(new RegExp(columns[index] + '.*?(\\d+)', 'i')).pop());
		}
		return statistics;
	};

	this.calculateUsage = function() {
		let stat = this.loadData();
		let used = stat.swaptotal - stat.swapfree;
		this.usage = used / stat.swaptotal * 100;
		return this.usage;
	};
};

SwapMeter.prototype = new MeterSubject();


const SystemLoadMeter = function() {
	this.observers = [];
	this._number_of_cpu_cores = null;

	this._getNumberOfCPUCores = function() {
		if (this._number_of_cpu_cores == null) {
			let file = FactoryModule.AbstractFactory.create('file', '/proc/cpuinfo');
			this._number_of_cpu_cores = file.getContents().match(new RegExp('^processor', 'gm')).length;
		}

		return this._number_of_cpu_cores;
	};

	this.loadData = function() {
		let statistics = {};
		let file = FactoryModule.AbstractFactory.create('file', '/proc/loadavg');
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
};

SystemLoadMeter.prototype = new MeterSubject();