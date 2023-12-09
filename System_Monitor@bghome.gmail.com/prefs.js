"use strict";

import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as PrefsKeys from './prefs_keys.js';

const Page = GObject.registerClass(
class Page extends Adw.PreferencesPage {
    constructor(title, icon_name) {
        super({
            "title": title,
            "icon_name": icon_name
        });
    }
});

class WidgetBuilder {
    #settings;

    constructor(settings) {
        this.#settings = settings;
    }

    add_boolean(label, key) {
        let item = new Gtk.Switch({
            active: this.#settings.get_boolean(key),
            valign: Gtk.Align.CENTER
        });
        this.#settings.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);

        let row = new Adw.ActionRow({
            title: label,
            activatable_widget: item
        });

        row.add_suffix(item);

        return row;
    }

    add_combo(label, key, list, type) {
        let item = new Gtk.ComboBoxText({
           valign: Gtk.Align.CENTER
        });
        let that = this;

        for(let i = 0; i < list.length; i++) {
            let title = list[i].title.trim();
            let id = list[i].value.toString();
            item.insert(-1, id, title);
        }

        if(type === 'string') {
            item.set_active_id(this.#settings.get_string(key));
        }
        else {
            item.set_active_id(this.#settings.get_int(key).toString());
        }

        item.connect('changed', function(combo) {
            let value = combo.get_active_id();

            if(type === 'string') {
                if(that.#settings.get_string(key) !== value) {
                    that.#settings.set_string(key, value);
                }
            }
            else {
                value = parseInt(value, 10);

                if(that.#settings.get_int(key) !== value) {
                    that.#settings.set_int(key, value);
                }
            }
        });

        let row = new Adw.ActionRow({
            title: label,
            activatable: true
        });

        row.add_suffix(item);

        return row;
    }

    add_spin(label, key, adjustment_properties, spin_properties) {
        let final_adjustment_properties = Object.assign({
            lower: 0,
            upper: 100,
            step_increment: 100
        }, adjustment_properties);
        let adjustment = new Gtk.Adjustment(final_adjustment_properties);

        let final_spin_properties = Object.assign({
            adjustment: adjustment,
            numeric: true,
            snap_to_ticks: true,
            valign: Gtk.Align.CENTER
        }, spin_properties);
        let spin_button = new Gtk.SpinButton(final_spin_properties);
        let that = this;

        spin_button.set_value(this.#settings.get_int(key));
        spin_button.connect('value-changed', function(spin) {
            let value = spin.get_value_as_int();

            if(that.#settings.get_int(key) !== value) {
                that.#settings.set_int(key, value);
            }
        });

        let row = new Adw.ActionRow({
            title: label,
            activatable: true
        });

        row.add_suffix(spin_button);

        return row;
    }
}

class UserInterfaceBuilder {
    #window;
    #widgetBuilder;

    constructor(window, widgetBuilder) {
        this.#window = window;
        this.#widgetBuilder = widgetBuilder;
    }

    build() {
        this.#window.add(this.#createGeneralPage());
        this.#window.add(this.#createMemoryPage());
    }

    #createGeneralPage(widgetBuilder) {
        let generalPage = new Page(_('General'), 'preferences-system-symbolic');

        let timerGroup = new Adw.PreferencesGroup({
            title: _('Timer')
        });
        timerGroup.add(this.#widgetBuilder.add_spin('Refresh interval in seconds.', PrefsKeys.REFRESH_INTERVAL, {
            lower: 1,
            upper: 10,
            step_increment: 1
        }));
        generalPage.add(timerGroup);


        let layoutGroup = new Adw.PreferencesGroup({
            title: _('Layout')
        });
        layoutGroup.add(this.#widgetBuilder.add_combo('Position on top bar.', PrefsKeys.POSITION, [
            { "title": "Left side", "value": "left" },
            { "title": "Center", "value": "center" },
            { "title": "Right side", "value": "right" }
        ], 'string'));
        layoutGroup.add(this.#widgetBuilder.add_combo('Layout of drop-down information panel.', PrefsKeys.LAYOUT, [
            { "title": "Horizontal", "value": "horizontal" },
            { "title": "Vertical", "value": "vertical" }
        ], 'string'));
        generalPage.add(layoutGroup);

        let visibilityGroup = new Adw.PreferencesGroup({
            title: _('Visibility')
        });
        visibilityGroup.add(this.#widgetBuilder.add_boolean('Show activity on top bar.', PrefsKeys.SHOW_ACTIVITY));
        visibilityGroup.add(this.#widgetBuilder.add_boolean('Enable CPU indicator.', PrefsKeys.CPU_METER));
        visibilityGroup.add(this.#widgetBuilder.add_boolean('Enable memory indicator.', PrefsKeys.MEMORY_METER));
        visibilityGroup.add(this.#widgetBuilder.add_boolean('Enable disk indicator.', PrefsKeys.STORAGE_METER));
        visibilityGroup.add(this.#widgetBuilder.add_boolean('Enable network indicator.', PrefsKeys.NETWORK_METER));
        visibilityGroup.add(this.#widgetBuilder.add_boolean('Enable swap indicator.', PrefsKeys.SWAP_METER));
        visibilityGroup.add(this.#widgetBuilder.add_boolean('Enable system load indicator.', PrefsKeys.LOAD_METER));
        generalPage.add(visibilityGroup);

        return generalPage;
    }

    #createMemoryPage() {
        let memoryPage = new Page(_('Memory'), 'accessories-calculator-symbolic');

        let calculationGroup = new Adw.PreferencesGroup({
            title: _('Calculation')
        });
        calculationGroup.add(this.#widgetBuilder.add_combo('Memory calculation method for process list sorting.', PrefsKeys.MEMORY_CALCULATION_METHOD, [
            { "title": "RAM only", "value": "ram_only" },
            { "title": "All memory", "value": "all" }
        ], 'string'));
        memoryPage.add(calculationGroup);

        return memoryPage;
    }
}

export default class SystemMonitorExtensionPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        let widgetBuilder = new WidgetBuilder(this.getSettings());
        let interfaceBuilder = new UserInterfaceBuilder(window, widgetBuilder);

        interfaceBuilder.build();
    }
}
