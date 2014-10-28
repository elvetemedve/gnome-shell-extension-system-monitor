const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const View = Me.imports.view;
const Convenience = Me.imports.convenience;
const PrefsKeys = Me.imports.prefs_keys;

const Timer = new Lang.Class({
    Name: 'Timer',

    _init: function(params) {
        this._settings = Convenience.getSettings();
        this._view = params.view;
    },

    start: function(update_interval) {
        update_interval = update_interval || this._settings.get_int(PrefsKeys.REFRESH_INTERVAL);
        this._timer = Mainloop.timeout_add_seconds(update_interval, Lang.bind(this._view, this._view.updateUi));
        this._view.updateUi();

        // Update timer interval on change
        this._change_event_id = this._settings.connect('changed::' + PrefsKeys.REFRESH_INTERVAL, Lang.bind(this, function(settings, key) {
            let update_interval = settings.get_int(key);
            this.stop();
            this.start(update_interval);
        }));
    },

    stop: function() {
        if (this._timer) {
            Mainloop.source_remove(this._timer);
            this._timer = null;
        }
        if (this._change_event_id) {
            this._settings.disconnect(this._change_event_id);
        }
    },

    destroy: function() {
        this._view.destroy();
    }
});

let timer;

function init() {
    // Register application-specific themed icons.
    let theme = imports.gi.Gtk.IconTheme.get_default();
    theme.append_search_path(Me.path + '/icons');
}

function enable() {
    let view = new View.Menu();
    timer = new Timer({view: view});
    timer.start();
}

function disable() {
    timer.stop();
    timer.destroy();
    timer = null;
}
