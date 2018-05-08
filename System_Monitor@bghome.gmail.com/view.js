const Lang = imports.lang;
const Panel = imports.ui.main.panel;
const PanelMenu = imports.ui.panelMenu;
const St = imports.gi.St;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const FactoryModule = Me.imports.factory;
const Convenience = Me.imports.convenience;
const PrefsKeys = Me.imports.prefs_keys;

var Menu = new Lang.Class({
    Name: 'Menu',
    Extends: PanelMenu.Button,
    _icons: {},
    _meters: {},
    _meter_widgets: {},
    _event_handler_ids: [],

    _init: function() {
    	let menuAlignment = 0.5;
        this.parent(menuAlignment);
    	this._layout = new St.BoxLayout();
        this._settings = Convenience.getSettings();
        this._indicator_sort_order = 1;
        this.available_meters = [PrefsKeys.CPU_METER, PrefsKeys.MEMORY_METER, PrefsKeys.STORAGE_METER, PrefsKeys.NETWORK_METER, PrefsKeys.SWAP_METER, PrefsKeys.LOAD_METER];

        this._widget_area_container = FactoryModule.AbstractFactory.create('meter-area-widget');
        this._widget_area_container.vertical = this._settings.get_string(PrefsKeys.LAYOUT) === 'vertical';
        this.menu.box.add_child(this._widget_area_container);

        this._initIconsAndWidgets();

        this._addPositionSettingChangedHandler();
        this._addLayoutSettingChangedHandler();
        this._addMemoryCalculationSettingChangedHandler();
        this._addShowActivitySettingChangedHandler();

    	this.actor.add_actor(this._layout);

        this._addIndicatorToTopBar(this._settings.get_string(PrefsKeys.POSITION));
    },
    _initIconsAndWidgets: function() {
        for (let index in this.available_meters) {
            let type = this.available_meters[index];
            if (this._settings.get_boolean(type)) {
                let icon = this._createIcon(type);
                this._createMeterWidget(type, icon);
            }
            this._addSettingChangedHandler(type);
        }
    },
    _addIndicatorToTopBar: function(position) {
        Panel.addToStatusArea(Me.metadata.uuid, this, this._indicator_sort_order, position);
        this._indicator_previous_position = position;
    },
    _moveIndicatorOnTopBar: function(position) {
        // Gnome does not provide a method to remove indicator (opposite to addToStatusArea() method), so this is a workaround.
        switch (this._indicator_previous_position) {
            case 'left':
                Panel._leftBox.remove_actor(this.container);
                break;
            case 'center':
                Panel._centerBox.remove_actor(this.container);
                break;
            case 'right':
                Panel._rightBox.remove_actor(this.container);
                break;
            default:
                throw new Error('Unknown position given: ' + this._indicator_previous_position);
        }

        switch (position) {
            case 'left':
                Panel._leftBox.insert_child_at_index(this.container, this._indicator_sort_order);
                break;
            case 'center':
                Panel._centerBox.insert_child_at_index(this.container, this._indicator_sort_order);
                break;
            case 'right':
                Panel._rightBox.insert_child_at_index(this.container, this._indicator_sort_order);
                break;
            default:
                throw new Error('Unknown position given: ' + position);
        }

        this._indicator_previous_position = position;
    },
    _createIcon: function(type) {
        let can_show_activity = this._settings.get_boolean(PrefsKeys.SHOW_ACTIVITY);
        let icon = FactoryModule.AbstractFactory.create('icon', type, {}, can_show_activity);
        let meter = this._meters[type];

        if (meter == undefined) {
            switch (type) {
                case PrefsKeys.MEMORY_METER:
                    meter = FactoryModule.AbstractFactory.create('meter', type, {
                        calculation_method: this._settings.get_string(PrefsKeys.MEMORY_CALCULATION_METHOD),
                        activity_threshold: 1
                    });
                    break;
                case PrefsKeys.NETWORK_METER:
                    meter = FactoryModule.AbstractFactory.create('meter', type, {
                        refresh_interval: this._settings.get_int(PrefsKeys.REFRESH_INTERVAL),
                        activity_threshold: 10
                    });
                    break;
                default:
                    meter = FactoryModule.AbstractFactory.create('meter', type);
            }
            this._meters[type] = meter;
        }

        meter.addObserver(icon);
        this._layout.insert_child_at_index(icon, this.available_meters.indexOf(type));
        this._icons[type] = icon;
        return icon;
    },
    _destroyIcon: function(type) {
        let icon = this._icons[type];
        this._meters[type].removeObserver(icon);
        this._layout.remove_actor(icon);
        icon.destroy();
        delete this._icons[type];
        delete this._meters[type];
    },
    _addSettingChangedHandler: function(type) {
        let event_id = this._settings.connect('changed::' + type, Lang.bind(this, function(settings, key) {
            let is_enabled = settings.get_boolean(key);
            if (is_enabled) {
                let icon = this._createIcon(type);
                this._createMeterWidget(type, icon);
            } else {
                this._destroyIcon(type);
                this._destroyMeterWidget(type);
            }
        }));
        this._event_handler_ids.push(event_id);
    },
    _addPositionSettingChangedHandler: function() {
        let event_id = this._settings.connect('changed::' + PrefsKeys.POSITION, Lang.bind(this, function(settings, key) {
            this._moveIndicatorOnTopBar(settings.get_string(key));
        }));
        this._event_handler_ids.push(event_id);
    },
    _addLayoutSettingChangedHandler: function() {
        let event_id = this._settings.connect('changed::' + PrefsKeys.LAYOUT, Lang.bind(this, function(settings, key) {
            let isVertical = 'vertical' === settings.get_string(key);
            this._widget_area_container.vertical = isVertical;
        }));
        this._event_handler_ids.push(event_id);
    },
    _addMemoryCalculationSettingChangedHandler: function() {
        let event_id = this._settings.connect('changed::' + PrefsKeys.MEMORY_CALCULATION_METHOD, Lang.bind(this, function(settings, key) {
            // Reload the memory meter if it's enabled.
            let type = PrefsKeys.MEMORY_METER;
            if (settings.get_boolean(type)) {
                this._destroyIcon(type);
                this._destroyMeterWidget(type);
                let icon = this._createIcon(type);
                this._createMeterWidget(type, icon);
            }
        }));
        this._event_handler_ids.push(event_id);
    },
    _addShowActivitySettingChangedHandler: function() {
        let event_id = this._settings.connect('changed::' + PrefsKeys.SHOW_ACTIVITY, Lang.bind(this, function(settings, key) {
            let meters = this._meters;
            for (let type in meters) {
                this._destroyIcon(type);
                this._destroyMeterWidget(type);
            }

            this._initIconsAndWidgets();
        }));
        this._event_handler_ids.push(event_id);
    },
    _removeAllSettingChangedHandlers: function() {
        for (let index in this._event_handler_ids) {
            this._settings.disconnect(this._event_handler_ids[index]);
        }
    },
    _createMeterWidget: function(type, icon) {
        let meter_widget = FactoryModule.AbstractFactory.create('meter-widget', type, icon);
        this._meter_widgets[type] = meter_widget;
        this._widget_area_container.addMeter(meter_widget, this.available_meters.indexOf(type));
        this._meters[type].addObserver(meter_widget);
    },
    _destroyMeterWidget: function(type) {
        let meter_widget = this._meter_widgets[type];
        if (this._meters[type]) {
            this._meters[type].removeObserver(meter_widget);
        }
        this._widget_area_container.removeMeter(meter_widget);
        delete this._meter_widgets[type];
        meter_widget.destroy();
    },
    destroy: function() {
        let meters = this._meters;
        for (let type in meters) {
            meters[type].destroy();
            this._destroyIcon(type);
            this._destroyMeterWidget(type);
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
