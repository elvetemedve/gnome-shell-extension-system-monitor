"use strict";

import GLib from 'gi://GLib';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as View from './view.js';
import * as PrefsKeys from './prefs_keys.js';

const Timer = class {
    constructor(view, settings) {
        this._settings = settings;
        this._view = view;
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
        this.stop();
        this._view.destroy();
        this._settings = null;
        this._view = null;
    }
};

export default class SystemMonitorExtension extends Extension {
    #timer;

    enable() {
        let settings = this.getSettings();
        this.#timer = new Timer(new View.Menu(this, settings), settings);
        this.#timer.start();
    }

    disable() {
        this.#timer.destroy();
        this.#timer = null;
    }
}