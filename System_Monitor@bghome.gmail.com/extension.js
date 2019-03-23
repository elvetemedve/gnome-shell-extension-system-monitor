const { GLib } = imports.gi;

const Mainloop = imports.mainloop;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const View = Me.imports.view;
const Convenience = Me.imports.convenience;
const PrefsKeys = Me.imports.prefs_keys;

const Timer = class {
    constructor(params) {
        this._settings = Convenience.getSettings();
        this._view = params.view;
    }

    start(update_interval) {
        update_interval = update_interval || this._settings.get_int(PrefsKeys.REFRESH_INTERVAL);
        this._timer = Mainloop.timeout_add_seconds(update_interval, () => {
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
            Mainloop.source_remove(this._timer);
            this._timer = null;
        }
        if (this._change_event_id) {
            this._settings.disconnect(this._change_event_id);
            this._change_event_id = null;
        }
    }

    destroy() {
        this._view.destroy();
    }
};

var timer;

function enable() {
    let view = new View.Menu();
    view.updateUi();
    timer = new Timer({view: view});
    timer.start();
}

function disable() {
    timer.stop();
    timer.destroy();
    timer = null;
}
