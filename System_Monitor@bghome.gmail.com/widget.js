const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Lang = imports.lang;

let BaseMenuItem = new Lang.Class({
    Name: "BaseMenuItem",
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(text, options) {
        options = options || {};
        let icon = options.icon, summary_text = options.summary_text, button_icon = options.button_icon, button_callback = options.button_callback;
        delete options.icon;
        delete options.summary_text;
        delete options.button_icon;
        delete options.button_callback;
        this.parent(options);

        if (icon) {
            this.icon = icon;
            this.actor.add(this.icon);
        }

        this.label = new St.Label({text: text});
        this.labelBin = new St.Bin({child: this.label});
        this.actor.add(this.labelBin);

        if (summary_text) {
            this.rightLabel = new St.Label({text: summary_text});
            this.rightLabelBin = new St.Bin({child: this.rightLabel});
            this.actor.add(this.rightLabelBin, {expand: true, x_fill: false, x_align: St.Align.END});
        }

        if (button_icon) {
            this.button = new St.Button();
            this.button.connect('clicked', button_callback);
            this.button_icon = new St.Icon({
                icon_name: button_icon,
                icon_size: 14,
                style_class: 'system-status-icon'
            });
            this.button.set_child(this.button_icon);
            this.actor.add(this.button, {expand: true, x_fill: false, x_align: St.Align.END});
        }
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
    }
});

const ResourceTitleItem = new Lang.Class({
    Name: "ResourceTitleItem",
    Extends: BaseMenuItem,

    _init: function(text, icon, summary_text) {
        this.parent(text, {"icon": icon, "summary_text": summary_text, "hover": false, "can_focus": false, "reactive": false});
    }
});

const ProcessItem = new Lang.Class({
    Name: "ProcessItem",
    Extends: BaseMenuItem,

    _init: function(text, button_icon, button_callback) {
        this.parent(text, {"button_icon": button_icon, "button_callback": button_callback, "activate": false});
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
    },
    update: function(state) {
        this._label_item.setSummaryText(Math.round(state.percent) + ' %');
    }
});
