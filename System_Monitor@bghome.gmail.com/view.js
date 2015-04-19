const Lang = imports.lang;
const Panel = imports.ui.main.panel;
const PanelMenu = imports.ui.panelMenu;
const St = imports.gi.St;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const FactoryModule = Me.imports.factory;
const Convenience = Me.imports.convenience;
const PrefsKeys = Me.imports.prefs_keys;

const Menu = new Lang.Class({
    Name: 'Menu',
    Extends: PanelMenu.Button,
    _icons: {},
    _meters: {},
    _event_handler_ids: [],

    _init: function() {
    	let menuAlignment = 0.5;
    	this.parent(menuAlignment);
    	this._layout = new St.BoxLayout();
        this._settings = Convenience.getSettings();
        this.available_meters = [PrefsKeys.CPU_METER, PrefsKeys.MEMORY_METER, PrefsKeys.STORAGE_METER, PrefsKeys.NETWORK_METER, PrefsKeys.SWAP_METER, PrefsKeys.LOAD_METER];

        let widget_area_container = FactoryModule.AbstractFactory.create('meter-area-widget');
        this.menu.box.add_child(widget_area_container);

        for (let index in this.available_meters) {
            let type = this.available_meters[index];
            if (this._settings.get_boolean(type)) {
                this._createIcon(type);
                this._createMeterWidget(widget_area_container, type);
            }
            this._addSettingChangedHandler(type);
        }

    	this.actor.add_actor(this._layout);

    	Panel.addToStatusArea('system-monitor', this, 1, 'center');
    },
    _createIcon: function(type) {
        let icon = FactoryModule.AbstractFactory.create('icon', type);
        let meter = this._meters[type];

        if (meter == undefined) {
            meter = FactoryModule.AbstractFactory.create('meter', type);
            this._meters[type] = meter;
        }

        meter.addObserver(icon);
        this._layout.insert_child_at_index(icon, this.available_meters.indexOf(type));
        this._icons[type] = icon;
    },
    _destroyIcon: function(type) {
        let icon = this._icons[type];
        this._meters[type].removeObserver(icon);
        this._layout.remove_actor(icon);
        icon.destroy();
        delete this._icons[type];
    },
    _addSettingChangedHandler: function(type) {
        let event_id = this._settings.connect('changed::' + type, Lang.bind(this, function(settings, key) {
            let is_enabled = settings.get_boolean(key);
            if (is_enabled) {
                this._createIcon(type);
            } else {
                this._destroyIcon(type);
            }
        }));
        this._event_handler_ids.push(event_id);
    },
    _removeAllSettingChangedHandlers: function() {
        for (let index in this._event_handler_ids) {
            this._settings.disconnect(this._event_handler_ids[index]);
        }
    },
    _createMeterWidget: function(widget_area_container, type) {
        let meter_widget = FactoryModule.AbstractFactory.create('meter-widget', type);
        widget_area_container.addMeter(meter_widget);
        this._meters[type].addObserver(meter_widget);
    },
    destroy: function() {
        let meters = this._meters;
        for (let type in meters) {
            meters[type].destroy();
        }

        this._removeAllSettingChangedHandlers();
        this.parent();
    },
    updateUi: function () {
        let meters = this._meters;
        for (let type in meters) {
            meters[type].notifyAll();
        }
        return true;
    }
});
