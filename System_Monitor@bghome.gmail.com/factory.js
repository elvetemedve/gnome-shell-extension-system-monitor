const Me = imports.misc.extensionUtils.getCurrentExtension();
const IndicatorModule = Me.imports.indicator;
const MeterModule = Me.imports.meter;
const FileModule = Me.imports.file;

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
            
            throw 'Unknown factory type"' + type + '" given.';
        },

        destroy: function (type) {
            var Class = types[type];
            if (Class) {
            	var factory = new Class();
            	var args = Array.slice(arguments)
            	args.shift();
            	return factory.destroy.apply(factory, args);
			}
            
            throw 'Unknown factory type"' + type + '" given.';
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
		constructor_options.gicon = Gio.icon_new_for_string(Me.path + "/icons/scalable/cpu-symbolic.svg");
	} else if (type == PrefsKeys.MEMORY_METER) {
		constructor_options.gicon = Gio.icon_new_for_string(Me.path + "/icons/scalable/memory-symbolic.svg");
	} else if (type == PrefsKeys.SWAP_METER) {
		constructor_options.gicon = Gio.icon_new_for_string(Me.path + "/icons/scalable/swap-symbolic.svg");
	} else {
		throw 'Unknown indicator type "' + type + '" given.';
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
		throw 'Unknown meter type "' + type + '" given.';
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