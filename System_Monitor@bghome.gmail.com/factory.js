const Me = imports.misc.extensionUtils.getCurrentExtension();
const IndicatorModule = Me.imports.indicator;
const MeterModule = Me.imports.meter;
const FileModule = Me.imports.file;

const Lang = imports.lang;
const Gio = imports.gi.Gio;


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
	
	if (type == 'storage') {
		constructor_options.icon_name = 'drive-harddisk-symbolic';
	} else if (type == 'network') {
		constructor_options.icon_name = 'network-workgroup-symbolic';
	} else if (type == 'load') {
		constructor_options.icon_name = 'computer-symbolic';
	} else if (type == 'cpu') {
		constructor_options.gicon = Gio.icon_new_for_string(Me.path + "/icons/scalable/cpu-symbolic.svg");
	} else if (type == 'memory') {
		constructor_options.gicon = Gio.icon_new_for_string(Me.path + "/icons/scalable/memory-symbolic.svg");
	} else if (type == 'swap') {
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
	if (type == 'cpu') {
		class_name = MeterModule.CpuMeter;
	} else if (type == 'memory') {
		class_name = MeterModule.MemoryMeter;
	} else if (type == 'storage') {
		class_name = MeterModule.StorageMeter;
	} else if (type == 'network') {
		class_name = MeterModule.NetworkMeter;		
	} else if (type == 'swap') {
		class_name = MeterModule.SwapMeter;
	} else if (type == 'load') {
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
		this.create = function(filename) {
			let file = openedFiles[filename];

			if (!!file) {
				return file;
			}

			file = new FileModule.File(filename);
			openedFiles[filename] = file;
			return file;
		}
	};
})();

AbstractFactory.registerObject('file', FileFactory);