const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const View = Me.imports.view;

let view, timer;

function init() {

}

function enable() {
    view = new View.Menu();
    let update_interval = 2;
    timer = Mainloop.timeout_add_seconds(update_interval, Lang.bind(view, view.updateUi));
    view.updateUi();
}

function disable() {
    Mainloop.source_remove(timer);
    timer = null;
    view.destroy();
    view = null;
}
