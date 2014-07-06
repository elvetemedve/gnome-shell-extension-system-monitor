const Lang = imports.lang;
const Panel = imports.ui.main.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const FactoryModule = Me.imports.factory;

const Menu = new Lang.Class({
    Name: 'Menu',
    Extends: PanelMenu.Button,
    _meters: {},

    _init: function() {
    	let menuAlignment = 0.0;
    	this.parent(menuAlignment);
    	let actor = new St.BoxLayout();
        actor.add_actor(this._createIcon('cpu'));
        actor.add_actor(this._createIcon('memory'));
    	actor.add_actor(this._createIcon('storage'));
        actor.add_actor(this._createIcon('network'));
        actor.add_actor(this._createIcon('swap'));
        actor.add_actor(this._createIcon('load'));
    	this.actor.add_actor(actor);
    	this.menu.addMenuItem(new PopupMenu.PopupMenuItem('lorem ipsum', {}));
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
        return icon;
    },
    destroy: function() {
        let meters = this._meters;
        for (let type in meters) {
            meters[type].destroy();
        }

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
