"use strict";

import GLib from 'gi://GLib';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as View from './view.js';
import * as PrefsKeys from './prefs_keys.js';

const Timer = class {
    constructor(params) {
        this._settings = params.settings;
        this._view = params.view;
    }

    start(update_interval) {
        update_interval = update_interval || this._settings.get_int(PrefsKeys.REFRESH_INTERVAL);
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT_IDLE, update_interval, () => {
            this._view.updateUi();
            return GLib.SOURCE_CONTINUE;
        });
        this._view.updateUi();

        // Update timer interval on change
        let that = this;
        this._change_event_id = this._settings.connect('changed::' + PrefsKeys.REFRESH_INTERVAL, function(settings, key) {
            let update_interval = settings.get_int(key);
            that.stop();
            that.start(update_interval);
        });
    }

    stop() {
        if (this._timer) {
            GLib.Source.remove(this._timer);
            this._timer = null;
        }
        if (this._change_event_id) {
            this._settings.disconnect(this._change_event_id);
            this._change_event_id = null;
        }
    }

    destroy() {
        this._view.destroy();
        this._settings = null;
        this._view = null;
    }
};

export default class SystemMonitorExtension extends Extension {
    #timer;

    enable() {
        this.#timer = new Timer({view: new View.Menu({settings: this.getSettings()}), settings: this.getSettings()});
        this.#timer.start();
    }

    disable() {
        this.#timer.stop();
        this.#timer.destroy();
        this.#timer = null;
    }
}