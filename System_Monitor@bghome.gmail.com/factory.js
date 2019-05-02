const Me = imports.misc.extensionUtils.getCurrentExtension();
const IndicatorModule = Me.imports.indicator;
const MeterModule = Me.imports.meter;
const FileModule = Me.imports.helpers.file;
const Widget = Me.imports.widget;
const Util = Me.imports.util;

const Gio = imports.gi.Gio;
const PrefsKeys = Me.imports.prefs_keys;

var AbstractFactory = (function() {

    var types = {};

    return {
    	// Additional arguments will be passed to the registered object.
        create: function (type) {
            var Class = types[type];
            if (Class) {
            	var factory = new Class();
            	var args = Array.slice(arguments)
            	args.shift();
            	return factory.create.apply(factory, args);
			}

            throw new RangeError('Unknown factory type"' + type + '" given.');
        },

        destroy: function (type) {
            var Class = types[type];
            if (Class) {
            	var factory = new Class();
            	var args = Array.slice(arguments)
            	args.shift();
            	return factory.destroy.apply(factory, args);
			}

            throw new RangeError('Unknown factory type"' + type + '" given.');
        },

 		// Register an object factory.
        registerObject: function(type, Class) {
            types[type] = Class;
            return AbstractFactory;
        }
    };
})();

const IconFactory = function() {};

IconFactory.prototype.concreteClass = IndicatorModule.Icon;

// Create an indicator icon object, options will be passed to the real object's constructor.
//
// For working with themed icons see http://standards.freedesktop.org/icon-theme-spec/icon-theme-spec-latest.html
IconFactory.prototype.create = function(type, options, can_show_activity) {
	let default_options = {
		style_class: 'system-status-icon system-monitor-icon',
		reactive: true,
		can_focus: true,
		track_hover: true
	}

	let constructor_options = Object.assign(default_options, options);

	if (type == PrefsKeys.STORAGE_METER) {
		constructor_options.icon_name = 'drive-harddisk-symbolic';
	} else if (type == PrefsKeys.NETWORK_METER) {
		constructor_options.icon_name = 'network-workgroup-symbolic';
	} else if (type == PrefsKeys.LOAD_METER) {
		constructor_options.icon_name = 'computer-symbolic';
	} else if (type == PrefsKeys.CPU_METER) {
        let path = Me.dir.get_path() + '/icons/hicolor/scalable/devices/cpu-symbolic.svg';
		constructor_options.gicon = Gio.icon_new_for_string(path);
	} else if (type == PrefsKeys.MEMORY_METER) {
        let path = Me.dir.get_path() + '/icons/hicolor/scalable/devices/memory-symbolic.svg';
		constructor_options.gicon = Gio.icon_new_for_string(path);
	} else if (type == PrefsKeys.SWAP_METER) {
		constructor_options.icon_name = 'media-removable-symbolic';
	} else {
		throw new RangeError('Unknown indicator type "' + type + '" given.');
	}

    let range = [
        { red:190, green: 190, blue: 190 },
        { red:255, green: 204, blue: 0 },
        { red:255, green: 0, blue: 0 }
    ];
	let caution_class = 'indicator-caution';

	return new IconFactory.prototype.concreteClass(constructor_options, range, caution_class, can_show_activity);
};

AbstractFactory.registerObject('icon', IconFactory);


const MeterFactory = function() {};

MeterFactory.prototype.create = function(type, options) {
	var class_name;
	if (type == PrefsKeys.CPU_METER) {
		class_name = MeterModule.CpuMeter;
	} else if (type == PrefsKeys.MEMORY_METER) {
		class_name = MeterModule.MemoryMeter;
	} else if (type == PrefsKeys.STORAGE_METER) {
		class_name = MeterModule.StorageMeter;
	} else if (type == PrefsKeys.NETWORK_METER) {
		class_name = MeterModule.NetworkMeter;
	} else if (type == PrefsKeys.SWAP_METER) {
		class_name = MeterModule.SwapMeter;
	} else if (type == PrefsKeys.LOAD_METER) {
		class_name = MeterModule.SystemLoadMeter;
	} else {
		throw new RangeError('Unknown meter type "' + type + '" given.');
	}

	return new class_name(options);
}

AbstractFactory.registerObject('meter', MeterFactory);


const FileFactory = (function() {
	var openedFiles = {};

	return function() {
		this.create = function(namespace, filename) {
			if (!openedFiles[namespace]) {
				openedFiles[namespace] = {};
			}

			let openedFilesInNs = openedFiles[namespace];
			let file = openedFilesInNs[filename];

			if (!!file) {
				return file;
			}

			file = new FileModule.File(filename);
            openedFilesInNs[filename] = file;
			return file;
		},

		this.destroy = function(namespace) {
            let files = openedFiles[namespace];
			for (let filename in files) {
                delete files[filename];
			}
		}
	};
})();

AbstractFactory.registerObject('file', FileFactory);


const MeterAreaWidgetFactory = function() {};

MeterAreaWidgetFactory.prototype.create = function(options) {
    return new Widget.MeterAreaContainer();
}

AbstractFactory.registerObject('meter-area-widget', MeterAreaWidgetFactory);


const MeterWidgetFactory = function() {};

MeterWidgetFactory.prototype.create = function(type, icon) {
	let title, meter_widget;
	if (type == PrefsKeys.CPU_METER) {
		title = 'CPU';
        meter_widget = new Widget.ProcessItemsContainer();
	} else if (type == PrefsKeys.MEMORY_METER) {
		title = 'RAM';
        meter_widget = new Widget.ProcessItemsContainer();
	} else if (type == PrefsKeys.STORAGE_METER) {
		title = 'Storage';
        meter_widget = new Widget.DirectoriesContainer();
	} else if (type == PrefsKeys.NETWORK_METER) {
		title = 'Network';
        meter_widget = new Widget.NetworkInterfaceItemsContainer();
	} else if (type == PrefsKeys.SWAP_METER) {
		title = 'Virtual memory';
        meter_widget = new Widget.ProcessItemsContainer();
	} else if (type == PrefsKeys.LOAD_METER) {
		title = 'System load';
        meter_widget = new Widget.SystemLoadItemsContainer();
	} else {
		throw new RangeError('Unknown meter type "' + type + '" given.');
	}

    meter_widget.addTitleItem(new Widget.ResourceTitleItem(title, icon, 'loading...'));
    for (var i = 0; i < 3; i++) {
        meter_widget.addMenuItem(AbstractFactory.create('meter-widget-item', type));
    }
	return meter_widget;
}

AbstractFactory.registerObject('meter-widget', MeterWidgetFactory);


const MeterWidgetItemFactory = function() {};

MeterWidgetItemFactory.prototype.create = function(type) {
	switch (type) {
        case PrefsKeys.CPU_METER:
        case PrefsKeys.MEMORY_METER:
        case PrefsKeys.SWAP_METER:
            return new Widget.ProcessItem('loading...', "edit-delete-symbolic", function(actor, event, state) {
                log('Process called "{name}" with PID {pid} is going to be killed by user resuest.'.replace('{name}', state.command).replace('{pid}', state.pid));
                (new Util.Process(state.pid)).kill();
            });

        case PrefsKeys.NETWORK_METER:
            return new Widget.InterfaceItem('loading...');

        case PrefsKeys.STORAGE_METER:
            return new Widget.MountItem('loading...');

        case PrefsKeys.LOAD_METER:
            return new Widget.StateItem('loading...');

        default:
            throw new RangeError('Unknown meter type "' + type + '" given.');
    }
}

AbstractFactory.registerObject('meter-widget-item', MeterWidgetItemFactory);
