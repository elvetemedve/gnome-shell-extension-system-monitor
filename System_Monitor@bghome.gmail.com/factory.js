const Me = imports.misc.extensionUtils.getCurrentExtension();
const IndicatorModule = Me.imports.indicator;
const MeterModule = Me.imports.meter;
const FileModule = Me.imports.file;
const Widget = Me.imports.widget;

const Lang = imports.lang;
const Gio = imports.gi.Gio;
const PrefsKeys = Me.imports.prefs_keys;

const AbstractFactory = (function() {

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
IconFactory.prototype.create = function(type, options) {

	let default_options = {
		style_class: 'system-status-icon system-monitor-icon',
		reactive: true,
		can_focus: true,
		track_hover: true
	}

	let constructor_options = default_options;
	Lang.copyProperties(options, constructor_options);

	if (type == PrefsKeys.STORAGE_METER) {
		constructor_options.icon_name = 'drive-harddisk-symbolic';
	} else if (type == PrefsKeys.NETWORK_METER) {
		constructor_options.icon_name = 'network-workgroup-symbolic';
	} else if (type == PrefsKeys.LOAD_METER) {
		constructor_options.icon_name = 'computer-symbolic';
	} else if (type == PrefsKeys.CPU_METER) {
		constructor_options.gicon = Gio.icon_new_for_string('cpu-symbolic');
	} else if (type == PrefsKeys.MEMORY_METER) {
		constructor_options.gicon = Gio.icon_new_for_string('memory-symbolic');
	} else if (type == PrefsKeys.SWAP_METER) {
		constructor_options.gicon = Gio.icon_new_for_string('swap-symbolic');
	} else {
		throw new RangeError('Unknown indicator type "' + type + '" given.');
	}

	IconFactory.prototype.concreteClass.initColorRange(
		[
			{ red:190, green: 190, blue: 190 },
			{ red:255, green: 204, blue: 0 },
			{ red:255, green: 0, blue: 0 }
		]
	);

	IconFactory.prototype.concreteClass.initCautionClass('indicator-caution');

	return new IconFactory.prototype.concreteClass(constructor_options);
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

			let file = openedFiles[namespace][filename];

			if (!!file) {
				return file;
			}

			file = new FileModule.File(filename);
			openedFiles[namespace][filename] = file;
			return file;
		},

		this.destroy = function(namespace) {
			for (let filename in openedFiles[namespace]) {
				delete openedFiles[namespace][filename];
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

MeterWidgetFactory.prototype.create = function(type, options) {
	let title;
	if (type == PrefsKeys.CPU_METER) {
		title = 'CPU';
	} else if (type == PrefsKeys.MEMORY_METER) {
		title = 'RAM';
	} else if (type == PrefsKeys.STORAGE_METER) {
		title = 'Storage';
	} else if (type == PrefsKeys.NETWORK_METER) {
		title = 'Network';
	} else if (type == PrefsKeys.SWAP_METER) {
		title = 'Virtual memory';
	} else if (type == PrefsKeys.LOAD_METER) {
		title = 'System load';
	} else {
		throw new RangeError('Unknown meter type "' + type + '" given.');
	}

    let factoryMethod = function(state) {
        return AbstractFactory.create('meter-widget-item', type, state);
    };
    let meter_widget = new Widget.MeterContainer(factoryMethod);

    meter_widget.addTitleItem(new Widget.ResourceTitleItem(title, AbstractFactory.create('icon', type, {icon_size: 32}), 'loading...'));

	return meter_widget;
}

AbstractFactory.registerObject('meter-widget', MeterWidgetFactory);


const MeterWidgetItemFactory = function() {};

MeterWidgetItemFactory.prototype.create = function(type, options) {
	switch (type) {
        case PrefsKeys.CPU_METER:
        case PrefsKeys.MEMORY_METER:
        case PrefsKeys.NETWORK_METER:
        case PrefsKeys.SWAP_METER:
            return new Widget.ProcessItem('/usr/bin/random' + Math.floor( Math.random() * 100 ), "edit-delete-symbolic", function(){log('close has been clicked!')});

        case PrefsKeys.STORAGE_METER:
            return new Widget.MountItem('/dev/sda1');

        case PrefsKeys.LOAD_METER:
            return new Widget.StateItem('5 running tasks');

        default:
            throw new RangeError('Unknown meter type "' + type + '" given.');
    }
}

AbstractFactory.registerObject('meter-widget-item', MeterWidgetItemFactory);
