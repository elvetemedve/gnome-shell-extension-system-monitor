const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Lang = imports.lang;
const Main = imports.ui.main;

let BaseMenuItem = new Lang.Class({
    Name: "BaseMenuItem",
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(text, options) {
        options = options || {};
        let icon = options.icon, summary_text = options.summary_text, button_icon = options.button_icon, button_callback = options.button_callback,
        button_trigger_key = options.button_trigger_key;
        delete options.icon;
        delete options.summary_text;
        delete options.button_icon;
        delete options.button_callback;
        delete options.button_trigger_key;
        this.parent(options);

        if (icon) {
            this.icon = icon;
            this.actor.add(this.icon);
        }

        this.label = new St.Label({text: text, style_class: "item-label"});
        this.labelBin = new St.Bin({child: this.label});
        this.actor.add(this.labelBin);
        this.connect('active-changed', Lang.bind(this, this._activeChanged));

        if (summary_text) {
            this.rightLabel = new St.Label({text: summary_text, style_class: "right-label"});
            this.rightLabelBin = new St.Bin({child: this.rightLabel});
            this.actor.add(this.rightLabelBin, {expand: true, x_fill: false, x_align: St.Align.END});
        }

        if (button_icon) {
            this.button = new St.Button();
            this.button.connect('clicked', Lang.bind(this, function(actor, event) {
                button_callback.call(this.button, actor, event, this.getState());
            }));
            this.button_icon = new St.Icon({
                icon_name: button_icon,
                icon_size: 14,
                style_class: 'system-status-icon'
            });
            this.button.set_child(this.button_icon);
            this.actor.add(this.button, {expand: true, x_fill: false, x_align: St.Align.END});
        }
    },

    _activeChanged: function() {
        // Expand ellipsized label.
        this.label.clutter_text.set_line_wrap(this.active);
    },

    setLabel: function(text) {
        this.label.text = text;
    },

    setIcon: function(icon) {
        this.icon.set_child(icon);
    },

    setSummaryText: function(text) {
        this.rightLabel.text = text;
    },

    hideButton: function() {
        this.button.hide();
    },

    showButton: function() {
        this.button.show();
    },

    setState: function(state) {
        this._state = state;
    },

    getState: function() {
        return this._state || {};
    }
});

const ResourceTitleItem = new Lang.Class({
    Name: "ResourceTitleItem",
    Extends: BaseMenuItem,

    _init: function(text, icon, summary_text) {
        this.parent(text, {"icon": icon, "summary_text": summary_text, style_class:"resource-title", "hover": false, "activate": false});
    }
});

const ProcessItem = new Lang.Class({
    Name: "ProcessItem",
    Extends: BaseMenuItem,

    _init: function(text, button_icon, button_callback, button_trigger_key) {
        this.parent(text, {"button_icon": button_icon, "button_callback": button_callback, "button_trigger_key": button_trigger_key, "activate": false});
    }
});

const MountItem = new Lang.Class({
    Name: "MountItem",
    Extends: BaseMenuItem,

    _init: function(text) {
        this.parent(text, {"activate": false});
    }
});

const StateItem = new Lang.Class({
    Name: "StateItem",
    Extends: BaseMenuItem,

    _init: function(text) {
        this.parent(text, {"activate": false});
    }
});

const Separator = new Lang.Class({
    Name: "Separator",
    Extends: PopupMenu.PopupSeparatorMenuItem
});

const MeterAreaContainer = new Lang.Class({
    Name: "MeterAreaContainer",
    Extends: St.BoxLayout,

    _init: function() {
        this.parent({"accessible-name": 'meterArea', "vertical": false});
    },
    addMeter: function(meter) {
        if (!meter instanceof MeterContainer) {
            throw new TypeError("First argument of addMeter() method must be instance of MeterContainer.");
        }
        this.add_actor(meter);
    }
});

const MeterContainer = new Lang.Class({
    Name: "MeterContainer",
    Extends: St.BoxLayout,

    _init: function() {
        this.parent({"vertical": true});
        this._menu_items = [];
    },
    addTitleItem: function(item) {
        if (!item instanceof ResourceTitleItem) {
            throw new TypeError("First argument of addTitleItem() method must be instance of ResourceTitleItem.");
        }
        this.add_actor(item.actor);
        this._label_item = item;
    },
    addMenuItem: function(item) {
        if (!item instanceof BaseMenuItem) {
            throw new TypeError("First argument of addMenuItem() method must be instance of BaseMenuItem.");
        }
        this.add_actor(item.actor);
        this._menu_items.push(item);
    },
    removeAllMenuItems: function() {
        for (let item of this._menu_items) {
            this.remove_actor(item.actor);
            item.actor.destroy();
        }
        this._menu_items.length = 0;
    },
    update: function(state) {
        this._label_item.setSummaryText(Math.round(state.percent) + ' %');
    }
});

const ProcessItemsContainer = new Lang.Class({
    Name: "ProcessItemsContainer",
    Extends: MeterContainer,

    update: function(state) {
        MeterContainer.prototype.update.call(this, state);

        for (let i = 0; i < this._menu_items.length; i++) {
            if (i in state.processes) {
                let process = state.processes[i];
                this._menu_items[i].setLabel(process.command);
                this._menu_items[i].showButton();
                this._menu_items[i].setState(process);
            } else {
                this._menu_items[i].setLabel('');
                this._menu_items[i].hideButton();
                this._menu_items[i].setState({});
            }
        }
    }
});

const SystemLoadItemsContainer = new Lang.Class({
    Name: "SystemLoadItemsContainer",
    Extends: MeterContainer,

    update: function(state) {
        MeterContainer.prototype.update.call(this, state);

        let load = state.system_load;
        this._menu_items[0].setLabel(load.load_average_1 + ' / ' + load.load_average_5 + ' / ' + load.load_average_15);
        this._menu_items[1].setLabel(
            '%running% out of %all% tasks are running'
                .replace('%running%', load.running_tasks_count)
                .replace('%all%', load.tasks_count)
        );
        for (let i = 2; i < this._menu_items.length; i++) {
            this._menu_items[i].setLabel('');
        }
    }
});
