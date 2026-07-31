"use strict";

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import * as FactoryModule from './factory.js';
import * as PrefsKeys from './prefs_keys.js';

export const Menu = GObject.registerClass(
class Menu extends PanelMenu.Button {
    constructor(extensionObject, settings) {
        let menuAlignment = 0.5;

        super(menuAlignment);

        this._layout = new St.BoxLayout();
        this._settings = settings;
        this._extensionObject = extensionObject;
        this._icons = {};
        this._meters = {};
        this._meter_widgets = {};
        this._event_handler_ids = [];
        this._indicator_sort_order = 1;
        this.available_meters = [PrefsKeys.CPU_METER, PrefsKeys.MEMORY_METER, PrefsKeys.STORAGE_METER, PrefsKeys.NETWORK_METER, PrefsKeys.SWAP_METER, PrefsKeys.LOAD_METER];
        this._widget_area_container = FactoryModule.AbstractFactory.create('meter-area-widget');
        this._widget_area_container.setOrientation(this._isVerticalLayout() ? Clutter.Orientation.VERTICAL : Clutter.Orientation.HORIZONTAL);
        this.menu.addMenuItem(this._widget_area_container);
        // The popup's actual on-screen position/size is only known once Clutter
        // has run a real layout pass - get_preferred_width() queried synchronously
        // right after we resize a descendant returns a stale cached value, not
        // the post-resize size, so we can't predict the final geometry upfront.
        // Instead, size for the work area optimistically, then correct after
        // the fact against the real allocation if the popup (which adds its own
        // boxpointer arrow/border/padding chrome on top of our content) still
        // doesn't fit. Guarded so our own corrective resize - which triggers
        // another allocation - doesn't re-trigger itself.
        //
        // Which axis is capped depends on the layout setting: horizontal
        // layout lays meters out in columns that can overflow the work area's
        // width, vertical layout stacks them in rows that can instead overflow
        // its height.
        this.menu.actor.connect('notify::allocation', () => {
            if (!this._pending_overflow_check) {
                return;
            }
            this._pending_overflow_check = false;
            let work_area = this._open_work_area;
            if (!work_area) {
                return;
            }
            let box = this.menu.actor.get_allocation_box();
            if (this._isVerticalLayout()) {
                let overflow = Math.max(work_area.y - box.y1, box.y2 - (work_area.y + work_area.height), 0);
                if (overflow > 0) {
                    this._widget_area_container.setMaxHeight(this._widget_area_container.getHeight() - overflow);
                }
            } else {
                let overflow = Math.max(work_area.x - box.x1, box.x2 - (work_area.x + work_area.width), 0);
                if (overflow > 0) {
                    this._widget_area_container.setMaxWidth(this._widget_area_container.getWidth() - overflow);
                }
            }
        });
        this._open_state_change_id = this.menu.connect('open-state-changed', (menu, is_open) => {
            if (is_open) {
                let monitor_index = Main.layoutManager.findIndexForActor(this);
                let work_area = Main.layoutManager.getWorkAreaForMonitor(monitor_index);
                this._open_work_area = work_area;
                this._pending_overflow_check = true;
                if (this._isVerticalLayout()) {
                    this._widget_area_container.setMaxHeight(work_area.height);
                } else {
                    this._widget_area_container.setMaxWidth(work_area.width);
                }
            }
            for (let type in this._meter_widgets) {
                if (is_open) {
                    this._meter_widgets[type].freeze();
                } else {
                    this._meter_widgets[type].unfreeze();
                }
            }
        });
        this.add_child(this._layout);

        this._initIconsAndWidgets();
        this._addPositionSettingChangedHandler();
        this._addLayoutSettingChangedHandler();
        this._addMemoryCalculationSettingChangedHandler();
        this._addShowActivitySettingChangedHandler();
        this._addIndicatorToTopBar(this._settings.get_string(PrefsKeys.POSITION), extensionObject.metadata.uuid);
    }
    _initIconsAndWidgets() {
        for (let index in this.available_meters) {
            let type = this.available_meters[index];
            if (this._settings.get_boolean(type)) {
                let icon = this._createIcon(type);
                this._createMeterWidget(type, icon);
            }
            this._addSettingChangedHandler(type);
        }
    }
    _addIndicatorToTopBar(position, uuid) {
        Main.panel.addToStatusArea(uuid, this, this._indicator_sort_order, position);
        this._indicator_previous_position = position;
    }
    _moveIndicatorOnTopBar(position) {
        // Gnome does not provide a method to remove indicator (opposite to addToStatusArea() method), so this is a workaround.
        switch (this._indicator_previous_position) {
            case 'left':
                Main.panel._leftBox.remove_actor(this.container);
                break;
            case 'center':
                Main.panel._centerBox.remove_actor(this.container);
                break;
            case 'right':
                Main.panel._rightBox.remove_actor(this.container);
                break;
            default:
                throw new Error('Unknown position given: ' + this._indicator_previous_position);
        }

        switch (position) {
            case 'left':
                Main.panel._leftBox.insert_child_at_index(this.container, this._indicator_sort_order);
                break;
            case 'center':
                Main.panel._centerBox.insert_child_at_index(this.container, this._indicator_sort_order);
                break;
            case 'right':
                Main.panel._rightBox.insert_child_at_index(this.container, this._indicator_sort_order);
                break;
            default:
                throw new Error('Unknown position given: ' + position);
        }

        this._indicator_previous_position = position;
    }
    _createIcon(type) {
        let can_show_activity = this._settings.get_boolean(PrefsKeys.SHOW_ACTIVITY);
        let icon = FactoryModule.AbstractFactory.create('icon', type, {}, can_show_activity, this._extensionObject);
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
        return FactoryModule.AbstractFactory.create('icon', type, {}, can_show_activity, this._extensionObject);
    }
    _destroyIcon(type) {
        let icon = this._icons[type];
        this._meters[type].removeObserver(icon);
        this._layout.remove_child(icon);
        icon.destroy();
        delete this._icons[type];
        delete this._meters[type];
    }
    _addSettingChangedHandler(type) {
        let that = this;
        let event_id = this._settings.connect('changed::' + type, function(settings, key) {
            let is_enabled = settings.get_boolean(key);
            if (is_enabled) {
                let icon = that._createIcon(type);
                that._createMeterWidget(type, icon);
            } else {
                that._destroyMeterWidget(type);
                that._destroyIcon(type);
            }
        });
        this._event_handler_ids.push(event_id);
    }
    _addPositionSettingChangedHandler() {
        let that = this;
        let event_id = this._settings.connect('changed::' + PrefsKeys.POSITION, function(settings, key) {
            that._moveIndicatorOnTopBar(settings.get_string(key));
        });
        this._event_handler_ids.push(event_id);
    }
    _addLayoutSettingChangedHandler() {
        let that = this;
        let event_id = this._settings.connect('changed::' + PrefsKeys.LAYOUT, function(settings, key) {
            let orientation = 'vertical' === settings.get_string(key) ? Clutter.Orientation.VERTICAL : Clutter.Orientation.HORIZONTAL;
            that._widget_area_container.setOrientation(orientation);
        });
        this._event_handler_ids.push(event_id);
    }
    _isVerticalLayout() {
        return this._settings.get_string(PrefsKeys.LAYOUT) === 'vertical';
    }
    _addMemoryCalculationSettingChangedHandler() {
        let that = this;
        let event_id = this._settings.connect('changed::' + PrefsKeys.MEMORY_CALCULATION_METHOD, function(settings, key) {
            // Reload the memory meter if it's enabled.
            let type = PrefsKeys.MEMORY_METER;
            if (settings.get_boolean(type)) {
                that._destroyMeterWidget(type);
                that._destroyIcon(type);
                let icon = that._createIcon(type);
                that._createMeterWidget(type, icon);
            }
        });
        this._event_handler_ids.push(event_id);
    }
    _addShowActivitySettingChangedHandler() {
        let event_id = this._settings.connect('changed::' + PrefsKeys.SHOW_ACTIVITY, this._handleActivityChange.bind(this));
        this._event_handler_ids.push(event_id);
    }
    _handleActivityChange(settings, key) {
        let meters = this._meters;
        for (let type in meters) {
            this._destroyMeterWidget(type);
            this._destroyIcon(type);
        }

        this._initIconsAndWidgets();
    }
    _removeAllSettingChangedHandlers() {
        for (let index in this._event_handler_ids) {
            this._settings.disconnect(this._event_handler_ids[index]);
        }
        this._event_handler_ids = [];
    }
    _createMeterWidget(type, icon) {
        let meter_widget = FactoryModule.AbstractFactory.create('meter-widget', type, icon);
        this._meter_widgets[type] = meter_widget;
        this._widget_area_container.addMeter(meter_widget, this.available_meters.indexOf(type));
        this._meters[type].addObserver(meter_widget);
    }
    _destroyMeterWidget(type) {
        let meter_widget = this._meter_widgets[type];
        this._meters[type].removeObserver(meter_widget);
        this._widget_area_container.removeMeter(meter_widget);
        meter_widget.destroy();
        delete this._meter_widgets[type];
    }
    destroy() {
        let meters = this._meters;
        for (let type in meters) {
            meters[type].destroy();
            this._destroyMeterWidget(type);
            this._destroyIcon(type);
        }

        this._removeAllSettingChangedHandlers();
        if (this._open_state_change_id) {
            this.menu.disconnect(this._open_state_change_id);
        }
        super.destroy();
    }
    updateUi() {
        let meters = this._meters;
        for (let type in meters) {
            meters[type].notifyAll();
        }
        return true;
    }
});
